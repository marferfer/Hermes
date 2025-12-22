import os
import json
from pathlib import Path
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    StorageContext,
    load_index_from_storage,
)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.ollama import Ollama

# Rutas
BASE_DIR = Path(__file__).parent.resolve()
DOCS_DIR = BASE_DIR / "docs"
STORAGE_DIR = BASE_DIR / "storage"

# Cache global
_index = None
_embed_model = None

def get_index():
    global _index, _embed_model
    if _index is not None:
        return _index

    if not DOCS_DIR.exists():
        raise FileNotFoundError(f"La carpeta 'docs' no existe: {DOCS_DIR}")
    
    _embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-m3")

    if STORAGE_DIR.exists():
        print("📂 Cargando índice desde 'storage/'...")
        storage_context = StorageContext.from_defaults(persist_dir=str(STORAGE_DIR))
        _index = load_index_from_storage(storage_context, embed_model=_embed_model)
        print("✅ Índice cargado desde disco.")
    else:
        print("🔍 Creando nuevo índice...")
        documents = SimpleDirectoryReader(str(DOCS_DIR)).load_data()
        if not documents:
            raise ValueError(f"No hay documentos en: {DOCS_DIR}")
        
        # Añadir metadatos de permisos a cada fragmento
        for doc in documents:
            file_path = Path(doc.metadata.get("file_path", ""))
            meta_file = str(file_path) + ".meta.json"
            
            if os.path.exists(meta_file):
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    doc.metadata["access_level"] = meta.get("access_level", "publico")
                    doc.metadata["owner_department"] = meta.get("owner_department", "IT")
            else:
                doc.metadata["access_level"] = "publico"
                doc.metadata["owner_department"] = "IT"
            doc.metadata["source_file"] = file_path.name

        _index = VectorStoreIndex.from_documents(documents, embed_model=_embed_model)
        print("💾 Guardando índice en 'storage/'...")
        _index.storage_context.persist(persist_dir=str(STORAGE_DIR))
        print("✅ Índice guardado.")

    return _index

def query_rag(question: str, user_department: str = "IT") -> tuple[str, list[str]]:
    """
    Devuelve (respuesta, lista_de_fuentes)
    """
    index = get_index()
    
    # Filtrar nodos según permisos
    def node_filter(node) -> bool:
        level = node.metadata.get("access_level", "publico")
        owner = node.metadata.get("owner_department", "IT")
        if level == "publico":
            return True
        elif level == "departamento":
            return user_department == owner
        elif level == "privado":
            return user_department == owner
        return False

    # Recuperar nodos relevantes
    from llama_index.core.retrievers import VectorIndexRetriever
    retriever = VectorIndexRetriever(index=index, similarity_top_k=5)
    nodes = retriever.retrieve(question)
    
    # Aplicar filtro y extraer fuentes
    filtered_nodes = [node for node in nodes if node_filter(node.node)]
    
    if not filtered_nodes:
        return "🔒 No tienes permiso para acceder a información sobre esa pregunta.", []

    # Obtener nombres únicos de archivos fuente
    sources = list({
        node.node.metadata.get("source_file", "documento_desconocido")
        for node in filtered_nodes
    })

    # Construir contexto
    context = "\n\n".join([node.node.get_content() for node in filtered_nodes])
    full_prompt = (
        f"Responde la pregunta usando SOLO la información del contexto.\n"
        f"Si no sabes la respuesta, di 'No sé'.\n"
        f"Responde siempre en español.\n\n"
        f"Contexto:\n{context}\n\n"
        f"Pregunta: {question}\n\n"
        f"Respuesta:"
    )
    
    llm = Ollama(
        model="llama3",
        temperature=0.1,
        request_timeout=120.0,
        num_thread=2
    )
    response = llm.complete(full_prompt)
    return str(response), sources
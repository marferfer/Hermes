# rag_engine.py
import os
from pathlib import Path
from llama_index.core import VectorStoreIndex, Settings
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.ollama import Ollama
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from unstructured.partition.auto import partition

# === CONFIGURACIÓN GLOBAL AL INICIO ===
Settings.embed_model = HuggingFaceEmbedding(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)
Settings.llm = Ollama(model="phi3:mini", temperature=0.1, request_timeout=120.0)
Settings.chunk_size = 512

# Configuración
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "hermes_docs"
PROJECT_ROOT = Path(__file__).parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"

def get_index():
    """Crea o carga el índice desde Qdrant."""
    client = QdrantClient(url=QDRANT_URL, check_compatibility=False)
    vector_store = QdrantVectorStore(
        client=client, 
        collection_name=COLLECTION_NAME,
        prefer_grpc=False
    )
    
    return VectorStoreIndex.from_vector_store(vector_store)

def index_documents():
    """Indexa todos los documentos en Qdrant."""
    if not DOCS_DIR.exists():
        print("⚠️ Carpeta docs no existe")
        return
    
    documents = []
    processed_files = []
    failed_files = []
    
    for file_path in DOCS_DIR.iterdir():
        if (file_path.suffix.lower() in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
            and not file_path.name.endswith(".meta")):
            
            print(f"Procesando: {file_path.name}")
            
            # Cargar metadatos
            meta_file = Path(str(file_path) + ".meta")
            if meta_file.exists():
                import json
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            else:
                meta = {"access_level": "publico", "owner_department": "IT"}
            
            # Leer contenido con unstructured
            try:
                elements = partition(filename=str(file_path))
                file_content = "\n\n".join([str(el) for el in elements])
                
                if len(file_content.strip()) == 0:
                    raise ValueError("Contenido vacío")
                
                from llama_index.core import Document
                doc = Document(
                    text=file_content,
                    metadata={
                        "source_file": file_path.name,
                        "access_level": meta["access_level"],
                        "owner_department": meta["owner_department"]
                    }
                )
                documents.append(doc)
                processed_files.append(file_path.name)
                print(f"  ✅ Procesado correctamente")
                
            except Exception as e:
                failed_files.append((file_path.name, str(e)))
                print(f"  ❌ Error: {e}")
                continue
    
    print(f"\nResumen:")
    print(f"✅ Procesados: {len(processed_files)}")
    print(f"❌ Fallidos: {len(failed_files)}")
    
    for name, error in failed_files[:3]:
        print(f"  {name}: {error}")
    
    if documents:
        try:
            from qdrant_client import QdrantClient
            from llama_index.vector_stores.qdrant import QdrantVectorStore
            
            # Crear cliente
            client = QdrantClient(url=QDRANT_URL, check_compatibility=False)
            
            # Crear vector store CON LA CONFIGURACIÓN CORRECTA
            vector_store = QdrantVectorStore(
                client=client,
                collection_name=COLLECTION_NAME,
                embedding_dimension=384  # ¡IMPORTANTE! Tamaño del modelo all-MiniLM-L6-v2
            )
            
            # Crear el índice CON LOS SETTINGS GLOBALES
            index = VectorStoreIndex.from_documents(
                documents,
                vector_store=vector_store,
                show_progress=True
            )
            
            print(f"\n✅ ¡Indexación completada! {len(documents)} documentos procesados")
        except Exception as e:
            print(f"\n❌ Error al indexar en Qdrant: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("\n⚠️ No hay documentos válidos para indexar")

def query_rag(question: str, user_department: str = "IT") -> tuple[str, list[str]]:
    """Consulta Qdrant con filtrado de permisos en tiempo real."""
    index = get_index()
    
    # Crear filtro de permisos para Qdrant
    permission_filter = rest.Filter(
        should=[
            # Público: accesible para todos
            rest.FieldCondition(
                key="access_level",
                match=rest.MatchValue(value="publico")
            ),
            # Mismo departamento
            rest.FieldCondition(
                key="owner_department",
                match=rest.MatchValue(value=user_department)
            )
        ]
    )
    
    # Configurar retriever con filtro
    retriever = index.as_retriever(
        similarity_top_k=5,
        vector_store_kwargs={"qdrant_filters": permission_filter}
    )
    
    # Obtener nodos relevantes
    nodes = retriever.retrieve(question)
    
    if not nodes:
        return "🔒 No tienes permiso para acceder a información sobre esa pregunta.", []
    
    # Extraer fuentes únicas
    sources = list(set([node.metadata.get("source_file", "documento") for node in nodes]))
    
    # Construir contexto y responder
    context = "\n\n".join([node.get_content() for node in nodes])
    full_prompt = (
        f"Responde en español usando SOLO la información del contexto.\n"
        f"Si no sabes la respuesta, di 'No sé'.\n\n"
        f"Contexto:\n{context}\n\n"
        f"Pregunta: {question}\n\n"
        f"Respuesta:"
    )
    
    llm = Ollama(model="phi3:mini", temperature=0.1, request_timeout=120.0)
    response = llm.complete(full_prompt)
    return str(response), sources
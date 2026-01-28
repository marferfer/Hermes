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
Settings.llm = Ollama(model="gemma:2b-instruct-q8_0", temperature=0.1, request_timeout=120.0)
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

def query_rag(question: str) -> tuple[str, list[str]]:
    """Consulta Qdrant con búsqueda híbrida"""
    index = get_index()
    
    # Método 1: Búsqueda semántica normal
    semantic_retriever = index.as_retriever(similarity_top_k=5)
    semantic_nodes = semantic_retriever.retrieve(question)
    
    # Método 2: Búsqueda específica por nombres de archivo
    from qdrant_client.http import models as rest
    filename_nodes = []
    
    # Extraer nombres de archivos mencionados en la pregunta
    import re
    filename_pattern = r'\b[\w-]+\.docx|\b[\w-]+\.pdf|\b[\w-]+\.txt|\b[\w-]+\.xlsx'
    mentioned_files = re.findall(filename_pattern, question, re.IGNORECASE)
    
    if mentioned_files:
        for filename in mentioned_files[:2]:  # Máximo 2 archivos
            try:
                file_filter = rest.Filter(
                    must=[
                        rest.FieldCondition(
                            key="source_file",
                            match=rest.MatchValue(value=filename)
                        )
                    ]
                )
                file_retriever = index.as_retriever(
                    similarity_top_k=3,
                    vector_store_kwargs={"qdrant_filters": file_filter}
                )
                file_nodes = file_retriever.retrieve("contenido del documento")
                filename_nodes.extend(file_nodes)
            except:
                pass
    
    # Combinar resultados
    all_nodes = semantic_nodes + filename_nodes
    # Eliminar duplicados
    seen_ids = set()
    unique_nodes = []
    for node in all_nodes:
        if node.node_id not in seen_ids:
            unique_nodes.append(node)
            seen_ids.add(node.node_id)
    
    if not unique_nodes:
        return "No se encontró información relevante en los documentos disponibles.", []
    
    sources = list(set([node.metadata.get("source_file", "documento") for node in unique_nodes]))
    context = "\n\n".join([node.get_content() for node in unique_nodes])
    
    full_prompt = (
        f"Responde en español usando la información proporcionada.\n"
        f"Si la información no es suficiente, di 'No tengo suficiente información'.\n\n"
        f"Información:\n{context}\n\n"
        f"Pregunta: {question}\n\n"
        f"Respuesta:"
    )
    
    llm = Ollama(model="gemma:2b-instruct-q8_0", temperature=0.1, request_timeout=120.0)
    response = llm.complete(full_prompt)
    return str(response), sources
# src/rag_engine.py
import os
from pathlib import Path
from llama_index.core import VectorStoreIndex, StorageContext, Settings
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
Settings.llm = Ollama(model="phi3", temperature=0.1, request_timeout=120.0)
Settings.chunk_size = 512

# Configuración
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "hermes_docs"
DOCS_DIR = Path("docs")

def init_qdrant_collection():
    """Crea la colección en Qdrant con el esquema correcto."""
    client = QdrantClient(url=QDRANT_URL)
    
    # Verificar si la colección ya existe
    collections = client.get_collections()
    if COLLECTION_NAME not in [c.name for c in collections.collections]:
        # Crear colección con soporte para metadatos
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=rest.VectorParams(
                size=384,  # Tamaño del modelo all-MiniLM-L6-v2
                distance=rest.Distance.COSINE
            )
        )
        
        # Crear índices para los metadatos (¡clave para el rendimiento!)
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="access_level",
            field_schema=rest.PayloadSchemaType.KEYWORD
        )
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="owner_department",
            field_schema=rest.PayloadSchemaType.KEYWORD
        )
    return client

def get_index():
    """Crea o carga el índice desde Qdrant."""
    client = QdrantClient(url=QDRANT_URL)
    vector_store = QdrantVectorStore(
        client=client, 
        collection_name=COLLECTION_NAME,
        prefer_grpc=False
    )
    
    return VectorStoreIndex.from_vector_store(vector_store)

def index_documents():
    """Indexa todos los documentos en Qdrant."""
    from llama_index.core import SimpleDirectoryReader
    
    # Inicializar colección
    init_qdrant_collection()
    
    # Leer documentos
    if not DOCS_DIR.exists():
        print("⚠️ Carpeta docs no existe")
        return
    
    # Usar SimpleDirectoryReader con tus metadatos personalizados
    documents = []
    for file_path in DOCS_DIR.iterdir():
        if (file_path.suffix in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
            and not file_path.name.endswith(".meta.json")):
            
            # Cargar metadatos
            meta_file = Path(str(file_path) + ".meta.json")
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
            except Exception as e:
                print(f"Error al procesar {file_path}: {e}")
                continue
            
            # Crear documento
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
    
    if documents:
        # Indexar en Qdrant (Settings ya está configurado globalmente)
        index = VectorStoreIndex.from_documents(
            documents,
            vector_store=QdrantVectorStore(
                client = QdrantClient(url=QDRANT_URL, check_compatibility=False),
                collection_name=COLLECTION_NAME
            )
        )
        print(f"✅ Indexados {len(documents)} documentos en Qdrant")
    else:
        print("⚠️ No hay documentos para indexar")

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
    
    llm = Ollama(model="phi3", temperature=0.1, request_timeout=120.0)
    response = llm.complete(full_prompt)
    return str(response), sources
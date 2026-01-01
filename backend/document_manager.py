import os
import json
from pathlib import Path
from hashlib import sha256
from typing import List, Tuple, Optional
from unstructured.partition.auto import partition

DOCS_DIR = Path("docs")

def ensure_docs_dir():
    """Asegura que la carpeta docs exista."""
    DOCS_DIR.mkdir(exist_ok=True)

def get_existing_documents() -> List[dict]:
    """Obtiene la lista de documentos existentes con sus metadatos."""
    documents = []
    if not DOCS_DIR.exists():
        return documents
    
    for file_path in DOCS_DIR.iterdir():
        if (file_path.suffix in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
            and not file_path.name.endswith(".meta.json")):
            
            meta_file = Path(str(file_path) + ".meta.json")
            meta = {"access_level": "publico", "owner_department": "IT", "content_hash": ""}
            
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                except:
                    pass
            
            documents.append({
                "name": file_path.name,
                "path": file_path,
                "size": file_path.stat().st_size,
                "metadata": meta
            })
    
    return documents

def calculate_content_hash(file_content: bytes) -> str:
    """Calcula el hash SHA-256 del contenido del archivo."""
    return sha256(file_content).hexdigest()

def is_duplicate(
    new_filename: str, 
    new_filesize: int, 
    new_content_hash: str,
    existing_docs: List[dict]
) -> Tuple[bool, Optional[str]]:
    """
    Verifica si un archivo es duplicado.
    Devuelve (es_duplicado, nombre_original) o (False, None)
    """
    for doc in existing_docs:
        # 1. Mismo nombre
        if doc["name"] == new_filename:
            # 2. Mismo tamaño
            if doc["size"] == new_filesize:
                # 3. Mismo contenido
                if doc["metadata"].get("content_hash") == new_content_hash:
                    return True, doc["name"]
    
    return False, None

def _index_single_document(filename: str, content: bytes, access_level: str, owner_department: str):
    """Indexa un solo documento en Qdrant."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.http import models as rest
        from llama_index.core import Document
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding
        from llama_index.vector_stores.qdrant import QdrantVectorStore
        from llama_index.core import VectorStoreIndex
        from llama_index.core import Settings
        
        # Configuración
        QDRANT_URL = "http://localhost:6333"
        COLLECTION_NAME = "hermes_docs"
        
        # Procesar contenido del documento
        try:
            elements = partition(file=content, file_filename=filename)
            file_content = "\n\n".join([str(el) for el in elements])
        except Exception as e:
            # Si no se puede procesar, usar contenido bruto (solo para txt)
            if filename.endswith('.txt'):
                file_content = content.decode('utf-8', errors='ignore')
            else:
                file_content = ""
        
        if not file_content.strip():
            print(f"⚠️ Advertencia: documento {filename} está vacío o no se pudo procesar")
            return
        
        # Crear documento con metadatos
        doc = Document(
            text=file_content,
            metadata={
                "source_file": filename,
                "access_level": access_level,
                "owner_department": owner_department
            }
        )
        
        # Configurar embedding
        Settings.embed_model = HuggingFaceEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Conectar a Qdrant
        client = QdrantClient(url=QDRANT_URL)
        
        # Verificar si la colección existe, si no, crearla
        collections = client.get_collections()
        if COLLECTION_NAME not in [c.name for c in collections.collections]:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=rest.VectorParams(
                    size=384,
                    distance=rest.Distance.COSINE
                )
            )
            # Crear índices para metadatos
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
        
        # Indexar documento
        vector_store = QdrantVectorStore(client=client, collection_name=COLLECTION_NAME)
        index = VectorStoreIndex.from_documents([doc], vector_store=vector_store)
        
        print(f"✅ Documento {filename} indexado en Qdrant")
        
    except Exception as e:
        print(f"❌ Error al indexar {filename} en Qdrant: {str(e)}")

def _delete_from_qdrant(filename: str):
    """Elimina un documento de Qdrant."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.http import models as rest
        
        QDRANT_URL = "http://localhost:6333"
        COLLECTION_NAME = "hermes_docs"
        
        client = QdrantClient(url=QDRANT_URL)
        
        # Buscar puntos con este filename
        points = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=rest.Filter(
                must=[
                    rest.FieldCondition(
                        key="source_file",
                        match=rest.MatchValue(value=filename)
                    )
                ]
            ),
            limit=100
        )
        
        if points[0]:  # points[0] contiene los puntos encontrados
            point_ids = [point.id for point in points[0]]
            client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=rest.PointIdsList(points=point_ids)
            )
            print(f"✅ Documento {filename} eliminado de Qdrant")
        
    except Exception as e:
        print(f"⚠️ Advertencia: no se pudo eliminar {filename} de Qdrant: {str(e)}")

def save_document(
    filename: str, 
    content: bytes, 
    access_level: str, 
    owner_department: str,
    content_hash: str
) -> str:
    """Guarda un documento y sus metadatos, e indexa en Qdrant."""
    file_path = DOCS_DIR / filename
    
    # Guardar archivo
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Guardar metadatos
    meta = {
        "access_level": access_level,
        "owner_department": owner_department,
        "content_hash": content_hash
    }
    
    with open(file_path.with_suffix(file_path.suffix + ".meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    
    # Indexar en Qdrant
    _index_single_document(filename, content, access_level, owner_department)
    
    return str(file_path)

def delete_document(filename: str) -> bool:
    """Elimina un documento y sus metadatos, y lo borra de Qdrant."""
    file_path = DOCS_DIR / filename
    meta_path = Path(str(file_path) + ".meta.json")
    
    deleted = False
    if file_path.exists():
        file_path.unlink()
        deleted = True
    
    if meta_path.exists():
        meta_path.unlink()
    
    # Eliminar de Qdrant
    if deleted:
        _delete_from_qdrant(filename)
    
    return deleted
# backend/index_docs.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from unstructured.partition.auto import partition
from llama_index.core import Document, VectorStoreIndex
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# Configuración
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "hermes_docs"
PROJECT_ROOT = Path(__file__).parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"

def main():
    # Inicializar cliente Qdrant
    client = QdrantClient(url=QDRANT_URL, check_compatibility=False)
    
    # Crear colección manualmente
    try:
        client.delete_collection(COLLECTION_NAME)
        print("Colección anterior eliminada")
    except:
        pass
    
    print("Creando nueva colección...")
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=rest.VectorParams(
            size=384,
            distance=rest.Distance.COSINE
        )
    )
    print("✅ Colección creada")
    
    # Procesar documentos
    if not DOCS_DIR.exists():
        print("⚠️ Carpeta docs no existe")
        return
    
    documents = []
    for file_path in DOCS_DIR.iterdir():
        if (file_path.suffix.lower() in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
            and not file_path.name.endswith(".meta")):
            
            print(f"\n--- Procesando: {file_path.name} ---")
            
            # Cargar metadatos
            meta_file = Path(str(file_path) + ".meta")
            if meta_file.exists():
                import json
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            else:
                meta = {"access_level": "publico", "owner_department": "IT"}
            
            # Leer contenido
            try:
                print("  Extrayendo contenido...")
                elements = partition(filename=str(file_path))
                file_content = "\n\n".join([str(el) for el in elements])
                
                print(f"  Longitud del contenido: {len(file_content)} caracteres")
                print(f"  Primeras 100 chars: {file_content[:100]}...")
                
                if len(file_content.strip()) < 10:  # Umbral mínimo
                    print(f"  ⚠️ Contenido demasiado corto (< 10 chars)")
                    continue
                
                doc = Document(
                    text=file_content,
                    metadata={
                        "source_file": file_path.name,
                        "access_level": meta["access_level"],
                        "owner_department": meta["owner_department"]
                    }
                )
                documents.append(doc)
                print(f"  ✅ Documento añadido a la lista")
                
            except Exception as e:
                print(f"  ❌ Error al procesar: {e}")
                continue
    
    print(f"\nTotal documentos preparados para indexar: {len(documents)}")
    
    if not documents:
        print("⚠️ No hay documentos válidos para indexar")
        return
    
    # Indexar en Qdrant con debug
    print(f"\nIndexando {len(documents)} documentos...")
    embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # Crear vector store
    vector_store = QdrantVectorStore(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding_dimension=384
    )

    # Crear storage context
    from llama_index.core import StorageContext
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # Crear el índice CON STORAGE CONTEXT (esto fuerza la persistencia)
    index = VectorStoreIndex.from_documents(
        documents,
        embed_model=embed_model,
        storage_context=storage_context,
        show_progress=True
    )

    # Verificar puntos en Qdrant
    info = client.get_collection(COLLECTION_NAME)
    print(f"\n✅ ¡Indexación completada!")
    print(f"   Puntos en Qdrant: {info.points_count}")
    print(f"   Documentos procesados: {len(documents)}")

if __name__ == "__main__":
    main()
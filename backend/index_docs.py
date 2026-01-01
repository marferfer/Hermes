# index_docs.py
import sys
import os
sys.path.append('src')

from pathlib import Path
from rag_engine import init_qdrant_collection
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from llama_index.core import Document
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core import VectorStoreIndex
from unstructured.partition.auto import partition
import json

def index_single_document(file_path, meta):
    """Indexa un solo documento en Qdrant."""
    try:
        # Extraer texto del documento
        elements = partition(filename=str(file_path))
        text_content = "\n\n".join([str(el) for el in elements])
        
        if not text_content.strip():
            print(f"⚠️  Documento vacío: {file_path.name}")
            return False
        
        # Crear documento con metadatos
        doc = Document(
            text=text_content,
            metadata={
                "source_file": file_path.name,
                "access_level": meta["access_level"],
                "owner_department": meta["owner_department"]
            }
        )
        
        # Indexar en Qdrant
        client = QdrantClient(url="http://localhost:6333", check_compatibility=False)
        vector_store = QdrantVectorStore(client=client, collection_name="hermes_docs")
        index = VectorStoreIndex.from_documents([doc], vector_store=vector_store)
        
        print(f"✅ Indexado: {file_path.name}")
        return True
        
    except Exception as e:
        print(f"❌ Error al indexar {file_path.name}: {str(e)}")
        return False

def main():
    print("🔍 Iniciando indexación de documentos en Qdrant...")
    
    # Asegurar que la colección exista
    init_qdrant_collection()
    
    # Ruta de documentos
    docs_dir = Path("docs")
    if not docs_dir.exists():
        print("❌ Carpeta 'docs' no existe")
        return
    
    # Obtener lista de documentos
    documents_to_index = []
    for file_path in docs_dir.iterdir():
        if (file_path.suffix in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
            and not file_path.name.endswith(".meta.json")):
            
            # Cargar metadatos
            meta_file = Path(str(file_path) + ".meta.json")
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                except:
                    meta = {"access_level": "publico", "owner_department": "IT"}
            else:
                meta = {"access_level": "publico", "owner_department": "IT"}
            
            documents_to_index.append((file_path, meta))
    
    if not documents_to_index:
        print("⚠️  No se encontraron documentos para indexar")
        return
    
    print(f"📁 Encontrados {len(documents_to_index)} documentos")
    
    # Indexar cada documento
    indexed_count = 0
    for file_path, meta in documents_to_index:
        if index_single_document(file_path, meta):
            indexed_count += 1
    
    print(f"✅ Indexación completada: {indexed_count}/{len(documents_to_index)} documentos procesados")

if __name__ == "__main__":
    main()
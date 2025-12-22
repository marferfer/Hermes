# document_manager.py
import os
import json
from pathlib import Path
from hashlib import sha256
from typing import List, Tuple, Optional

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

def save_document(
    filename: str, 
    content: bytes, 
    access_level: str, 
    owner_department: str,
    content_hash: str
) -> str:
    """Guarda un documento y sus metadatos."""
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
    
    return str(file_path)

def delete_document(filename: str) -> bool:
    """Elimina un documento y sus metadatos."""
    file_path = DOCS_DIR / filename
    meta_path = Path(str(file_path) + ".meta.json")
    
    deleted = False
    if file_path.exists():
        file_path.unlink()
        deleted = True
    
    if meta_path.exists():
        meta_path.unlink()
    
    return deleted
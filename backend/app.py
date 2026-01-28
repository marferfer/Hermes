# backend/app.py
from fastapi import FastAPI, Request, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import json
from pathlib import Path
import shutil
from rag_engine import query_rag
import asyncio

app = FastAPI()

DOCS_DIR = Path("docs")
# Permitir CORS desde tu frontend

# CORS para Live Server (puerto 5500) y otros orígenes
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",  # Live Server
        "http://localhost:5500",   # Live Server alternativo
        "http://localhost:8081",   # Si usas serve después
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KEYCLOAK_URL = "http://localhost:8080"
REALM = "hermes"
CLIENT_ID = "hermes-app"
CLIENT_SECRET = "BQbxY0V6LaGcnpJnm60qyl3Wy5g1wXSw"  # ← Cambia esto

# Ruta del archivo de configuración
CONFIG_FILE = "frontend/administration/config.json"



@app.post("/api/keycloak/token")
async def keycloak_token(request: Request):
    """Proxy para intercambiar código por tokens (evita CORS)"""
    data = await request.json()
    
    # ✅ USAR EL MISMO redirect_uri que en auth.js
    redirect_uri = "http://localhost:5500/frontend/chat.html"
    response = requests.post(
        f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token",
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": data["code"],
            "redirect_uri": redirect_uri
        }
    )
    
    # ✅ AÑADIR LOGGING
    print("🔑 Respuesta de Keycloak:", response.status_code)
    print("📄 Body:", response.text)
    
    if not response.ok:
        print(f"❌ Error Keycloak: {response.status_code} - {response.text}")
        raise HTTPException(status_code=response.status_code, detail="Error de autenticación")
    
    return response.json()

@app.get("/api/config")
async def get_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        # Configuración por defecto
        return {
            "features": {
                "chatEnabled": True,
                "documentUploadEnabled": True,
                "moderationEnabled": False
            },
            "integrations": {
                "openaiApiKey": "",
                "storageProvider": "local",
                "ssoEndpoint": ""
            },
            "preferences": {
                "language": "es",
                "timezone": "mx",
                "weeklyReports": False
            }
        }

@app.post("/api/config")
async def save_config(request: Request):
    try:
        config = await request.json()
        # Asegurar que el directorio existe
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    



@app.get("/api/documents/list")
async def list_documents():
    """Lista todos los documentos con su metadata"""
    if not DOCS_DIR.exists():
        return []
    
    documents = []
    for meta_file in DOCS_DIR.glob("*.meta"):
        try:
            # Leer el archivo .meta.json
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            
            # Obtener nombre del archivo original
            filename = meta_file.stem.replace(".meta", "")
            
            # Obtener tamaño del archivo original
            original_file = DOCS_DIR / filename
            file_size = original_file.stat().st_size if original_file.exists() else 0
            
            documents.append({
                "filename": filename,
                "access_level": meta.get("access_level", "privado"),
                "owner_department": meta.get("owner_department", "General"),
                "content_hash": meta.get("content_hash", ""),
                "upload_date": meta.get("upload_date", ""),
                "file_size": file_size,
                "mime_type": meta.get("mime_type", "")
            })
        except Exception as e:
            print(f"Error leyendo {meta_file}: {e}")
            continue
    
    return documents

@app.get("/api/documents/{filename}/size")
async def get_file_size(filename: str):
    """Obtiene el tamaño de un archivo"""
    file_path = DOCS_DIR / filename
    if file_path.exists():
        return {"size": file_path.stat().st_size}
    return {"size": 0}

@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    """Elimina un documento y su metadata"""
    try:
        # Eliminar archivo original
        file_path = DOCS_DIR / filename
        if file_path.exists():
            file_path.unlink()
        
        # Eliminar archivo .meta.json
        meta_path = DOCS_DIR / f"{filename}.meta"
        if meta_path.exists():
            meta_path.unlink()
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/documents/upload")
async def upload_documents(
    files: list[UploadFile] = File(...), 
    metadata: str = Form(...)
):
    """Sube documentos y sus metadatos"""
    try:
        # Crear carpeta docs si no existe
        DOCS_DIR.mkdir(exist_ok=True)
        
        # Parsear metadata
        meta_list = json.loads(metadata)
        
        if len(files) != len(meta_list):
            raise HTTPException(status_code=400, detail="Número de archivos y metadatos no coincide")
        
        for file, meta in zip(files, meta_list):
            # Guardar archivo - ¡USAR DOCS_DIR, no DOCS_DIR!
            file_path = DOCS_DIR / file.filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            
            # Guardar metadata
            meta_path = DOCS_DIR / f"{file.filename}.meta"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2, ensure_ascii=False)
        
        return {"status": "success", "message": f"{len(files)} archivos subidos"}
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Metadata no es JSON válido")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivos: {str(e)}")
    


@app.get("/api/documents/{filename}/download")
async def download_document(filename: str):
    """
    Descarga un documento directamente como archivo, no como zip.
    """
    # 1. Validación de seguridad: evitar directory traversal
    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    
    # 2. Ruta al archivo
    file_path = DOCS_DIR / filename
    
    # 3. Verificar que existe
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    # 4. Obtener el tipo MIME correcto
    mime_types = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.xls': 'application/vnd.ms-excel',
        '.ppt': 'application/vnd.ms-powerpoint'
    }
    extension = Path(filename).suffix.lower()
    media_type = mime_types.get(extension, 'application/octet-stream')
    
    # 5. Devolver el archivo con headers correctos
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename  # Esto fuerza el nombre de descarga
    )


###### Chat RAG Endpoint
@app.post("/api/chat/query")
async def chat_query(request: Request):
    """Endpoint para consultar el RAG"""
    try:
        # Debug: Verificar que recibimos la petición
        print("📥 Recibida petición al endpoint /api/chat/query")
        
        data = await request.json()
        question = data.get("question", "")
        print(f"❓ Pregunta recibida: {question[:50]}...")
        
        if not question.strip():
            print("❌ Pregunta vacía")
            raise HTTPException(status_code=400, detail="Pregunta vacía")
        
        # Asegurar que estamos en el directorio correcto
        import os
        print(f"📁 Directorio actual: {os.getcwd()}")
        print(f"📄 Archivos en directorio: {os.listdir('.')}")
        
        # Importar rag_engine con manejo de errores detallado
        try:
            from rag_engine import query_rag
            print("✅ Módulo rag_engine importado correctamente")
        except Exception as import_error:
            print(f"❌ Error al importar rag_engine: {import_error}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail="Error al cargar el motor RAG")
        
        # Obtener departamento del usuario
        user_department = "[1014] Sistemas"
        print(f"👥 Departamento del usuario: {user_department}")
        
        # Ejecutar RAG
        import asyncio
        loop = asyncio.get_event_loop()
        print("🧠 Iniciando consulta RAG...")
        
        try:
            response, sources = await loop.run_in_executor(None, query_rag, question)
            print(f"✅ RAG completado. Fuentes: {len(sources)}")
        except Exception as rag_error:
            print(f"❌ Error en query_rag: {rag_error}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail="Error en el motor RAG")
        
        # Preparar respuesta
        from datetime import datetime
        result = {
            "response": response,
            "sources": sources,
            "timestamp": datetime.now().strftime("%H:%M")
        }
        print("📤 Enviando respuesta al cliente")
        return result
        
    except HTTPException:
        # Re-lanzar excepciones HTTP
        raise
    except Exception as e:
        # Capturar cualquier otro error
        print(f"💥 ERROR NO MANEJADO EN CHAT: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    """Endpoint para consultar el RAG"""
    try:
        data = await request.json()
        question = data.get("question", "")
        
        if not question.strip():
            raise HTTPException(status_code=400, detail="Pregunta vacía")
        
        print(f"🔍 Procesando pregunta: {question[:50]}...")
        
        # Obtener departamento del usuario (usa valor fijo por ahora)
        user_department = "[1014] Sistemas"
        
        # Importar aquí para ver errores de importación
        try:
            from rag_engine import query_rag
            print("✅ rag_engine importado correctamente")
        except ImportError as e:
            print(f"❌ Error al importar rag_engine: {e}")
            raise HTTPException(status_code=500, detail="Error al cargar el motor RAG")
        
        # Ejecutar RAG de forma asíncrona
        import asyncio
        loop = asyncio.get_event_loop()
        print("🧠 Consultando RAG...")
        response, sources = await loop.run_in_executor(None, query_rag, question)
        print(f"✅ Respuesta recibida: {response[:100]}...")
        
        return {
            "response": response,
            "sources": sources,
            "timestamp": datetime.now().strftime("%H:%M")
        }
        
    except Exception as e:
        print(f"❌ ERROR DETALLADO EN CHAT: {str(e)}")
        print(f"Tipo de error: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error interno del servidor")
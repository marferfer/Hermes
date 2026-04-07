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
import jwt  # ✅ AÑADE ESTA LÍNEA (requiere PyJWT instalado)

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

KEYCLOAK_ADMIN_CLIENT_ID = "hermes-backend"  # Cliente de servicio creado en Keycloak
KEYCLOAK_ADMIN_CLIENT_SECRET = "wPwl28rYsFNCJqNt7V3HQJVVOjdJgrw2"  # ⚠️ Reemplaza con tu secret real

# Ruta del archivo de configuración
CONFIG_FILE = Path(__file__).parent.parent / "frontend" / "administration" / "config.json"



@app.post("/api/keycloak/token")
async def keycloak_token(request: Request):
    """Proxy para intercambiar código por tokens (evita CORS)"""
    data = await request.json()
    
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
    
    print("🔑 Respuesta de Keycloak:", response.status_code)
    
    if not response.ok:
        print(f"❌ Error Keycloak: {response.status_code} - {response.text}")
        # ✅ DEVOLVER ERROR CLARO
        raise HTTPException(status_code=response.status_code, detail="Autenticación fallida")
    
    # ✅ VERIFICAR QUE HAY ACCESS_TOKEN
    token_data = response.json()
    if "access_token" not in token_data:
        raise HTTPException(status_code=400, detail="No se recibió access_token")
    
    return token_data

@app.get("/api/config")
async def get_config():
    if CONFIG_FILE.exists():
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
    # ✅ BUSCAR ARCHIVOS .meta (no .meta.json)
    for file_path in DOCS_DIR.iterdir():
        if (file_path.suffix in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
            and not file_path.name.endswith(".meta")):
            
            # ✅ CONSTRUIR RUTA .meta
            meta_path = file_path.with_suffix(file_path.suffix + ".meta")
            meta = {"access_level": "privado", "owner_department": "General", "owner_user": "unknown"}
            
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                except Exception as e:
                    print(f"Error leyendo {meta_path}: {e}")
            
            documents.append({
                "filename": file_path.name,
                "access_level": meta.get("access_level", "privado"),
                "owner_department": meta.get("owner_department", "General"),
                "owner_user": meta.get("owner_user", "unknown"),
                "content_hash": meta.get("content_hash", ""),
                "upload_date": meta.get("upload_date", ""),
                "file_size": file_path.stat().st_size,
                "mime_type": meta.get("mime_type", "")
            })
    
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
    """Elimina un documento y su metadata (.meta)"""
    try:
        file_path = DOCS_DIR / filename
        meta_path = file_path.with_suffix(file_path.suffix + ".meta")  # ✅ .meta
        
        deleted = False
        if file_path.exists():
            file_path.unlink()
            deleted = True
        
        if meta_path.exists():
            meta_path.unlink()
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/api/documents/upload")
async def upload_documents(
    request: Request,
    files: list[UploadFile] = File(...), 
    metadata: str = Form(...)
):
    """Sube documentos usando document_manager con .meta"""
    try:
        # Obtener username del token
        owner_user = "unknown"
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                import jwt
                decoded = jwt.decode(token, options={"verify_signature": False})
                owner_user = decoded.get("preferred_username", "unknown")
            except Exception as e:
                print(f"Error decodificando token: {e}")
        
        meta_list = json.loads(metadata)
        
        if len(files) != len(meta_list):
            raise HTTPException(status_code=400, detail="Número de archivos y metadatos no coincide")
        
        from document_manager import ensure_docs_dir, save_document, calculate_content_hash
        ensure_docs_dir()
        
        for file, meta in zip(files, meta_list):
            content = await file.read()
            content_hash = calculate_content_hash(content)
            
            save_document(
                filename=file.filename,
                content=content,
                access_level=meta.get("access_level", "privado"),
                owner_department=meta.get("owner_department", "General"),
                owner_user=owner_user,  # ✅ PASAR EL USERNAME REAL
                content_hash=content_hash
            )
        
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
    

def get_admin_token():
    """Obtiene token de administrador usando client credentials"""
    data = {
        'client_id': KEYCLOAK_ADMIN_CLIENT_ID,
        'client_secret': KEYCLOAK_ADMIN_CLIENT_SECRET,
        'grant_type': 'client_credentials'
    }
    response = requests.post(
        f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token",
        data=data
    )
    if response.status_code == 200:
        return response.json()['access_token']
    else:
        raise HTTPException(status_code=500, detail="Error al obtener token de administrador")


@app.put("/api/profile/update")
async def update_profile(request: Request):  # ✅ CAMBIADO A async def
    """
    Actualiza el perfil del usuario en Keycloak:
    - Nombre de usuario (preferred_username)
    - Roles (departamentos)
    - Contraseña (opcional)
    """
    # 1. Validar autenticación del usuario
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    user_token = auth_header.replace("Bearer ", "")
    
    # 2. Decodificar token para obtener username y sub
    try:
        decoded = jwt.decode(user_token, options={"verify_signature": False})
        current_username = decoded.get("preferred_username")
        user_sub = decoded.get("sub")
        if not current_username or not user_sub:
            raise HTTPException(status_code=400, detail="Token inválido - faltan campos")
    except Exception as e:
        print(f"Error al decodificar token: {e}")
        raise HTTPException(status_code=401, detail=f"Token inválido - {str(e)}")
    
    # 3. Parsear datos de la solicitud ✅ CORREGIDO
    try:
        data = await request.json()  # ✅ USAR ESTO EN LUGAR DE json.loads(request.body())
    except Exception as e:
        print(f"Error parsing JSON body: {e}")
        raise HTTPException(status_code=400, detail="JSON inválido en el cuerpo de la solicitud")
    
    new_username = data.get("username", current_username)
    departments = data.get("departments", [])
    current_password = data.get("currentPassword")
    new_password = data.get("newPassword")
    
    # 4. Verificar contraseña actual si se quiere cambiar contraseña
    if new_password and new_password.strip():
        if not current_password:
            raise HTTPException(status_code=400, detail="Se requiere la contraseña actual para cambiarla")
        
        verify_response = requests.post(
            f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "username": current_username,
                "password": current_password
            }
        )
        if verify_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    
    # 5. Obtener token de administrador
    try:
        admin_token = get_admin_token()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al autenticar con Keycloak Admin")
    
    # 6. Buscar usuario por username
    user_search = requests.get(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users",
        params={"username": current_username},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if user_search.status_code != 200 or not user_search.json():
        raise HTTPException(status_code=404, detail="Usuario no encontrado en Keycloak")
    
    user_id = user_search.json()[0]['id']
    
    # 7. Actualizar nombre de usuario (preferred_username)
    if new_username != current_username:
        user_data = requests.get(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        
        # ✅ CORREGIDO: usar user_data en lugar de current_
        if 'attributes' not in user_data or user_data['attributes'] is None:
            user_data['attributes'] = {}
        user_data['attributes']['preferred_username'] = [new_username]
        
        update_resp = requests.put(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=user_data
        )
        if update_resp.status_code != 204:
            raise HTTPException(status_code=500, detail="Error al actualizar nombre de usuario")
    
    # 8. Actualizar roles (departamentos)
    VALID_DEPARTMENTS = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"]
    current_roles = requests.get(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm",
        headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    
    current_dept_roles = [r for r in current_roles if r['name'] in VALID_DEPARTMENTS]
    roles_to_remove = [r for r in current_dept_roles if r['name'] not in departments]
    roles_to_add = [r for r in departments if r not in [cr['name'] for cr in current_dept_roles]]
    
    # Eliminar roles no seleccionados
    if roles_to_remove:
        requests.delete(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=roles_to_remove
        )
    
    # Agregar nuevos roles
    if roles_to_add:
        role_mappings = []
        for role_name in roles_to_add:
            role = requests.get(
                f"{KEYCLOAK_URL}/admin/realms/{REALM}/roles/{role_name}",
                headers={"Authorization": f"Bearer {admin_token}"}
            ).json()
            role_mappings.append(role)
        
        requests.post(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=role_mappings
        )
    
    # 9. Actualizar contraseña si se proporcionó
    if new_password:
        password_data = {
            "type": "password",
            "value": new_password,
            "temporary": False
        }
        pwd_resp = requests.put(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/reset-password",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=password_data
        )
        if pwd_resp.status_code != 204:
            raise HTTPException(status_code=500, detail="Error al actualizar contraseña")
    
    return {
        "status": "success",
        "message": "Perfil actualizado correctamente",
        "passwordChanged": bool(new_password)
    }

#############################################################################################################################################
############################################################ ADMIN USERS ENDPOINTS ##########################################################
#############################################################################################################################################

@app.put("/api/profile/update")
async def update_profile(request: Request):
    """
    Actualiza el perfil del usuario en Keycloak:
    - Nombre de usuario (preferred_username)
    - Roles (departamentos)
    - Contraseña (opcional)
    """
    # 1. Validar autenticación del usuario
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    user_token = auth_header.replace("Bearer ", "")
    
    # 2. Decodificar token para obtener username y sub
    try:
        decoded = jwt.decode(user_token, options={"verify_signature": False})
        current_username = decoded.get("preferred_username")
        user_sub = decoded.get("sub")
        if not current_username or not user_sub:
            raise HTTPException(status_code=400, detail="Token inválido - faltan campos")
    except Exception as e:
        print(f"Error al decodificar token: {e}")
        raise HTTPException(status_code=401, detail=f"Token inválido - {str(e)}")
    
    # 3. Parsear datos de la solicitud
    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="JSON inválido")
    
    new_username = data.get("username", current_username)
    departments = data.get("departments", [])
    current_password = data.get("currentPassword")
    new_password = data.get("newPassword")
    
    # 4. Verificar contraseña actual si se quiere cambiar contraseña
    if new_password and new_password.strip():
        if not current_password:
            raise HTTPException(status_code=400, detail="Se requiere la contraseña actual para cambiarla")
        
        verify_response = requests.post(
            f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "username": current_username,
                "password": current_password
            }
        )
        if verify_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    
    # 5. Obtener token de administrador
    try:
        admin_token = get_admin_token()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al autenticar con Keycloak Admin")
    
    # 6. Buscar usuario por username
    user_search = requests.get(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users",
        params={"username": current_username},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if user_search.status_code != 200 or not user_search.json():
        raise HTTPException(status_code=404, detail="Usuario no encontrado en Keycloak")
    
    user_id = user_search.json()[0]['id']
    
    # 7. Actualizar nombre de usuario (preferred_username)
    if new_username != current_username:
        user_data = requests.get(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        
        # ✅ CORREGIDO: usar user_data en lugar de current_
        if 'attributes' not in user_data or user_data['attributes'] is None:
            user_data['attributes'] = {}
        user_data['attributes']['preferred_username'] = [new_username]
        
        update_resp = requests.put(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=user_data
        )
        if update_resp.status_code != 204:
            raise HTTPException(status_code=500, detail="Error al actualizar nombre de usuario")
    
    # 8. Actualizar roles (departamentos)
    VALID_DEPARTMENTS = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"]
    current_roles = requests.get(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm",
        headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    
    current_dept_roles = [r for r in current_roles if r['name'] in VALID_DEPARTMENTS]
    roles_to_remove = [r for r in current_dept_roles if r['name'] not in departments]
    roles_to_add = [r for r in departments if r not in [cr['name'] for cr in current_dept_roles]]
    
    # Eliminar roles no seleccionados
    if roles_to_remove:
        requests.delete(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=roles_to_remove
        )
    
    # Agregar nuevos roles
    if roles_to_add:
        role_mappings = []
        for role_name in roles_to_add:
            role = requests.get(
                f"{KEYCLOAK_URL}/admin/realms/{REALM}/roles/{role_name}",
                headers={"Authorization": f"Bearer {admin_token}"}
            ).json()
            role_mappings.append(role)
        
        requests.post(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=role_mappings
        )
    
    # 9. Actualizar contraseña si se proporcionó
    if new_password:
        password_data = {
            "type": "password",
            "value": new_password,
            "temporary": False
        }
        pwd_resp = requests.put(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/reset-password",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json=password_data
        )
        if pwd_resp.status_code != 204:
            raise HTTPException(status_code=500, detail="Error al actualizar contraseña")
    
    return {
        "status": "success",
        "message": "Perfil actualizado correctamente",
        "passwordChanged": bool(new_password)
    }

# Obtener lista de usuarios (requiere rol admin)
@app.get("/api/admin/users")
async def get_users(request: Request):
    # 1. Validar autenticación
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = auth_header.replace("Bearer ", "")
    
    # 2. Verificar rol admin en el token
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        roles = decoded.get('realm_access', {}).get('roles', [])
        if 'admin' not in roles:
            raise HTTPException(status_code=403, detail="Acceso denegado: se requiere rol 'admin'")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    # 3. Obtener token de administrador para Keycloak
    try:
        admin_token = get_admin_token()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al autenticar con Keycloak Admin: {str(e)}")
    
    # 4. Obtener lista de usuarios desde Keycloak
    try:
        response = requests.get(
            f"{KEYCLOAK_URL}/admin/realms/{REALM}/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Error Keycloak: {response.text}")
        
        users = response.json()
        
        # 5. Enriquecer con información adicional
        enriched_users = []
        for user in users:
            # Obtener departamento desde atributos
            department = "Sin departamento"
            if user.get('attributes', {}).get('department'):
                department = user['attributes']['department'][0]
            
            # Obtener roles
            roles_response = requests.get(
                f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user['id']}/role-mappings/realm",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            user_roles = []
            if roles_response.status_code == 200:
                roles_data = roles_response.json()
                user_roles = [r['name'] for r in roles_data]
            
            enriched_users.append({
                "id": user['id'],
                "username": user.get('username', ''),
                "firstName": user.get('firstName', ''),
                "lastName": user.get('lastName', ''),
                "email": user.get('email', ''),
                "enabled": user.get('enabled', False),
                "attributes": {
                    "department": [department]
                },
                "realmRoles": user_roles,
                "lastLogin": None  # Keycloak no proporciona esto por defecto
            })
        
        return enriched_users
        
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Keycloak no está disponible. Verifica la conexión.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener usuarios: {str(e)}")
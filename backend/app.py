# backend/app.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import json

app = FastAPI()

# Permitir CORS desde tu frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081"],
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
    
    response = requests.post(
        f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token",
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": data["code"],
            "redirect_uri": "http://localhost:8081/"
        }
    )
    
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
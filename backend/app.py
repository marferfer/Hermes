# backend/app.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import os

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
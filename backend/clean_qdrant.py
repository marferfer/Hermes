# backend/clean_qdrant.py
from qdrant_client import QdrantClient

client = QdrantClient(url="http://localhost:6333", check_compatibility=False)
try:
    client.delete_collection("hermes_docs")
    print("Colección 'hermes_docs' eliminada")
except Exception as e:
    print(f"Colección no existía o error: {e}")
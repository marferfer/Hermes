# backend/check_qdrant.py
from qdrant_client import QdrantClient

client = QdrantClient(url="http://localhost:6333", check_compatibility=False)

try:
    collections = client.get_collections()
    print("Colecciones:", [c.name for c in collections.collections])
    
    info = client.get_collection("hermes_docs")
    print(f"Puntos en colección: {info.points_count}")
    
except Exception as e:
    print(f"Error: {e}")
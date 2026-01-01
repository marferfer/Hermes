# reset_qdrant.py
from qdrant_client import QdrantClient

client = QdrantClient(url="http://localhost:6333", check_compatibility=False)

# Eliminar colección existente
try:
    client.delete_collection("hermes_docs")
    print("✅ Colección 'hermes_docs' eliminada")
except Exception as e:
    print(f"ℹ️  Colección no existía: {e}")

# Crear colección con configuración correcta
from qdrant_client.http import models as rest

client.create_collection(
    collection_name="hermes_docs",
    vectors_config=rest.VectorParams(
        size=384,  # Tamaño de all-MiniLM-L6-v2
        distance=rest.Distance.COSINE,
        on_disk=True  # Opcional: guarda vectores en disco para ahorrar RAM
    )
)

# Crear índices para metadatos (¡importante para el rendimiento!)
client.create_payload_index(
    collection_name="hermes_docs",
    field_name="access_level",
    field_schema=rest.PayloadSchemaType.KEYWORD
)
client.create_payload_index(
    collection_name="hermes_docs",
    field_name="owner_department",
    field_schema=rest.PayloadSchemaType.KEYWORD
)

print("✅ Colección 'hermes_docs' creada con configuración correcta")
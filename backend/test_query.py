# test_query.py
import sys
sys.path.append('src')
from rag_engine import query_rag

response, sources = query_rag("¿Qué documentos hay?", user_department="[1014] Sistemas")
print("Respuesta:", response)
print("Fuentes:", sources)
# backend/test_rag.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from rag_engine import query_rag

def test():
    try:
        print("Probando RAG directamente...")
        response, sources = query_rag("¿Qué contiene el documento RECETAS_DE_COCINA.docx?")
        print(f"Respuesta: {response}")
        print(f"Fuentes: {sources}")
    except Exception as e:
        print(f"Error en RAG: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
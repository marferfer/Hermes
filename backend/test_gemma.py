# backend/test_gemma.py
from llama_index.llms.ollama import Ollama

try:
    print("Probando gemma:2b-instruct-q8_0...")
    llm = Ollama(model="gemma:2b-instruct-q8_0", temperature=0.1, request_timeout=120.0)
    response = llm.complete("Hola, ¿cómo estás?")
    print(f"✅ Respuesta: {response}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
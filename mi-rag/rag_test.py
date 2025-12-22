from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.ollama import Ollama
import logging

# Opcional: ver qué hace por detrás
logging.basicConfig(level=logging.INFO)

# 1. Cargar documentos desde la carpeta 'docs'
print("Cargando documentos...")
documents = SimpleDirectoryReader("docs").load_data()
print(f"✅ Cargados {len(documents)} fragmentos.")

# 2. Modelo de embeddings local (español + inglés)
print("Iniciando modelo de embeddings (BAAI/bge-m3)...")
embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-m3")

# 3. LLM local (Llama 3)
print("Conectando con Ollama (Llama 3)...")
llm = Ollama(model="llama3", temperature=0.1, request_timeout=120.0)

# 4. Crear índice vectorial
print("Creando índice vectorial...")
index = VectorStoreIndex.from_documents(documents, embed_model=embed_model)

# 5. Motor de preguntas
print("¡Listo! Escribe tu pregunta (o 'salir' para terminar).")
query_engine = index.as_query_engine(llm=llm, streaming=False)

while True:
    question = input("\n❓ Pregunta: ").strip()
    if question.lower() in ["salir", "exit", "quit"]:
        break
    response = query_engine.query(question)
    print(f"\n💬 Respuesta:\n{response}")
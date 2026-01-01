import os
import subprocess
import sys

def run_cmd(cmd, cwd=None):
    """Ejecuta un comando y muestra su salida en tiempo real."""
    print(f"\n🔷 Ejecutando: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, shell=True, text=True)
    if result.returncode != 0:
        print(f"❌ Error al ejecutar: {' '.join(cmd)}")
        sys.exit(1)
    return result

def main():
    print("🚀 Instalador automático para Hermes RAG")
    print("Este script creará un entorno virtual y hará todas las instalaciones necesarias.\n")

    # 1. Verificar que Python sea 3.10+
    if sys.version_info < (3, 10):
        print("❌ Se requiere Python 3.10 o superior. Tienes:", sys.version)
        sys.exit(1)

    # 2. Eliminar venv antiguo (opcional, para empezar limpio)
    if os.path.exists("venv"):
        print("🗑️  Eliminando entorno virtual antiguo...")
        import shutil
        shutil.rmtree("venv")

    # 3. Crear entorno virtual
    print("🛠️  Creando entorno virtual 'venv'...")
    run_cmd([sys.executable, "-m", "venv", "venv"])

    # 4. Instalar paquetes (usando el pip del entorno virtual)
    pip_path = os.path.join("venv", "Scripts", "pip.exe")
    python_path = os.path.join("venv", "Scripts", "python.exe")

    # Actualizar pip
    run_cmd([python_path, "-m", "pip", "install", "--upgrade", "pip"])

    import os
import subprocess
import sys

def run_cmd(cmd, cwd=None):
    print(f"\n🔷 Ejecutando: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, shell=True, text=True)
    if result.returncode != 0:
        print(f"❌ Error al ejecutar: {' '.join(cmd)}")
        sys.exit(1)
    return result

def main():
    print("🚀 Instalador automático para Hermes RAG (versión Ollama)")
    print("Este script creará un entorno virtual y hará las instalaciones necesarias.\n")

    if sys.version_info < (3, 10):
        print("❌ Se requiere Python 3.10 o superior. Tienes:", sys.version)
        sys.exit(1)

    # Eliminar venv antiguo
    if os.path.exists("venv"):
        print("🗑️  Eliminando entorno virtual antiguo...")
        import shutil
        shutil.rmtree("venv")

    # Crear entorno virtual
    print("🛠️  Creando entorno virtual 'venv'...")
    run_cmd([sys.executable, "-m", "venv", "venv"])

    python_path = os.path.join("venv", "Scripts", "python.exe")

    # Actualizar pip
    run_cmd([python_path, "-m", "pip", "install", "--upgrade", "pip"])

    # Paquetes SIN llama-cpp-python
    packages = [
        "streamlit",
        "llama-index>=0.10.0",
        "llama-index-embeddings-huggingface",
        "llama-index-llms-ollama",      # 👈 Solo Ollama
        "unstructured[local-inference]",
        "sentence-transformers",
        "torch",                        # necesario para BGE-M3
        "qdrant-client",
        "python-dotenv",
    ]

    print("\n📦 Instalando paquetes (sin compilación pesada)...")
    run_cmd([python_path, "-m", "pip", "install"] + packages)

    print("\n✅ ¡Instalación completada!")
    print("\n📌 Siguientes pasos:")
    print("1. Activa el entorno: .\\venv\\Scripts\\Activate.ps1")
    print("2. (Opcional) Descarga un modelo Llama 3:")
    print("   - Con Ollama: ollama pull llama3")
    print("   - Con GGUF: ejecuta download_model.py")
    print("3. Ejecuta la app: python -m streamlit run app.py")

if __name__ == "__main__":
    main()
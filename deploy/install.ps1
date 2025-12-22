# deploy/install.ps1
Write-Host "🚀 Instalando Hermes - Sistema de Conocimiento Corporativo" -ForegroundColor Cyan

# 1. Verificar Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python no encontrado. Por favor instala Python 3.10+ desde https://python.org" -ForegroundColor Red
    exit 1
}

# 2. Crear entorno virtual
Write-Host "🔄 Creando entorno virtual..." -ForegroundColor Yellow
python -m venv hermes-env

# 3. Activar y actualizar pip
Write-Host "📥 Instalando dependencias..." -ForegroundColor Yellow
hermes-env\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ..\src\requirements.txt

# 4. Descargar modelo phi3
Write-Host "🧠 Descargando modelo phi3..." -ForegroundColor Yellow
ollama pull phi3

# 5. Crear carpetas de datos
New-Item -ItemType Directory -Path "..\data\qdrant" -Force | Out-Null
New-Item -ItemType Directory -Path "..\docs" -Force | Out-Null

# 6. Mensaje final
Write-Host ""
Write-Host "✅ ¡Instalación completada!" -ForegroundColor Green
Write-Host "Para iniciar la aplicación:" -ForegroundColor White
Write-Host "   hermes-env\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "   cd ..\src" -ForegroundColor Gray
Write-Host "   streamlit run app.py" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 Documentos se guardarán en: ..\docs" -ForegroundColor Cyan
Write-Host "💾 Datos de Qdrant en: ..\data\qdrant" -ForegroundColor Cyan
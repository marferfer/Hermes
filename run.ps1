# # run.ps1
# Write-Host "🚀 Iniciando Hermes..."

# # 1. Activar entorno virtual (para el backend)
# .\venv\Scripts\Activate.ps1

# # 2. Iniciar el backend (FastAPI) en segundo plano
# Start-Process powershell -ArgumentList "-Command", "cd '$(Get-Location)'; uvicorn backend.app:app --port 8000"

# # 3. Ir a la carpeta frontend y servir la SPA
# Set-Location -Path "frontend"
# Write-Host '📡 Sirviendo frontend en http://localhost:8081'
# Start-Process 'http://localhost:8081'

# # 4. Iniciar el servidor estático (esto bloqueará la terminal)
# serve -s -l 8081

# run.ps1
Write-Host "🚀 Iniciando Hermes (modo desarrollo: SIN autenticación)..."

# Iniciar el backend
Start-Process powershell -ArgumentList "-Command", "cd '$(Get-Location)'; uvicorn backend.app:app --port 8000"

# Ir a frontend y servir
Set-Location -Path "frontend"
Write-Host '📡 Sirviendo frontend en http://localhost:8081'
Start-Process 'http://localhost:8081/chat.html'  # ← Abre DIRECTAMENTE el chat
serve -s -l 8081
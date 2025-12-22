@echo off
cd /d "%~dp0\..\..\qdrant"
echo 🗃️ Iniciando Qdrant en http://localhost:6333
.\qdrant.exe --uri http://0.0.0.0:6333 --storage-snapshot-interval-sec 60
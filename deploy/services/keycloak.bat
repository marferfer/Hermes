@echo off
cd /d "%~dp0\..\..\keycloak-24.0.5"
echo 🌐 Iniciando Keycloak en http://localhost:8080
.\bin\kc.bat start-dev
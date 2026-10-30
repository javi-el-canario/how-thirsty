@echo off
cd /d "%~dp0"
echo Abriendo http://localhost:8080 (cierra esta ventana para parar el servidor)
start "" http://localhost:8080
python server.py 8080


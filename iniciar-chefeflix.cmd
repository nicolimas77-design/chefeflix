@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp0'"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

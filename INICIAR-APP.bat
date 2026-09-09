@echo off
echo.
echo  ========================================
echo   LavaderoCF -- Iniciando servidor local
echo  ========================================
echo.
echo  Abriendo en: http://localhost:3000
echo  Presiona Ctrl+C para cerrar el servidor.
echo.
cd /d "%~dp0"
npx serve . --listen 3000
pause

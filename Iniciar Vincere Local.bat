@echo off
title Vincere Studio - Local
echo ========================================================
echo   Iniciando Vincere Studio (Modo Local Completo)
echo ========================================================
echo.
cd /d "%~dp0"
echo Verificando dependencias e configuracao...
call pnpm run dev
pause

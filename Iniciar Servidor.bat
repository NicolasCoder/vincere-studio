@echo off
cd /d "%~dp0"
title PulseStudio - Servidor
echo Iniciando PulseStudio (web + worker)...
echo.
call pnpm dev
pause

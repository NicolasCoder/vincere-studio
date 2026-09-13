@echo off
title Remotion Studio - Editor-IA
cd /d "%~dp0"
echo Abrindo o Remotion Studio do Editor-IA...
echo (esta janela precisa ficar aberta enquanto voce estiver editando)
echo.
call npx remotion studio --port=3001
pause

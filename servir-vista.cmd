@echo off
rem Mantém o Vincere (build de produção) de pé em http://localhost:3210; reinicia sozinho se cair.
cd /d C:\dev\vincere-validacao\apps\web
set DATABASE_URL=file:C:/dev/vincere-validacao/vista.db
:loop
call pnpm start >> C:\dev\vincere-validacao\web.log 2>&1
timeout /t 3 /nobreak >nul
goto loop

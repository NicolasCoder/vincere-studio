# Console Admin do Vincere Studio — só no seu PC, fora da web. Mostra a saúde da VPS e roda as rotinas
# de manutenção por SSH. Nada daqui fica exposto no navegador; chaves do .env aparecem sem o valor.
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$Key  = "$env:USERPROFILE\.ssh\claude_vps_ed25519"
$Alvo = "root@143.95.167.129"
$App  = "/opt/vincere-studio"

# Roda um script bash na VPS. Os textos usam @@APP@@ no lugar da pasta do app (here-strings simples, sem escapes).
function Invoke-Vps([string]$script) {
  # Envia o script por arquivo (LF puro): o pipe do PowerShell acrescenta CRLF e o bash da VPS tropeça.
  $limpo = ($script -replace "`r", "").Replace("@@APP@@", $App)
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, $limpo + "`n", (New-Object Text.UTF8Encoding($false)))
    & cmd.exe /c "ssh -p 22022 -i `"$Key`" -o BatchMode=yes -o ServerAliveInterval=30 $Alvo bash -s < `"$tmp`""
  } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}
function Confirmar([string]$texto) { (Read-Host "$texto (s/N)") -match '^(s|S|y|Y)' }
function Pausar { Write-Host ""; [void](Read-Host "Enter para voltar ao menu") }

function Saude {
  Invoke-Vps @'
echo "== Servidor"; uptime -p; echo "carga: $(cut -d' ' -f1-3 /proc/loadavg)  núcleos: $(nproc)"
free -h | awk 'NR==2 {print "memória: usada " $3 " de " $2 " (livre " $7 ")"}'
df -h / | awk 'NR==2 {print "disco: " $3 " usados de " $2 " (" $5 "), livres " $4}'
echo; echo "== Serviços (pm2)"
pm2 jlist 2>/dev/null | python3 -c "
import sys,json
for p in json.load(sys.stdin):
    e=p['pm2_env']; print('%-16s %-8s reinicios=%-3s mem=%sMB' % (p['name'], e['status'], e['restart_time'], p['monit']['memory']//1048576))"
echo; echo "== Docker"; docker ps --format '{{.Names}}  {{.Status}}' 2>/dev/null
echo; echo "== Portas do Vincere (escuta)"; ss -ltn | awk 'NR>1 && ($4 ~ /:(3210|3010|3900)$/) {print $4}'
echo; echo "== Dados"; du -sh @@APP@@/storage 2>/dev/null | awk '{print "storage: " $1}'
ls -lh @@APP@@/storage/*.db 2>/dev/null | awk '{print "banco: " $9 " " $5}'
echo; echo "== Último erro do web/worker"
for n in vincere-web vincere-worker; do tail -n 40 /root/.pm2/logs/$n-error.log 2>/dev/null | grep -i -m1 -E 'error|fail' | cut -c1-160; done
'@
}

function Logs {
  Invoke-Vps "pm2 logs vincere-web vincere-worker --nostream --lines 25 2>&1 | tail -n 90"
}

function Limpeza {
  Invoke-Vps "bash @@APP@@/scripts/cleanup-vps.sh"
}

function Backup-Banco {
  Invoke-Vps @'
set -e
mkdir -p /root/backups
f=/root/backups/db-$(date +%Y%m%d-%H%M%S).db
python3 -c "import sqlite3,sys;s=sqlite3.connect('@@APP@@/storage/docupulse.db');d=sqlite3.connect(sys.argv[1]);s.backup(d);d.close()" "$f"
echo "backup: $f ($(du -h "$f" | cut -f1))"
'@
}

function Compactar {
  if (-not (Confirmar "Vai parar o web e o worker por alguns segundos para compactar o banco. Continuar?")) { return }
  Invoke-Vps @'
set -e
mkdir -p /root/backups
f=/root/backups/pre-compactar-$(date +%Y%m%d-%H%M%S).db
pm2 stop vincere-web vincere-worker >/dev/null
trap 'pm2 start vincere-web vincere-worker >/dev/null' EXIT
antes=$(stat -c %s @@APP@@/storage/docupulse.db)
python3 -c "
import sqlite3,sys
s=sqlite3.connect('@@APP@@/storage/docupulse.db'); d=sqlite3.connect(sys.argv[1]); s.backup(d); d.close()
s.execute('PRAGMA wal_checkpoint(TRUNCATE)'); s.execute('VACUUM'); s.close()" "$f"
depois=$(stat -c %s @@APP@@/storage/docupulse.db)
echo "banco: $((antes/1024)) KB -> $((depois/1024)) KB (backup em $f)"
find @@APP@@/storage -type d -name work -mmin +720 -prune -exec rm -rf {} + 2>/dev/null || true
echo "pastas work antigas removidas; os serviços voltam ao sair."
'@
}

function Chaves {
  Write-Host "Chaves do .env da VPS (só se estão preenchidas; os valores nunca aparecem):"
  Invoke-Vps @'
awk -F= '/^[A-Z0-9_]+=/ { v=substr($0, index($0,"=")+1); gsub(/"/,"",v); printf "%-28s %s\n", $1, (length(v)>0 ? "preenchida" : "VAZIA") }' @@APP@@/.env
'@
}

function Atualizar-HyperFrames {
  if (-not (Confirmar "Atualizar o HyperFrames instalado na VPS para a última versão?")) { return }
  Invoke-Vps "hyperframes --version; npm install -g hyperframes@latest 2>&1 | tail -n 3; hyperframes --version; (pm2 describe vincere-hf >/dev/null 2>&1 && pm2 restart vincere-hf 2>&1 | tail -n 3) || echo 'sem servico vincere-hf na VPS (o preview roda no PC)'"
}

function Reiniciar {
  if (-not (Confirmar "Reiniciar web e worker da VPS?")) { return }
  Invoke-Vps "pm2 restart vincere-web vincere-worker --update-env 2>&1 | tail -n 8"
}

$sair = $false
while (-not $sair) {
  Clear-Host
  Write-Host "=== Console Admin — Vincere Studio ===" -ForegroundColor Cyan
  Write-Host " 1  Saúde da VPS"
  Write-Host " 2  Logs recentes"
  Write-Host " 3  Rotina de limpeza"
  Write-Host " 4  Compactar (backup + VACUUM do banco + pastas work antigas)"
  Write-Host " 5  Backup do banco"
  Write-Host " 6  Chaves do .env (só quais estão preenchidas)"
  Write-Host " 7  Atualizar o HyperFrames"
  Write-Host " 8  Reiniciar serviços"
  Write-Host " 0  Sair"
  switch (Read-Host "Escolha") {
    "1" { Saude; Pausar }
    "2" { Logs; Pausar }
    "3" { Limpeza; Pausar }
    "4" { Compactar; Pausar }
    "5" { Backup-Banco; Pausar }
    "6" { Chaves; Pausar }
    "7" { Atualizar-HyperFrames; Pausar }
    "8" { Reiniciar; Pausar }
    "0" { $sair = $true }
  }
}

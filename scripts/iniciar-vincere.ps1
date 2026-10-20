# Sobe, no PC, tudo que o Vincere Studio (rodando na VPS) precisa — sem duplicar nada.
# Cada serviço só é iniciado se a porta dele ainda não estiver ocupada.
#   3210  túnel SSH: web da VPS no PC + repassa 3010/9334 do PC para a VPS
#   3010  HyperFrames preview (C:\Users\Igor\Videos-HF)
#   9334  Flow Studio daemon
#   LAN   acesso pelo celular em http://<IP-do-PC>:3210
$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent

function Test-Port([int]$port) {
  [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Start-Hidden([string]$file, [string]$arguments, [string]$cwd) {
  Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $cwd -WindowStyle Hidden | Out-Null
}

if (-not (Test-Port 3010)) {
  Write-Host "Iniciando HyperFrames (3010)..."
  Start-Hidden "cmd.exe" "/c npx hyperframes preview --foreground --port 3010 --no-open --no-browser-gpu" "C:\Users\Igor\Videos-HF"
} else { Write-Host "HyperFrames (3010) ja ativo." }

if (-not (Test-Port 9334)) {
  Write-Host "Iniciando Flow Studio daemon (9334)..."
  Start-Hidden "python.exe" "flow_queue_daemon.py" "C:\Users\Igor\flow-studio-mcp"
} else { Write-Host "Flow daemon (9334) ja ativo." }

# Só o 127.0.0.1 conta: o lan-proxy também escuta 3210 (no IP da rede) e mascararia um túnel caído.
if (-not (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host "Abrindo tunel SSH com a VPS (3210)..."
  Start-Hidden "ssh.exe" "-p 22022 -i C:/Users/Igor/.ssh/claude_vps_ed25519 -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -L 3210:127.0.0.1:3210 -R 9334:127.0.0.1:9334 -R 3010:127.0.0.1:3010 root@143.95.167.129" $repo
} else { Write-Host "Tunel (3210) ja ativo." }

$lan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -First 1 -ExpandProperty IPAddress
if ($lan -and -not (Get-NetTCPConnection -LocalAddress $lan -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host "Liberando acesso pelo celular..."
  Start-Hidden "node.exe" "scripts\lan-proxy.mjs" $repo
}

Write-Host ""
Write-Host "Pronto. No PC:      http://localhost:3210"
if ($lan) { Write-Host "No celular (Wi-Fi): http://${lan}:3210" }

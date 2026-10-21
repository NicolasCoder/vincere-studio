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

# A ponte de GPU nao inicia sem PC_GPU_TOKEN. Le do .env; se nao existir, gera um e grava la
# (o Vincere le o mesmo .env). Na VPS, coloque o mesmo valor no .env dela (scripts/env-vps.sh).
$envFile = Join-Path $repo ".env"
$tokenLinha = if (Test-Path $envFile) { Select-String -Path $envFile -Pattern '^PC_GPU_TOKEN="?([^"\r\n]+)' | Select-Object -First 1 } else { $null }
if ($tokenLinha) { $env:PC_GPU_TOKEN = $tokenLinha.Matches[0].Groups[1].Value }
else {
  $rb = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($rb); $env:PC_GPU_TOKEN = (($rb | ForEach-Object { $_.ToString('x2') }) -join '')
  Add-Content -Path $envFile -Value ("PC_GPU_TOKEN=`"" + $env:PC_GPU_TOKEN + "`"")
  Write-Host "PC_GPU_TOKEN gerado e salvo no .env (copie o mesmo valor para o .env da VPS)."
}
if (-not (Test-Port 9335)) {
  Write-Host "Iniciando PC GPU Bridge (9335 - RTX 3060 / RVC V2 / Whisper CUDA / Sharingan Qwen2.5-VL)..."
  Start-Hidden "python.exe" "scripts\pc-gpu-bridge.py --serve --port 9335" $repo
} else { Write-Host "PC GPU Bridge (9335) ja ativo." }

# Só o 127.0.0.1 conta: o lan-proxy também escuta 3210 (no IP da rede) e mascararia um túnel caído.
if (-not (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host "Abrindo tunel SSH com a VPS (3210 + repasse GPU 9335)..."
  Start-Hidden "ssh.exe" "-p 22022 -i C:/Users/Igor/.ssh/claude_vps_ed25519 -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -L 3210:127.0.0.1:3210 -R 9334:127.0.0.1:9334 -R 9335:127.0.0.1:9335 -R 3010:127.0.0.1:3010 root@143.95.167.129" $repo
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

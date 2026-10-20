# Operações do HyperFrames no PC que o Vincere Studio (na VPS) não consegue fazer sozinho.
#   hf.ps1 previa   -Projeto nike-história               → render rascunho, versão leve p/ celular, envia ao Vincere
#   hf.ps1 template -Projeto nike-história -Nome dossie-nike -Nicho dossie
#   hf.ps1 novo     -Nome misterio-area-51 [-Template dossie-nike]
# Projetos e templates ficam no C: (Videos-HF); a VPS só recebe a prévia leve e os metadados.
param(
  [Parameter(Mandatory = $true, Position = 0)][ValidateSet("previa", "template", "novo")][string]$Acao,
  [string]$Projeto,
  [string]$Nome,
  [string]$Template,
  [string]$Nicho = "",
  # previa: renderizar no PC em vez da VPS (só com memória sobrando).
  [switch]$Local
)
$ErrorActionPreference = "Stop"
$Base = "C:\Users\Igor\Videos-HF"
$Templates = Join-Path $Base "_templates"
$Key = "C:/Users/Igor/.ssh/claude_vps_ed25519"
$VpsHost = "root@143.95.167.129"
$VpsStorage = "/opt/vincere-studio/storage/hyperframes"
$Ssh = @("-p", "22022", "-i", $Key, "-o", "ServerAliveInterval=30")

function Enviar([string]$local, [string]$remotoDir) {
  & ssh @Ssh $VpsHost "mkdir -p '$remotoDir'"
  if ($LASTEXITCODE) { throw "Não consegui criar $remotoDir na VPS" }
  & scp -P 22022 -i $Key -q $local "${VpsHost}:$remotoDir/"
  if ($LASTEXITCODE) { throw "Falha ao enviar $local" }
}

# Pastas pesadas ou geradas que nunca vão para template.
$Excluir = @("renders", "brolls", ".getbrolls-sources", ".waveform-cache", ".thumbnails", "__pycache__", "node_modules", ".hyperframes")

switch ($Acao) {
  "previa" {
    $dir = Join-Path $Base $Projeto
    if (-not (Test-Path $dir)) { throw "Projeto não encontrado: $dir" }
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $leve = Join-Path $env:TEMP "previa-$Projeto-$ts.mp4"
    if ($Local) {
      # Só com RAM sobrando: o render abre vários Chrome no PC.
      $bruto = Join-Path $dir "renders\previa-$ts.mp4"
      Write-Host "Render rascunho NO PC (24fps, 2 workers) de $Projeto..."
      Push-Location $dir
      try {
        & npx hyperframes render --quality draft --fps 24 --workers 2 --quiet -o $bruto
        if ($LASTEXITCODE) { throw "Render da prévia falhou" }
      } finally { Pop-Location }
    } else {
      # Padrão: renderiza na VPS (8 núcleos, ~25 GB livres) e o MP4 volta para renders\.
      Write-Host "Render rascunho NA VPS de $Projeto (o PC fica livre)..."
      & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Base "_tools\render-vps.ps1") -Projeto $Projeto -Qualidade draft -SemJanela
      $bruto = Join-Path $dir "renders\$Projeto-draft.mp4"
      if (-not (Test-Path $bruto)) { throw "O render na VPS não devolveu $bruto" }
    }
    # Versão para celular: metade da resolução, arquivo pequeno para abrir pelo Wi-Fi/4G.
    & ffmpeg -hide_banner -loglevel error -y -i $bruto -vf "scale=-2:'min(960,ih)'" -c:v libx264 -preset veryfast -crf 30 -c:a aac -b:a 96k -movflags +faststart $leve
    if ($LASTEXITCODE) { throw "Compressão da prévia falhou" }
    Enviar $leve "$VpsStorage/$Projeto/previas"
    Remove-Item $leve -Force
    Write-Host "Prévia enviada: $Projeto/previas/$(Split-Path $leve -Leaf). Original em $bruto"
  }

  "template" {
    $dir = Join-Path $Base $Projeto
    if (-not (Test-Path $dir)) { throw "Projeto não encontrado: $dir" }
    if (-not $Nome) { throw "Informe -Nome do template" }
    $destino = Join-Path $Templates $Nome
    if (Test-Path $destino) { throw "Já existe um template chamado $Nome" }
    New-Item -ItemType Directory -Force $destino | Out-Null
    & robocopy $dir $destino /E /XD @Excluir /XF "*.mp4" "*.wav" "*.mp3" "_*.log" /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar o projeto para o template" }
    $meta = [ordered]@{
      nome      = $Nome
      nicho     = $Nicho
      origem    = $Projeto
      criadoEm  = (Get-Date).ToString("s")
      formato   = (Get-Content (Join-Path $dir "index.html") -Raw | Select-String 'data-width="(\d+)"[^>]*data-height="(\d+)"' | ForEach-Object { "$($_.Matches[0].Groups[1].Value)x$($_.Matches[0].Groups[2].Value)" })
    }
    @"
# Template: $Nome

Criado a partir de **$Projeto** em $($meta.criadoEm). Nicho: $Nicho.

Mantém composições, estilo, tokens e componentes. Sem narração, B-rolls nem renders:
num projeto novo, troque o roteiro (roteiro.txt / STORYBOARD.md), gere a voz e as mídias.
"@ | Set-Content -Encoding utf8 (Join-Path $destino "TEMPLATE.md")
    $json = Join-Path $env:TEMP "$Nome.json"
    $meta | ConvertTo-Json | Set-Content -Encoding utf8 $json
    Enviar $json "$VpsStorage/templates"
    Remove-Item $json -Force
    Write-Host "Template salvo em $destino"
  }

  "novo" {
    if (-not $Nome) { throw "Informe -Nome do projeto" }
    $destino = Join-Path $Base $Nome
    if (Test-Path $destino) { throw "Já existe um projeto chamado $Nome" }
    if ($Template) {
      $origem = Join-Path $Templates $Template
      if (-not (Test-Path $origem)) { throw "Template não encontrado: $origem" }
      & robocopy $origem $destino /E /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar o template" }
      New-Item -ItemType Directory -Force (Join-Path $destino "renders"), (Join-Path $destino "referencias") | Out-Null
      Write-Host "Projeto $Nome criado a partir do template $Template"
    } else {
      Push-Location $Base
      try { & npx hyperframes init $Nome } finally { Pop-Location }
      Write-Host "Projeto $Nome criado (vazio)"
    }
  }
}

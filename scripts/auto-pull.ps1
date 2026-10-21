# auto-pull.ps1
# Roda em background (via Agendador de Tarefas, a cada 2 min) e puxa automaticamente
# qualquer commit novo que tenha sido empurrado pro GitHub.
#
# Segurança: só puxa se a árvore de trabalho estiver limpa (sem alterações locais não
# commitadas). Se você estiver editando algo, ele pula e loga - nunca sobrescreve
# nem descarta trabalho seu.

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$log = Join-Path $repo "scripts\auto-pull.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $log -Value "$ts - $msg"
}

try {
    Set-Location $repo

    $status = git status --porcelain
    if ($status) {
        Write-Log "Alteracoes locais nao commitadas - pulando pull."
        exit 0
    }

    $branch = (git branch --show-current).Trim()
    if (-not $branch) { $branch = "main" }

    git fetch origin $branch 2>&1 | Out-Null

    $local = git rev-parse HEAD
    $remote = git rev-parse "origin/$branch" 2>&1

    if ($LASTEXITCODE -ne 0 -or $local -eq $remote) {
        # Nada novo ou branch remoto ainda não existe - sai silencioso
        exit 0
    }

    $result = git pull --ff-only origin $branch 2>&1
    Write-Log "Pull aplicado ($branch): $result"
}
catch {
    Write-Log "ERRO: $($_.Exception.Message)"
}

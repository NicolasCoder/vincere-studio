$repo = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $repo "scripts\auto-pull.ps1"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "Vincere Studio AutoPull" -Action $Action -Trigger $Trigger -Description "Auto git pull do Vincere Studio a cada 2 min" -Force

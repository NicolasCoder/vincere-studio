#!/usr/bin/env bash
# Limpeza preventiva diária da VPS (crontab: 0 4 * * * … cleanup-vps.sh).
# Só remove o que é comprovadamente descartável e antigo: nada em uso, nada de outros serviços.
set -euo pipefail

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando rotina de limpeza preventiva do Vincere Studio..."

# 1. Intermediários do FFmpeg/render com mais de 24h
find /tmp -maxdepth 1 -name "ffmpeg*" -mtime +1 -delete 2>/dev/null || true
find /tmp -maxdepth 1 \( -name "*.wav" -o -name "*.aac" \) -mtime +1 -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name "core.*" -delete 2>/dev/null || true
# Pastas "work" de render: só as paradas há mais de 12h (um render em andamento mexe nelas).
find /opt/vincere-studio/storage -type d -name "work" -mmin +720 -prune -exec rm -rf {} + 2>/dev/null || true

# 2. Logs do PM2: esvazia só os que passaram de 50 MB (mantém o histórico recente de erros)
find /root/.pm2/logs -name "*.log" -size +50M -exec truncate -s 0 {} + 2>/dev/null || true

# 3. Docker: só imagens órfãs (dangling). Nunca containers — GerouPromo, n8n e WAHA também
#    rodam aqui, e um container parado durante um restart seria apagado por "system prune".
if command -v docker >/dev/null 2>&1; then
    docker image prune -f >/dev/null 2>&1 || true
fi

# 4. Espaço em disco final
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Limpeza concluida! Espaco livre: ${DISK_AVAIL} (Uso: ${DISK_USAGE})"

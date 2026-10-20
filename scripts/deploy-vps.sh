#!/usr/bin/env bash
# Publica o código do PC na VPS com backup e reversão automática se o build falhar.
#   bash scripts/deploy-vps.sh              → só código
#   bash scripts/deploy-vps.sh --restore-db  → código + recupera projetos do banco do PC + mídia
#     (mescla storage/docupulse.db do PC com o banco vivo da VPS; a VPS vence em conflito)
# Também aplica as correções de segurança/operação (idempotentes):
#   - next escuta só em 127.0.0.1 (acesso continua pelo túnel e pelo celular)
#   - OMNIVOICE_API_KEY e HYPERFRAMES_URL no .env
#   - encerra HyperFrames órfão na VPS (o preview mora no PC e chega pelo túnel)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
KEY="C:/Users/Igor/.ssh/claude_vps_ed25519"
HOST="root@143.95.167.129"
APP="/opt/vincere-studio"
SSH=(ssh -p 22022 -i "$KEY" -o ServerAliveInterval=30 "$HOST")
PC_DB="$REPO/storage/docupulse.db"
RESTORE_DB=0
[[ "${1:-}" == "--restore-db" ]] && RESTORE_DB=1
TS="$(date +%Y%m%d-%H%M%S)"
BK="/root/backups/deploy-$TS"

if [[ $RESTORE_DB == 1 && ! -f "$PC_DB" ]]; then
  echo "Banco do PC não encontrado em $PC_DB" >&2
  exit 1
fi

echo "== 1/6 Backup na VPS ($BK)"
"${SSH[@]}" bash -s <<EOF
set -euo pipefail
mkdir -p "$BK"
cd "$APP"
tar -czf "$BK/codigo.tgz" --exclude=node_modules --exclude=.next --exclude=.turbo apps packages scripts package.json pnpm-lock.yaml
cp -a apps/web/.next "$BK/next" 2>/dev/null || true
cp -a .env ecosystem.config.cjs "$BK/"
python3 -c "import sqlite3;s=sqlite3.connect('storage/docupulse.db');d=sqlite3.connect('$BK/docupulse.db');s.backup(d)"
# A chave do VoiceStudio estava fixa no código antigo: leva para o .env antes de sobrescrever.
if ! grep -q '^OMNIVOICE_API_KEY=' .env; then
  k=\$(grep -oP 'OMNIVOICE_API_KEY \|\| "\K[^"]+' apps/web/app/api/voicestudio/route.ts || true)
  [[ -n "\$k" ]] && printf 'OMNIVOICE_API_KEY="%s"\n' "\$k" >> .env
fi
EOF

echo "== 2/6 Enviando código"
cd "$REPO"
tar -czf - --exclude=node_modules --exclude=.next --exclude=.turbo --exclude='*.tsbuildinfo' \
  apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json \
  | "${SSH[@]}" "tar -xzf - -C $APP"

if [[ $RESTORE_DB == 1 ]]; then
  echo "== 3/6 Enviando banco do PC e mídia dos projetos"
  scp -P 22022 -i "$KEY" -q "$PC_DB" "$HOST:/tmp/vincere-pc.db"
  tar -czf - -C "$REPO/storage" projects | "${SSH[@]}" "tar -xzf - -C $APP/storage"
else
  echo "== 3/6 (banco intocado)"
fi

echo "== 4/6 Ajustes de operação e segurança"
"${SSH[@]}" RESTORE_DB=$RESTORE_DB bash -s <<'EOF'
set -euo pipefail
cd /opt/vincere-studio
grep -q '^HYPERFRAMES_URL=' .env || echo 'HYPERFRAMES_URL="http://[::1]:3010"' >> .env
grep -q -- '--hostname 127.0.0.1' ecosystem.config.cjs || \
  sed -i "s#args: 'start --port 3210'#args: 'start --port 3210 --hostname 127.0.0.1'#" ecosystem.config.cjs
pkill -f 'hyperframes preview' || true
if [[ $RESTORE_DB == 1 ]]; then
  pm2 stop vincere-web vincere-worker
  # Mescla com o app parado: base = PC (projetos), por cima o banco vivo da VPS.
  python3 -c "import sqlite3;s=sqlite3.connect('storage/docupulse.db');d=sqlite3.connect('/tmp/vincere-vps.db');s.backup(d)"
  python3 scripts/db-merge.py /tmp/vincere-pc.db /tmp/vincere-vps.db storage/docupulse.db.novo
  rm -f storage/docupulse.db-wal storage/docupulse.db-shm
  mv storage/docupulse.db.novo storage/docupulse.db
fi
EOF

echo "== 5/6 Build na VPS"
if ! "${SSH[@]}" "cd $APP && pnpm install --frozen-lockfile --prefer-offline && pnpm db:generate && pnpm --filter @vincere-studio/web build"; then
  echo "!! Build falhou — restaurando a versão anterior" >&2
  "${SSH[@]}" bash -s <<EOF
cd "$APP"
tar -xzf "$BK/codigo.tgz"
rm -rf apps/web/.next && cp -a "$BK/next" apps/web/.next
pm2 startOrRestart ecosystem.config.cjs --update-env
EOF
  exit 1
fi

echo "== 6/6 Reiniciando e conferindo"
"${SSH[@]}" bash -s <<'EOF'
set -euo pipefail
cd /opt/vincere-studio
pm2 delete vincere-web vincere-worker >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --update-env >/dev/null
pm2 save >/dev/null
sleep 6
curl -fsS http://127.0.0.1:3210/api/health; echo
curl -fsS http://127.0.0.1:3210/api/hyperframes; echo
ss -ltn | grep ':3210'
EOF
echo "Publicado. Backup em $BK"

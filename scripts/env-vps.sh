#!/usr/bin/env bash
# Atualiza chaves no .env da VPS sem que elas passem pelo chat nem pelo Git.
#   1. Crie um arquivo (fora do Google Drive), ex.: C:\Users\Igor\vincere-chaves.env, com linhas:
#        GEMINI_API_KEY=...
#        PEXELS_API_KEY=...
#   2. bash scripts/env-vps.sh C:/Users/Igor/vincere-chaves.env
# Só as chaves do arquivo mudam; o resto do .env fica como está. Faz backup antes e reinicia a web/worker.
set -euo pipefail

SRC="${1:?Informe o arquivo com as chaves (KEY=valor por linha)}"
KEY="C:/Users/Igor/.ssh/claude_vps_ed25519"
HOST="root@143.95.167.129"
SSH=(ssh -p 22022 -i "$KEY" "$HOST")

[[ -f "$SRC" ]] || { echo "Arquivo não encontrado: $SRC" >&2; exit 1; }

scp -P 22022 -i "$KEY" -q "$SRC" "$HOST:/tmp/vincere-chaves.env"
"${SSH[@]}" bash -s <<'EOF'
set -euo pipefail
cd /opt/vincere-studio
cp -a .env "/root/backups/env-$(date +%Y%m%d-%H%M%S)"
python3 - <<'PY'
import re
novas = {}
for linha in open("/tmp/vincere-chaves.env", encoding="utf-8"):
    m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", linha)
    if m and m.group(2):
        novas[m.group(1)] = m.group(2).strip('"').strip("'")
linhas = open(".env", encoding="utf-8").read().splitlines()
feitas = set()
for i, linha in enumerate(linhas):
    m = re.match(r"\s*([A-Z0-9_]+)\s*=", linha)
    if m and m.group(1) in novas:
        linhas[i] = f'{m.group(1)}="{novas[m.group(1)]}"'
        feitas.add(m.group(1))
linhas += [f'{k}="{v}"' for k, v in novas.items() if k not in feitas]
open(".env", "w", encoding="utf-8").write("\n".join(linhas) + "\n")
print("Chaves atualizadas:", ", ".join(sorted(novas)) or "nenhuma")
PY
shred -u /tmp/vincere-chaves.env 2>/dev/null || rm -f /tmp/vincere-chaves.env
pm2 restart vincere-web vincere-worker --update-env >/dev/null
echo "Web e worker reiniciados."
EOF
echo "Pronto. Pode apagar o arquivo local com as chaves: $SRC"

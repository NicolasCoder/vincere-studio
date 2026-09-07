# DocuPulse.AI — Setup local (Windows)

## Pré-requisitos (já verificados na sua máquina)
- Node.js 20+ (você tem v26) · Git · FFmpeg (v8.1 full) · Docker (opcional, só para o SaaS)
- pnpm: `npm i -g pnpm`

## Primeira vez
```powershell
cd C:\Users\Igor\Documents\PulseStudio
copy .env.example .env        # único .env, na raiz; edite as chaves quando tiver
pnpm setup                    # install + prisma generate + db push + seed
pnpm dev                      # sobe o app web (http://localhost:3210) e o worker
```

## Scripts úteis
| Comando | O que faz |
|---|---|
| `pnpm dev` | Web + worker em modo desenvolvimento (Turborepo) |
| `pnpm build` | Build de produção de tudo |
| `pnpm typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm db:studio` | Prisma Studio para ver/editar o SQLite |
| `pnpm db:seed` | Recria os projetos de exemplo |
| `pnpm db:push` | Aplica mudanças do `schema.prisma` no banco |

## Estrutura
- `apps/web` — interface (Next.js 15, Tailwind v4)
- `apps/worker` — executa os jobs pesados (TTS, B-roll, render, upload)
- `packages/core` — formatos 16:9/9:16, máquina de estados do pipeline, tipos
- `packages/db` — Prisma + SQLite (`storage/docupulse.db`)
- `packages/ui` — tokens do design system Obsidian Studio + componentes base
- `design-reference/` — telas originais do Stitch (referência visual)
- `storage/` — mídia gerada (ignorada pelo git)

## API (para n8n e automações)
- `GET /api/health`
- `GET /api/jobs` · `POST /api/jobs { type, projectId?, payload? }` · `GET|DELETE /api/jobs/:id`
- `POST /api/webhooks { niche, format?, costMode? }` → cria um projeto
- O worker chama `WEBHOOK_URL` (se definido no .env) ao concluir/falhar um job.

## Problemas comuns
- **Prisma no Windows**: se `pnpm setup` falhar em `prisma generate`, rode `pnpm db:generate` de novo; o download do engine às vezes falha na primeira vez.
- **Fontes**: o app carrega Geist e Material Symbols do Google Fonts; sem internet o layout fica com fontes de sistema.
- **Porta 3210 ocupada**: `pnpm --filter @docupulse/web dev -- --port 3211`.

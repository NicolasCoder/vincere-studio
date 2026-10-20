# Vincere Studio — Setup local (Windows)

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

## Chaves e recursos opcionais (.env na raiz)
| Variável | Para quê | Custo |
|---|---|---|
| `GEMINI_API_KEY` | texto (ideias, roteiro, cenas) e voz Gemini TTS | nível gratuito (cota diária; a TTS tem cota pequena) |
| `GEMINI_IMAGE_API_KEY` | imagens Nano Banana (modos Híbrido/Premium) | projeto com faturamento |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | B-roll de acervo (fotos e vídeos) | grátis |
| `ELEVENLABS_API_KEY` | voz premium (perfil com o Voice ID) | 10k créditos/mês grátis |
| — Edge TTS | voz de reserva gratuita | sem chave |

- **Whisper (legendas palavra a palavra)**: coloque `ggml-base.bin` (whisper.cpp, ~148 MB) em `storage/models/`. Sem ele, o alinhamento é proporcional.
- **Trilha sonora**: `storage/music/default.mp3` (ou `storage/music/<projectId>.mp3`) entra no render com ducking automático.
- **Modo Flow**: gere as imagens com os prompts de `storage/projects/<id>/prompts/flow-pack.md`, salve em `storage/projects/<id>/inbox/` com os nomes `a01-s03.png` e clique em "Importar da pasta inbox".
- **Renders**: saem em `storage/projects/<id>/renders/`. Perfis: YouTube 1080p, Shorts 1080×1920, Web 720p (rascunho).

## Problemas comuns
- **Prisma no Windows**: se `pnpm setup` falhar em `prisma generate`, rode `pnpm db:generate` de novo; o download do engine às vezes falha na primeira vez.
- **Fontes**: o app carrega Geist e Material Symbols do Google Fonts; sem internet o layout fica com fontes de sistema.
- **Gemini TTS 429/503**: a cota gratuita de voz é pequena e o serviço oscila; o app cai para a voz de reserva (Edge) e marca os atos para regravar depois.
- **Porta 3210 ocupada**: `pnpm --filter @vincere-studio/web dev -- --port 3211`.

# DocuPulse.AI — Arquitetura e Plano de Desenvolvimento

Versão 0.1 · 07/09/2026 · Autor: Claude (dev principal) com Igor Ferreira

---

## 1. O que o Stitch entregou (análise do ZIP)

O pacote contém um design system completo e sete telas HTML (Tailwind via CDN, Google Fonts, Material Symbols) que juntas descrevem o pipeline inteiro do produto, não só os passos 1 e 2.

| Tela | O que define | Status no ZIP |
|---|---|---|
| `obsidian_studio/DESIGN.md` | Design system "Obsidian Studio": paleta (cyan `#06B6D4` / violeta `#8B5CF6` sobre obsidian `#0B0F17`), tipografia (Space Grotesk, Geist, JetBrains Mono), glassmorphism, raios, espaçamentos, componentes | Completo, pronto para virar tokens |
| `docupulse_ai_studio_workflow` | Shell do app: sidebar, topbar, stepper de 4 passos. Idêntico byte a byte ao `passo_1_topico_nicho` | Completo |
| `ideation_hub_passo_1_topico_nicho` | Passo 1: nicho, tom, duração, público, micro-hooks, geração de 3 ideias com CTR/score/gancho | Completo |
| `ideation_hub_passo_1_formato_16_9_vs_9_16` | Variante do Passo 1 com o **seletor de formato** (Vídeo Longo 16:9 vs Vídeo Curto 9:16) e sidebar com "Histórico de Produção" e "Métricas & Desempenho" | Completo — é a versão que vale |
| `ideation_hub_passo_2_roteiro_narrativa` | Passo 2: roteiro em 6 atos/blocos, locução com pausas, cues de B-roll e som, curva de retenção, métricas, sugestões IA, voz sugerida | Completo |
| `ideation_hub_passo_3_voiceover_b_roll_studio` | Passo 3: TTS por ato (ElevenLabs no mock), waveform, cenas mapeadas (IA generativa / acervo / motion graphic), curadoria, trilha, ducking | Completo |
| `ideation_hub_passo_4_render_farm` | Passo 4: render em andamento (88%), status de nós, perfis de exportação, upload YouTube, SEO, compliance | HTML completo; `screen.png` corrompido (só o PNG) |
| `ideation_hub_conclusao_video_publicado` | **Exemplo do resultado final**: vídeo longo publicado, thumbnail gerada, métricas | Referência de resultado, não uma tela nova |
| PNGs soltos (thumbnails, cena cósmica, observatório 1983, avatar) | Assets de exemplo para o mock | Referência visual |

Observações importantes que saem da análise:

1. O "Histórico de Produção" e "Métricas & Desempenho" aparecem só como itens da sidebar; não há tela desenhada. Vamos desenhá-las no mesmo sistema quando chegar a sprint.
2. O mock cita infra que não vamos ter no início (16 nós A100, ElevenLabs Pro, 4K 60fps ProRes, Midjourney/Kling). O plano abaixo mantém a **experiência** das telas mas troca a infra por algo que roda de graça no seu notebook e escala para SaaS depois.
3. O seletor 16:9 vs 9:16 não é só uma proporção: muda duração alvo, ritmo de corte, estilo de legenda, tipo de gancho e perfil de render. Ele precisa ser um conceito de primeira classe no modelo de dados (`Project.format`).

---

## 2. Restrições reais (o que descobri na sua máquina)

| Item | Encontrado | Implicação |
|---|---|---|
| Node.js | v26.7 + npm 11 | Stack TypeScript liberada. Instalar `pnpm` (`npm i -g pnpm`) |
| Python | 3.14 | Disponível, mas não vamos depender dele |
| Docker | 29.6 | Disponível para Postgres/Redis quando virar SaaS; não vamos usar no dia a dia |
| FFmpeg | 8.1.2 full (gyan.dev) com libx264/x265, NVENC/QSV/AMF, libass, **whisper** | Render local pronto; Whisper embutido permite gerar legendas com timestamps sem serviço externo |
| Git | 2.55 | OK |
| CPU / RAM / GPU | i7-7500U (2 núcleos), 8 GB, Intel HD 620, sem NVIDIA | **Nenhum modelo de IA local** (sem Kokoro/XTTS/Stable Diffusion). Render em 1080p (16:9) e 1080×1920 (9:16); 4K fica para render em nuvem no futuro. Usar `h264_qsv` (Intel QuickSync) para acelerar o encode |
| Pasta do projeto | `C:\Users\Igor\Documents\PulseStudio` (vazia) | Base do monorepo |

Conclusão: toda a IA vai por API (Gemini primeiro), o notebook faz orquestração + montagem com FFmpeg, e a arquitetura já nasce preparada para mover os workers pesados para a nuvem.

---

## 3. Stack tecnológica proposta

### 3.1 Princípios

- **TypeScript ponta a ponta.** Um idioma, tipos compartilhados entre UI, API e pipeline. Migra para SaaS sem reescrever.
- **Provider-agnostic.** Cada capacidade de IA (texto, imagem, voz, vídeo, stock) tem uma interface; Gemini é a implementação padrão, Pexels/Pixabay são alternativas, ElevenLabs/outros entram depois sem tocar no pipeline.
- **Pipeline como máquina de estados persistida.** Cada projeto avança por `IDEATION → SCRIPT → MEDIA → RENDER → PUBLISH`; cada etapa é um job reexecutável e cancelável. É isso que dá as barras de progresso e "ETA" das telas.
- **Local primeiro, nuvem depois.** SQLite + fila em processo hoje; Postgres + Redis + workers remotos amanhã, trocando adaptadores e não código de negócio.

### 3.2 Front-end

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19** | SSR, rotas de API, Server Actions; padrão de mercado para SaaS |
| Estilo | **Tailwind CSS v4** com tokens gerados do `DESIGN.md` | O Stitch já gerou classes Tailwind; migrar é copiar |
| Componentes | **shadcn/ui** (Radix) re-estilizado com o Obsidian Studio | Acessível, sem lock-in, casa com Tailwind |
| Estado servidor | **TanStack Query** | Polling/streaming do progresso dos jobs |
| Estado local | **Zustand** | Editor de roteiro e timeline |
| Editor de roteiro | **Tiptap** (ProseMirror) com nós customizados (pausa, cue de B-roll, cue de som) | O Passo 2 exige blocos ricos e editáveis |
| Waveform / áudio | **wavesurfer.js** | Passo 3 |
| Gráficos | **Recharts** | Curva de retenção, métricas |
| Ícones | Material Symbols (como no mock) via `@material-symbols/svg-400` | Fidelidade ao design |
| Fontes | Space Grotesk, Geist, JetBrains Mono via `next/font` | Fidelidade ao design |

### 3.3 Back-end e pipeline

| Camada | Escolha | Por quê |
|---|---|---|
| API | Next.js Route Handlers + Server Actions | Zero infra extra |
| Banco | **Prisma** → **SQLite** (local) / **PostgreSQL** (SaaS) | Mesmo schema, troca de datasource |
| Fila de jobs | **Worker Node dedicado** (`apps/worker`) com fila em SQLite (v1) → **BullMQ + Redis** (SaaS) | Render e TTS não podem rodar dentro do request HTTP |
| Validação | **Zod** | Structured output do Gemini validado; tipos compartilhados |
| Arquivos | Sistema de arquivos local (`./storage/<projectId>/`) → S3/R2 (SaaS) | Interface `Storage` |
| Render | **FFmpeg** (filtergraph: `zoompan` Ken Burns, `xfade`, `libass` para legendas, `sidechaincompress` para ducking) | Já instalado, leve, determinístico |
| Render avançado (fase 2) | **Remotion** (React → vídeo) | Legendas animadas estilo "MrBeast", motion graphics 2.5D, shorts dinâmicos. Gratuito para uso individual |
| Alinhamento de legendas | **Whisper** via FFmpeg (`-af whisper`) ou `whisper.cpp` | Timestamps palavra a palavra a partir do áudio TTS, roda em CPU |
| Logs | **pino** | Log estruturado do pipeline (a tela "Ver Log do Cluster") |

### 3.4 Provedores de IA e mídia

| Capacidade | Padrão (custo zero para começar) | Alternativas plugáveis |
|---|---|---|
| Ideação, roteiro, SEO, títulos | **Gemini Flash** (free tier) com Structured Output JSON; **Gemini Pro** para o roteiro final | Claude, OpenAI |
| Imagens / B-roll gerado | **Nano Banana / Nano Banana Pro** via Gemini API (`gemini-*-image`) | Imagen, Flux via fal.ai |
| Clipes de vídeo gerados | Fase 2: **Veo** via Gemini API (pago) | Kling, Runway |
| B-roll de acervo | **Pexels API** + **Pixabay API** (fotos e vídeos, gratuitos) | Unsplash, Storyblocks |
| Locução | **Gemini TTS** (vozes PT-BR, controle de estilo por prompt, free tier) com fallback em **Edge TTS** (gratuito, offline-ish) | ElevenLabs quando quiser o "Marcus Sombrio" do mock |
| Trilha sonora | Biblioteca local de faixas livres (Pixabay Music, YouTube Audio Library) | Suno/Udio API |
| Publicação | **YouTube Data API v3** (upload, metadados, thumbnail, capítulos) | TikTok/Instagram na fase SaaS |
| Métricas | **YouTube Analytics API** | — |

Sobre o Flow e sua conta Gemini paga: o plano Google AI Pro/Ultra dá acesso ao **app** Gemini e ao Flow, mas não cobre a **API**. A API tem free tier próprio (Flash, TTS e alguns modelos de imagem com cotas diárias) e cobra por uso além disso. O Flow não expõe API; os modelos por trás dele (Nano Banana, Veo) são os mesmos que vamos chamar pela API. O app terá **importação manual de mídia**, então cenas feitas no Flow podem entrar no projeto por arrastar e soltar.

### 3.5 Sobre os "créditos"

No mock, "4.850 credits" é uma moeda interna. Na fase pessoal, o app vai **medir** o consumo real (tokens Gemini, imagens geradas, minutos de TTS) e mostrar isso no lugar dos créditos — é o custo estimado do projeto em dólares. Na fase SaaS, esse mesmo medidor vira a base do sistema de créditos: você compra API dos provedores por atacado e revende como créditos com margem via Stripe. Ou seja, o medidor é construído uma vez e serve aos dois cenários.

---

## 4. Arquitetura do repositório (monorepo)

```
PulseStudio/
├── apps/
│   ├── web/                    # Next.js — UI do DocuPulse Studio OS
│   │   ├── app/
│   │   │   ├── (studio)/       # layout com sidebar + topbar + stepper
│   │   │   │   ├── dashboard/
│   │   │   │   ├── projects/[id]/
│   │   │   │   │   ├── ideation/     # Passo 1
│   │   │   │   │   ├── script/       # Passo 2
│   │   │   │   │   ├── media/        # Passo 3
│   │   │   │   │   ├── render/       # Passo 4
│   │   │   │   │   └── published/    # Conclusão
│   │   │   │   ├── history/          # Histórico de Produção
│   │   │   │   ├── metrics/          # Métricas & Desempenho
│   │   │   │   ├── assets/           # Media Assets
│   │   │   │   └── settings/         # Chaves de API, vozes, perfis de export
│   │   │   └── api/                  # Route handlers (jobs, uploads, webhooks)
│   │   └── components/
│   └── worker/                 # Processo Node que executa os jobs pesados
│       └── jobs/
│           ├── generate-ideas.ts
│           ├── generate-script.ts
│           ├── synthesize-voice.ts
│           ├── hunt-broll.ts
│           ├── align-captions.ts
│           ├── render-video.ts
│           └── publish-youtube.ts
├── packages/
│   ├── core/                   # Domínio: máquina de estados, tipos, prompts, regras de formato
│   │   ├── formats/            # LONG_16_9 e SHORT_9_16: duração, ritmo, legendas, hooks
│   │   ├── prompts/            # Prompts versionados (ideação, roteiro, SEO, thumbnail)
│   │   └── pipeline/           # Orquestração de etapas e jobs
│   ├── providers/              # Adaptadores: gemini, pexels, pixabay, edge-tts, youtube, ...
│   │   └── interfaces/         # TextProvider, ImageProvider, VoiceProvider, StockProvider, ...
│   ├── render/                 # Builders de filtergraph FFmpeg, perfis de export, legendas ASS
│   ├── db/                     # Prisma schema + client + migrations
│   └── ui/                     # Tokens do Obsidian Studio + componentes base compartilhados
├── design-reference/           # As telas do Stitch (referência, não código de produção)
├── storage/                    # Mídia gerada (gitignored)
├── docs/                       # Este plano, ADRs, guia de setup
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### 4.1 Modelo de dados (núcleo)

```
Project        id, title, format (LONG_16_9 | SHORT_9_16), niche, tone, targetDuration,
               audience, hooks[], stage, status, costUsd, createdAt
Idea           projectId, title, category, synopsis, hookLines[3], ctrEstimate, score,
               retention30s, editingPace, recommended
Script         projectId, ideaId, version, wordCount, estimatedDuration, retentionCurve[]
ScriptBlock    scriptId, act, order, kind (HOOK | CONTEXT | ESCALATION | REVEAL | ...), title,
               narration (rich), wpm, startTime, endTime, brollCue, soundCue
VoiceTrack     scriptBlockId, provider, voiceId, filePath, durationMs, params{stability, style}
Caption        voiceTrackId, words[{text, startMs, endMs}]
Scene          scriptBlockId, order, source (GENERATED | STOCK | IMPORTED | MOTION),
               providerRef, prompt, filePath, startMs, endMs, kenBurns{...}, status
RenderJob      projectId, profile (YOUTUBE_1080 | SHORTS_1080x1920 | ...), progress, log,
               outputPath, startedAt, finishedAt
Publication    projectId, platform, videoId, url, title, description, tags[], chapters[],
               thumbnailPath, publishedAt, stats{views, ctr, avgViewDuration}
Job            type, projectId, payload, status, progress, attempts, error, logs
Usage          projectId, provider, unit (tokens | images | seconds), quantity, costUsd
```

### 4.2 Como o formato (16:9 vs 9:16) atravessa o sistema

| Aspecto | Vídeo Longo 16:9 | Vídeo Curto 9:16 |
|---|---|---|
| Duração alvo | 8–25 min | 30–90 s |
| Estrutura | 6 atos, gancho de 30–45 s | 1 gancho de 3 s + 3 batidas + CTA |
| Ritmo de corte | 3–6 s por cena | 1–2 s por cena |
| Legendas | Opcionais, discretas, rodapé | Obrigatórias, grandes, centralizadas, animadas |
| B-roll | Vídeos de acervo + imagens geradas com Ken Burns | Imagens geradas verticais + zooms agressivos |
| Render | 1920×1080, H.264/QSV, -14 LUFS | 1080×1920, H.264/QSV, -14 LUFS |
| Publicação | YouTube vídeo + capítulos | YouTube Shorts (+ TikTok/Reels no futuro) |
| Derivação | — | Um longo pode gerar N cortes curtos automaticamente (fase 2) |

Tudo isso mora em `packages/core/formats/` como configuração, e os prompts, o editor e o render leem dali.

---

## 5. Plano de desenvolvimento por sprints

Cada sprint termina com algo que roda na sua máquina. Estimativas assumem sessões de trabalho conjuntas; a ordem prioriza chegar em um vídeo publicado de ponta a ponta o mais cedo possível, e depois aprofundar cada passo.

### Sprint 0 — Fundação e design system
Objetivo: o shell do app rodando com a cara do Stitch, ainda sem IA.

- Monorepo pnpm + Turborepo, ESLint/Prettier, tsconfig compartilhado.
- `packages/ui`: tokens gerados do `DESIGN.md` (cores, tipografia, raios, espaçamentos, glows) e componentes base (Button gradient/ghost/icon, Input, Chip, Card glass, Badge pill, Progress dual-color).
- `apps/web`: layout studio (sidebar colapsável, topbar com busca e medidor de consumo, stepper de 4 passos com estados concluído/em progresso/bloqueado), rotas vazias de cada tela.
- `packages/db`: schema Prisma inicial + SQLite + seed com o projeto de exemplo do mock ("O Buraco Negro Oculto").
- `apps/worker`: esqueleto da fila de jobs + job de teste com progresso.
- `.env.example`, `docs/SETUP.md`, script `pnpm dev` que sobe web + worker.

Entrega: navegar por todas as telas com dados fictícios, no visual final.

### Sprint 1 — Passo 1: Ideation Hub
Objetivo: da configuração de nicho a três ideias reais geradas pelo Gemini.

- Adaptador `GeminiTextProvider` com Structured Output (Zod → JSON Schema) e medidor de tokens.
- Seletor de formato 16:9 / 9:16 ligado a `packages/core/formats`.
- Formulário do Passo 1 (nicho, tom, duração, público, micro-hooks) com validação.
- Prompt de ideação versionado: gera título, categoria, sinopse, 3 linhas de gancho, ritmo de edição, estimativas de CTR/retenção.
- Cards de ideia com filtros (Todas / Maior viralidade / Ganchos), "Gerar mais 3 variações", "Randomizar".
- Imagem de capa de cada card gerada com Nano Banana (ou placeholder do Pexels se a cota acabar).
- "Selecionar e Iniciar Roteiro" cria o `Project` e avança o stepper.

Entrega: Passo 1 funcional e persistido.

### Sprint 2 — Passo 2: Motor de roteiro e narrativa
Objetivo: roteiro completo em blocos editáveis com cues de B-roll e som.

- Prompt de roteiro em duas passagens: estrutura de atos (outline) → texto de cada ato em stream, com marcações `[Pausa dramática 1.8s]`, cues visuais e de som.
- Regras por formato: 6 atos para longo; gancho + batidas + CTA para curto.
- Editor Tiptap com nós customizados; ações por bloco: reescrever com IA, mais intenso, dividir, inserir pergunta retórica, reordenar, excluir.
- Métricas do roteiro: palavras, duração estimada por WPM, ritmo, cortes ideais, contagem de clímax.
- Curva de retenção prevista (heurística no v1: posição dos hooks, densidade de perguntas, tamanho de frase) e painel de sugestões IA com "Aplicar correção".
- Versionamento de roteiro (salvar rascunho, histórico, restaurar).

Entrega: roteiro pronto para virar áudio.

### Sprint 3 — Passo 3: Voz, legendas e B-roll
Objetivo: cada bloco vira áudio alinhado e cenas mapeadas.

- `GeminiVoiceProvider` + `EdgeTtsProvider` (fallback); síntese por bloco, concatenação, normalização a -14 LUFS.
- Alinhamento Whisper (FFmpeg) → `Caption` com timestamps por palavra.
- Painel de vozes (galeria, prévia, parâmetros de estilo) e player com waveform por ato.
- `StockProvider` Pexels + Pixabay: busca por palavra-chave derivada do cue de B-roll, com filtro de orientação pelo formato.
- `GeminiImageProvider` (Nano Banana / Pro): geração de cenas por prompt, com orientação e estilo do projeto.
- Importação manual (arrastar mídia gerada no Flow ou própria).
- Mapeamento cena → intervalo de tempo, com auto-preencher ("Auto-Hunter") e edição manual.
- Trilha sonora: escolha de faixa e ducking automático.

Entrega: timeline completa, pré-visualização por ato.

### Sprint 4 — Passo 4: Render e exportação
Objetivo: MP4 final em 16:9 e 9:16 com progresso em tempo real.

- `packages/render`: builder de filtergraph (Ken Burns via `zoompan`, transições `xfade`, legendas `.ass` estilizadas, mix de voz + trilha com `sidechaincompress`).
- Perfis: YouTube 1080p, Shorts 1080×1920, Web 720p (rascunho rápido). Encode `h264_qsv` com fallback `libx264`.
- Job de render com progresso por etapa (áudio, composição, legendas, encode), log ao vivo e cancelamento.
- Tela do Passo 4 com "nós" representando as etapas (mesma linguagem visual do mock, sem fingir 16 A100).
- Verificação pré-voo: duração, loudness, resolução, cenas sem mídia, fontes de acervo com atribuição.

Entrega: vídeo pronto para publicar, nos dois formatos.

### Sprint 5 — Publicação, thumbnail e conclusão
Objetivo: do render ao vídeo no ar, com a tela de conclusão real.

- OAuth Google + YouTube Data API v3: upload resumível, título, descrição com capítulos, tags, agendamento, visibilidade.
- SEO por IA: 3 alternativas de título, descrição, tags.
- Thumbnail: variações A/B geradas com Nano Banana Pro a partir do título + cena chave; upload via API.
- Tela de conclusão com link, status e cota diária de upload.
- Gestão de cota da API (10.000 unidades/dia ≈ 6 uploads, como o mock).

Entrega: pipeline ponta a ponta, primeiro documentário publicado pelo app.

### Sprint 6 — Dashboard, histórico, métricas e assets
Objetivo: operar vários projetos.

- Dashboard com projetos em andamento, custos, próximas ações.
- Histórico de produção com filtros, duplicar projeto, reabrir em qualquer passo.
- Métricas via YouTube Analytics API (views, CTR, retenção real vs prevista) para retroalimentar as heurísticas.
- Biblioteca de Media Assets (mídia gerada/importada, reutilização entre projetos).
- Settings: chaves de API, provedores padrão, vozes favoritas, perfis de exportação.

### Sprint 7 — Qualidade avançada e cortes curtos automáticos
- Remotion para legendas animadas (estilo dinâmico dos Shorts) e motion graphics 2.5D.
- Gerar N Shorts a partir de um longo (seleção dos trechos de maior "retenção" pelo roteiro).
- Veo para clipes de vídeo gerados (opcional, pago).
- ElevenLabs como provedor de voz premium.

### Sprint 8 — Preparação para SaaS
- Auth (Auth.js) e multiusuário; Postgres (Supabase ou Neon); Redis + BullMQ; storage S3/R2.
- Workers de render em nuvem (Fly.io Machines ou Modal) com GPU sob demanda para 4K.
- Sistema de créditos sobre o medidor de consumo; Stripe; planos (o "Pro Tier" do mock).
- Observabilidade, limites de taxa, filas por tenant.

---

## 6. Como começar (pontapé inicial)

Proposta para a próxima sessão, na ordem:

1. Eu crio o monorepo na pasta `PulseStudio` com a Sprint 0 (fundação + design system + shell + schema + worker), copio as telas do Stitch para `design-reference/` e escrevo `docs/SETUP.md`.
2. Você instala o `pnpm` (`npm i -g pnpm`), roda `pnpm install` e `pnpm dev`, e a gente confere se o visual bate com o Stitch.
3. Você cria uma chave da API do Gemini em Google AI Studio e chaves gratuitas do Pexels e do Pixabay, e coloca no `.env`.
4. Partimos para a Sprint 1.

Decisões que ficam abertas e podem ser tomadas depois sem retrabalho: Remotion vs FFmpeg puro para legendas animadas (Sprint 7); Supabase vs Neon para Postgres (Sprint 8); TikTok/Instagram como destinos (Sprint 8).

---

## 7. Adendo — Workflow Studio (Video Canvas), adicionado em 07/09/2026

Módulo isolado para criação manual e encadeada de comerciais e vídeos verticais, a partir da tela `workflow_studio_video_canvas_node_based_9_16` do Stitch. Não altera o pipeline de documentários.

**Onde vive**

- `packages/core/src/workflow.ts` — tipos de nó (`AVATAR`, `PRODUCT`, `PROMPT`, `VOICE`, `RENDER`), esquemas Zod dos dados de cada nó, grafo (`WorkflowGraph`), regras de conexão (`ALLOWED_EDGES`) e metadados de paleta.
- `packages/db` — modelo `Workflow` (nome, tipo, status, `graph` em JSON). Migração aditiva.
- `apps/web/components/canvas/` — `WorkflowCanvas` (React Flow: malha pontilhada/quadriculada, zoom, minimap, undo/redo, duplicar, excluir, salvar, executar), `nodes.tsx` (um componente por tipo de nó, campos editáveis) e `NodeShell` (moldura, handles, campos, medidores).
- `apps/web/app/(studio)/workflow` — lista/criação de fluxos e `[id]` com o canvas. Server actions `saveWorkflow`, `runWorkflow`.
- `apps/worker` — job `RUN_WORKFLOW` registrado (execução do grafo fica para uma sprint própria).

**Como o grafo vira vídeo (sprint futura "Workflow Runner")**

O worker faz uma ordenação topológica do grafo e executa cada nó com os provedores já usados no pipeline principal: Avatar e Produto viram imagens de referência (upload manual, Nano Banana ou FLUX), Prompt gera os clipes (Veo pela API, ou pacote de prompts para o Flow com importação automática da pasta), Voz usa Gemini TTS + lip-sync, e Render compõe o 9:16 com FFmpeg e legendas. Os mesmos adaptadores de `packages/providers`, sem duplicar código.

**Modo Flow (assistido)** — para usar Nano Banana Pro/Veo pela conta paga do Gemini sem API: o app exporta um pacote de prompts nomeados por cena, observa a pasta `storage/<projeto>/inbox/` e casa automaticamente os arquivos que caírem lá com as cenas. Uma automação de navegador (Playwright com o perfil do Chrome logado) que cole os prompts no Flow e baixe os resultados é tecnicamente possível, mas fica como experimento opcional: depende da interface do Flow não mudar e pode conflitar com os termos de uso do Google.

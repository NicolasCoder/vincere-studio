# Plano de Execução — Vincere Studio "Agente-Primeiro"

Este documento organiza todas as tarefas executadas e validadas para tornar o **Vincere Studio** 100% compatível e controlável por agentes de IA (`Antigravity / agy`, `Claude Code`, `Codex`, `Hermes`), mantendo exclusivamente o **HyperFrames** como motor de composição visual e o **Vince** como ponte direta na interface para acionar o agente de terminal e os fluxos do estúdio.

---

## Status Geral

- [x] Diagnóstico arquitetural e levantamento de rotas, jobs e telas
- [x] **Fase 0** — Limpeza, Unificação em HyperFrames e Higiene de Rotas
- [x] **Fase 1** — Contrato REST Agente-Primeiro (`/api/v1/*`) + Gates no Servidor
- [x] **Fase 2** — O Agente como Cérebro (Injeção Direta de Conteúdo & Workflows por API)
- [x] **Fase 3** — Runbooks Executáveis & Verificadores Medidos
- [x] **Fase 4** — Manifesto de Capacidades, Servidor MCP Nativo & Vince Integrado
- [x] **Fase 5** — Execução e Validação Ponta a Ponta de Todos os Fluxos

---

## Fase 0 — Limpeza, Unificação em HyperFrames e Higiene de Rotas

- [x] **0.1 — Unificar composição visual no HyperFrames**:
  - Removidos componentes e rotas órfãs do Remotion Studio (`OpenRemotionStudio.tsx`, `remotion-studio.ts`, `api/remotion-studio`, `api/projects/[id]/remotion-props`).
  - Atualizados `apps/web/lib/skills-catalog.ts`, `SystemSkillsCatalog.tsx` e `projects/[id]/edit-plan/page.tsx` para unificar o motor em `HyperFrames`.
- [x] **0.2 — Remover `enqueueDemoJob` obsoleto das configurações**:
  - Removido `enqueueDemoJob` de `apps/web/app/(studio)/settings/actions.ts` e `settings/page.tsx`.
- [x] **0.3 — Transformar `/docs` na Central de Documentação & API para Agentes**:
  - Reescrito `apps/web/app/(studio)/docs/page.tsx` em português com guia interativo do modo Agente-Primeiro, tabela completa de rotas `/api/v1/*`, configuração do servidor MCP, Runbooks disponíveis e link para `/AGENTES.md`.
- [x] **0.4 — Consolidar `/history`**:
  - `/history` redireciona diretamente para `/projects?modo=todos`.
- [x] **0.5 — Higiene de caminhos portáteis**:
  - Centralizados `pastaReelsTools()` e `pastaSharingan()` em `apps/web/lib/pastas.ts` e aplicados em `api/reels-tools`, `api/sharingan` e `api/sharingan/media`.

---

## Fase 1 — Contrato REST Agente-Primeiro (`/api/v1/*`) + Gates no Servidor

- [x] **1.1 — Camada de Serviços & Inspeção de Estado (`apps/web/lib/agent-api.ts`)**:
  - Implementado `computeProjectAgentState(projectId)` que inspeciona ideias, roteiro, faixas de voz, legendas alinhadas, cenas, plano de edição, renders, exportação HyperFrames e publicação, retornando `etapasConcluidas`, `metricas`, `pendencias[]` e `proximasAcoes[]` (com pré-condições e payloads de exemplo).
  - Implementada autenticação para agentes (`checkAgentAuth(req)`): livre em `localhost` ou via `Authorization: Bearer <VINCERE_AGENT_TOKEN>`.
- [x] **1.2 — Endpoints de Coleção de Projetos (`apps/web/app/api/v1/projects/route.ts`)**:
  - `GET /api/v1/projects`: lista todos os projetos com contadores e estágio atual.
  - `POST /api/v1/projects`: cria novo projeto validado e devolve estado inicial + próximas ações.
- [x] **1.3 — Endpoints de Projeto Individual e Estado (`apps/web/app/api/v1/projects/[id]/route.ts` e `state/route.ts`)**:
  - `GET /api/v1/projects/[id]`: retorna dados completos do projeto + estado calculado.
  - `PATCH /api/v1/projects/[id]`: atualiza metadados, estágio, formato, estilo de legenda ou intensidade.
  - `DELETE /api/v1/projects/[id]`: remove projeto com trava de confirmação (`confirm: true`).
  - `GET /api/v1/projects/[id]/state`: diagnóstico enxuto com `proximasAcoes[]` e bloqueios.
- [x] **1.4 — Endpoint Unificado de Ações do Pipeline (`apps/web/app/api/v1/projects/[id]/actions/route.ts`)**:
  - Suporte tipado com validação de pré-condições, idempotência e trava de publicação no servidor para: `gerar_ideias`, `escolher_ideia`, `gerar_roteiro`, `reescrever_bloco`, `sugerir_melhorias`, `sintetizar_voz`, `alinhar_legendas`, `planejar_cenas`, `buscar_broll`, `gerar_imagens`, `importar_inbox`, `gerar_plano_edicao`, `exportar_hyperframes`, `renderizar_video`, `gerar_thumbnail`, `aprovar_render`, `rejeitar_render`, `publicar_youtube` (retorna HTTP 403 `GATE_APROVACAO_OBRIGATORIO` se o último render não estiver aprovado).
- [x] **1.5 — Espera Inteligente de Jobs (`apps/web/app/api/v1/jobs/[id]/wait/route.ts`)**:
  - Long-polling configurável (`?timeoutMs=25000`) que aguarda a conclusão do job no worker e retorna status, progresso, logs e resultado parseado.

---

## Fase 2 — O Agente como Cérebro (Injeção Direta de Conteúdo & Workflows por API)

- [x] **2.1 — Injeção Direta de Conteúdo pelo Agente (`apps/web/app/api/v1/projects/[id]/content/route.ts`)**:
  - Permite que o próprio agente envie:
    - `kind: "ideas"` (lista de ideias + seleção automática)
    - `kind: "script"` (atos/blocos de narração + pista visual + cálculo automático de palavras e duração estimada)
    - `kind: "scenes"` (lista de cenas com prompt visual, busca de B-roll, preset de motion e tempos)
    - `kind: "edit_plan"` (inserções da camada visual DVP)
    - `kind: "seo"` (título, descrição, tags e capítulos de publicação)
- [x] **2.2 — API Completa de Workflows (`apps/web/app/api/v1/workflows/route.ts` e `[id]/route.ts`)**:
  - Permite ao agente listar, criar (a partir de templates `VERTICAL_COMMERCIAL` / `UGC` / `CUSTOM`), validar conexões (`canConnect`), atualizar nós/arestas e disparar `RUN_WORKFLOW`.

---

## Fase 3 — Runbooks Executáveis & Verificadores Medidos

- [x] **3.1 — Motor de Runbooks e Verificadores (`apps/web/lib/runbooks.ts`)**:
  - Implementados os 6 Runbooks canônicos do Vincere Studio:
    1. `curiosidades-short-9x16`
    2. `dossie-documentario-16x9`
    3. `hyperframes-motion-pure`
    4. `clone-motion-sharingan`
    5. `talking-head-cortes`
    6. `ugc-comercial-workflow`
  - Implementado `evaluateRunbookForProject(runbookId, projectId)` com verificadores reais medidos no banco e no disco.
- [x] **3.2 — Endpoints de Runbooks (`apps/web/app/api/v1/runbooks/route.ts`)**:
  - Lista todos os runbooks (`GET`) e avalia o progresso exato de qualquer projeto contra um runbook (`POST`), devolvendo o próximo passo pronto para execução.

---

## Fase 4 — Manifesto de Capacidades, Servidor MCP Nativo & Vince Integrado

- [x] **4.1 — Manifesto de Capacidades (`apps/web/app/api/v1/capabilities/route.ts`)**:
  - Retorna diagnóstico em tempo real dos motores (`worker_heartbeat`, HyperFrames, PC GPU Bridge RTX 3060), agentes CLI detectados, cérebro do Vince, chaves configuradas, catálogo de ações e runbooks.
- [x] **4.2 — Servidor MCP do Vincere Studio (`scripts/vincere-mcp-server.mjs`)**:
  - Servidor MCP padrão `stdio` (`pnpm mcp:server`) com 10 ferramentas (`vincere_capabilities`, `vincere_list_runbooks`, `vincere_evaluate_runbook`, `vincere_list_projects`, `vincere_create_project`, `vincere_get_project_state`, `vincere_submit_content`, `vincere_run_action`, `vincere_wait_job`, `vincere_dispatch_terminal_agent`).
- [x] **4.3 — Atualizar Vince e `/AGENTES.md`**:
  - Atualizados `apps/web/lib/vince-sistema.ts` e `apps/web/public/AGENTES.md` para que o Vince e qualquer agente vinculado conheçam todas as rotas `/api/v1/*`, os Runbooks e como disparar execuções de terminal pela interface.

---

## Fase 5 — Validação Ponta a Ponta de Todos os Fluxos

- [x] **5.1 — Testes Unitários e Typecheck (`pnpm typecheck` + `vitest`)**:
  - Criado `apps/web/lib/runbooks.test.ts`; **67/67 testes unitários aprovados** (7 suítes) e `tsc --noEmit` limpo em todos os pacotes.
- [x] **5.2 — Bateria E2E ao Vivo (REST + Runbooks + Pipeline + HyperFrames + Workflows + MCP + 21 Rotas)**:
  - Executada e aprovada contra `http://localhost:3210`:
    1. `GET /api/v1/capabilities` (`worker.online: true`, 6 runbooks, `visualEngine: "HyperFrames"`).
    2. `POST /api/v1/projects` + `POST /api/v1/projects/:id/content` (`ideas`, `script`, `scenes`, `edit_plan`, `seo`).
    3. `POST /api/v1/runbooks` (avaliação determinística de passos concluídos e próximo passo).
    4. `POST /api/v1/projects/:id/actions` (`exportar_hyperframes` gerando `index.html` e `vincere-manifest.json` reais em `Videos-HF`, e `publicar_youtube` bloqueado pela trava `GATE_APROVACAO_OBRIGATORIO` HTTP 403).
    5. `POST /api/v1/workflows` + `GET /api/v1/workflows/:id` (criação e validação de grafo UGC com 4 nós).
    6. `scripts/vincere-mcp-server.mjs` respondendo a `initialize`, `tools/list` (10 ferramentas) e `tools/call` (`vincere_capabilities`).
    7. **21/21 rotas da interface** respondendo com **HTTP 200 OK**.

---

## Fase 6 — Automação Contínua & Loop de Produção (`AUTO_PRODUCE`)

- [x] **6.1 — Job Handler `autoProduce` (`apps/worker/src/jobs/auto-produce.ts`)**:
  - Orquestra roteiro, locução, alinhamento, planejamento de cenas, coleta mista (B-roll + IA), camada visual DVP e renderização de prova.
  - Para rigorosamente no render de prova: publicação nunca ocorre sem aprovação manual do editor (`403 GATE_APROVACAO_OBRIGATORIO`).
  - Suporte a webhooks de notificação (`WEBHOOK_URL`) com link de revisão.
- [x] **6.2 — Exposição em API e Manifesto (`actions/route.ts` e `capabilities/route.ts`)**:
  - `POST /api/v1/projects/[id]/actions` (`action: "auto_produce"`) enfileira e devolve o jobId com URL de long-polling.

---

## Fase 7 — Auto-Healing & Auditoria Visual de Safe-Zones

- [x] **7.1 — Auditor de Safe-Zones (`packages/core/src/safe-zones.ts` e `safe-zones.test.ts`)**:
  - Mapeia margens seguras para YouTube Shorts, Reels e TikTok (`SHORT_9_16`) e telas horizontais (`LONG_16_9`).
  - Integrado ao relatório de auditoria de qualidade em `apps/worker/src/jobs/render-video.ts`.
- [x] **7.2 — Auto-Healing de Voz (`apps/worker/src/jobs/synthesize-voice.ts`)**:
  - Insere dinamicamente `EDGE_TTS` como rede de segurança resiliente no final da cadeia de sintetizadores, impedindo paradas por limites de quota ou instabilidade de rede.

---

## Fase 8 — SFX Procedurais em FFmpeg

- [x] **8.1 — Biblioteca de Efeitos Sonoros (`packages/render/src/sfx.ts`)**:
  - Gera `whoosh`, `impact`, `riser` e `click` por síntese de áudio procedural em FFmpeg (100% offline, sem royalties, sem downloads externos).


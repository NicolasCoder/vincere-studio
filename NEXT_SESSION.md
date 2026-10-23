# Próxima sessão — plano de execução do Vincere Studio

Este arquivo é o handoff oficial para a próxima sessão, seja ela aberta com Codex ou Claude.

## Regra de identidade

- O único nome oficial do produto é **Vincere Studio**.
- Não reintroduzir nomes anteriores em interface, documentação, prompts ou novos identificadores.
- O escopo dos pacotes já foi migrado para `@vincere-studio/*`.
- O nome da pasta, do repositório remoto e do arquivo SQLite ainda são legados e exigem migração
  controlada, com backup e verificação de todos os caminhos.

## Estado deixado em 23/10/2026 — Unificação Completa: Auto-Healing Global, Correção do HyperFrames Studio, Seleção de Modelo/Força/Limites e Avanços do Colega (`origin/fix/acesso-local-api-v1`)

- **Correção Definitiva do HyperFrames Studio (`apps/web/lib/hyperframes-runtime.ts` + `/api/hyperframes`)**:
  - `resolveWorkspaceDir()` e `listWorkspaceProjects()` varrem e unificam `HYPERFRAMES_PROJECTS_DIR`, `storage/hyperframes/workspace` e `Videos-HF`, evitando que uma pasta `Videos-HF` vazia oculte os projetos reais.
  - `ensureStarterProject()` cria automaticamente o projeto inicial `referenciamotion-pro` se o workspace estiver vazio, e `ensureHyperframesRunning()` limpa processos órfãos na porta `3010` (`--kill-all`) antes de subir o daemon Node, mesclado com a resolução dinâmica de `hyperframes.mjs` global e ação `delete` de projetos.
- **Sistema Global de Auto-Healing com IA / Agente Vinculado (`apps/web/lib/auto-heal.ts`, `/api/auto-heal`, `apps/web/components/AutoHealingMonitor.tsx`, `apps/web/app/(studio)/error.tsx`)**:
  - Monitor global montado em `apps/web/app/(studio)/layout.tsx` que intercepta erros HTTP `>= 500`, falhas de runtime, jobs com falha (`FAILED`), worker inativo e quedas do HyperFrames `:3010`.
  - Exibe notificação flutuante persistente (`"Auto-Healing em andamento..."`) com cronômetro ao vivo, nome do Agente/IA ativo (`Antigravity agy`, `Claude Code`, `Codex`, `Hermes` ou LLM vinculada) e log de etapas até concluir o reparo (`"Auto-Healing Concluído ✓"`).
- **Vince Unificado (4 Abas + Catálogo de Modelos/Força + Telemetria 5h + Ações Contextuais)**:
  - `apps/web/components/ClaudeButton.tsx`, `apps/web/lib/cerebro-catalogo.ts` e `apps/web/lib/cerebro-comandos.ts` combinam as 4 abas (`Conversar`, `Pedidos`, `Limites`, `Memória`), seletor rápido de Família (`Gemini`/`Claude`/`GPT`), Modelo e Força (`Low`/`Med`/`High`/`Max`), continuidade de sessão (`conversaId`), telemetria de janela de 5h/tokens e botão de Auto-Healing com as sugestões contextuais por tela, execução direta de `acaoStudio` (`/api/v1/projects/[id]/actions`), `skillSugerida` e limpeza da caixa de `Pedidos`.

## Estado deixado em 23/10/2026 — Vince Flutuante Ativo, Limpeza de Pedidos, Exclusão Universal e HyperFrames 0.8.189

- **Vince como Agente Flutuante Ativo e Contextual (`apps/web/components/ClaudeButton.tsx`)**:
  - Vince agora detecta em tempo real a tela em que o usuário está (`📍 Etapa 1: Ideação`, `📍 Roteiro`, `📍 Mídia & Cenas`, `📍 Render`, `📍 HyperFrames Studio`, `📍 Copiloto & Fluxo`, etc.) e exibe uma barra dinâmica de sugestões rápidas contextuais.
  - **Execução Real de Ações de Edição no Projeto**: o Vince executa ações diretamente no projeto ativo via `/api/v1/projects/[id]/actions` (`auto_produce`, `gerar_imagens`, `sintetizar_voz`, `exportar_hyperframes`, `validar_safe_zones`, etc.), com spinner ao vivo e aviso de conclusão dentro da conversa.
  - **Sugestão de Skills na Hora Certa**: quando a conversa ou a etapa demanda uma skill (como `/subtitles-studio` para legendas Lockup, `/video-sharingan` para clonar estilo, `/flow-studio` para IA), o Vince recomenda em um card dedicado com botão para mandar o agente executar.
  - **Aprendizado Contínuo**: o Vince retém estilo de nicho, proporção de tela, voz e regras de edição na memória para aplicar em conversas futuras.
- **Caixa de Pedidos do Vince Limpa & Gerenciável**:
  - `storage/claude-inbox.json` limpo de pedidos antigos acumulados em testes.
  - Rota `DELETE /api/claude` implementada com suporte a limpeza por filtro (`filtro=feito` ou `filtro=all`) e exclusão individual por `id`.
  - Botões "Limpar concluídos", "Limpar tudo" e lixeira por pedido adicionados à aba Pedidos do Vince.
- **Opção Universal de Apagar / Excluir Itens Criados**:
  - **Quadro de Projetos (`/projects`)**: botão de lixeira sempre visível nos cartões Kanban, com diálogo de confirmação que remove banco e arquivos do disco.
  - **Início (`/dashboard`)**: adicionado `BotaoApagarProjeto` em todos os projetos recentes.
  - **Dentro do Projeto (`ProjectShell.tsx`)**: opção "Excluir projeto" embutida no drawer de saúde do projeto.
  - **Fluxos Nodais (`/workflow`)**: adicionado `BotaoApagarWorkflow` para excluir fluxos salvos em 1 clique.
  - **HyperFrames Studio (`/studio`)**: adicionado botão "Excluir" no seletor de projetos com rota `POST /api/hyperframes { action: "delete" }` para limpar do disco e alternar automaticamente para o próximo projeto.
- **Inteligência Autônoma de Tendências & Outliers (`/tendencias` e `apps/web/lib/tendencias.ts`)**:
  - Resolvido o problema de tela vazia/travada em "pesquisando": implementada a curadoria com dados reais populados (`garantirRelatorioInicial()`) trazendo temas com métricas de outliers vidIQ (25× a 42× a média do canal), Google Trends Brasil/Global e Reddit.
  - Implementado `gerarPesquisaTendenciasComIA()` no backend: ao clicar em "Pesquisar agora", o próprio backend sintetiza temas reais e conclui o relatório instantaneamente sem depender de loops externos no terminal.
  - Adicionado o botão "Criar Projeto" em cada sugestão de tendência, criando o projeto no SQLite em 1 clique e navegando para a Ideação.
- **Atualização do HyperFrames & Token Administrativo**:
  - HyperFrames atualizado globalmente na máquina para a versão mais recente (`0.8.189`).
  - Token de segurança `vincere-admin-2026` configurado no `.env` com fallback automático e botão "Usar padrão" no modal de atualização do Studio.
- **Testes & Typecheck**:
  - `pnpm typecheck`: 7/7 pacotes aprovados (0 erros).
  - `pnpm test`: 5/5 suítes aprovadas (89 testes unitários + testes de smoke 100% verdes).

## Estado deixado em 23/10/2026 — Correção Visual do HyperFrames Studio, Job de Atualização de Skills na Máquina e Estabilização

- **Pasta e Repositório**: A pasta ativa e atualizada com o GitHub (`https://github.com/Igorferreirax/vincere-studio.git`) é `C:\dev\vincere-validacao` na branch `fix/acesso-local-api-v1`.
- **Banco de Dados Real**: O banco SQLite oficial da instância com os 9 projetos e 6 workflows é `vista.db`. O `.env` na raiz agora aponta diretamente para ele (`DATABASE_URL="file:C:/dev/vincere-validacao/vista.db"`), eliminando qualquer divergência entre `apps/web`, `apps/worker` e Prisma.
- **Correção Visual do Dropdown de Atualização do HyperFrames (`ajuste 1.png`)**:
  - Ajustado o stacking context em `apps/web/app/(studio)/studio/page.tsx` (`relative z-40` na barra de ferramentas superior) e `apps/web/components/AtualizarVersao.tsx` (`z-50`). O card do popup de atualização da versão (`0.8.181 → 0.8.188`) agora flutua por cima da barra de comandos sem ficar escondido.
- **Job e Painel de Atualização de Skills na Máquina (`CHECK_SKILLS_UPDATES`)**:
  - Adicionado suporte ao job `CHECK_SKILLS_UPDATES` no core (`packages/core/src/pipeline.ts`) e no worker (`apps/worker/src/jobs/skills-updates.ts`).
  - Varre pastas de skills locais (`~/.gemini/config/skills`, `~/.claude/skills`, `~/.agents/skills`, `.codex/skills` e repositório) e atualiza/sincroniza as versões mais recentes automaticamente.
  - Rota `/api/skills/check-updates` (GET e POST) implementada.
  - Painel interativo com status em tempo real, contadores de skills, diretórios monitorados e acionamento em 1 clique em `apps/web/app/(studio)/skills/SystemSkillsCatalog.tsx`.
- **Geração de Imagens das Cenas por IA (`GENERATE_IMAGES` + `forPendingScenes`)**:
  - `apps/worker/src/jobs/generate-images.ts` agora suporta preencher automaticamente todas as cenas pendentes do roteiro com IA a partir dos prompts de cena compostos, sem exigir inserção manual, salvando metadados de dimensões e status `READY` nas cenas.
  - Rota de ações `POST /api/v1/projects/[id]/actions` (`gerar_imagens`) suporta seleção de motor de imagem (`POLLINATIONS`, `CLOUDFLARE`, `HUGGINGFACE`, `TOGETHER`, `GEMINI`, `OPENAI`, `KIE`) e preenchimento de cenas pendentes.
- **Roadmap Atualizado & Fases 6 a 9 Delineadas**:
  - `docs/ROADMAP_AGENTE_PRIMEIRO.md` e `docs/ROADMAP_OPENAI_E_QUALIDADE.md` atualizados com status das integrações e com o planejamento das Fases 6 (`AUTO_PRODUCE`), 7 (Auto-Healing & Safe Zones), 8 (Multiplataforma Reels/TikTok + SFX) e 9 (Métricas reais do YouTube).
- **Auto-Produce, Safe-Zones & SFX Procedurais (Fases 6, 7 e 8)**:
  - Implementado `AUTO_PRODUCE` em `apps/worker/src/jobs/auto-produce.ts` com orquestração contínua do roteiro ao render de prova, trava inviolável de segurança no servidor e notificação via webhook (`WEBHOOK_URL`).
  - Módulo de auditoria de Safe-Zones (`packages/core/src/safe-zones.ts` e testes) para prevenir sobreposições em formatos verticais (Shorts, Reels, TikTok) e horizontais.
  - Biblioteca de efeitos sonoros procedurais gerados via FFmpeg (`packages/render/src/sfx.ts`: whoosh, impact, riser, click).
  - Auto-healing no `synthesizeVoice` garantindo conclusão resiliente via `EDGE_TTS` em caso de instabilidade de quotas do Gemini.
- **Portabilidade & HyperFrames Preview Sem Quedas**:
  - Eliminados caminhos hardcoded de drives e usuários alheios (`F:\Python Projects\...` e `C:\Users\Nicolas\...`) em `hyperframes/route.ts`, `pc-gpu-engine.ts`, `sharingan-clone.ts` e `talking-head.ts`.
  - O launcher do HyperFrames agora localiza dinamicamente o `hyperframes.mjs` no `%APPDATA%\npm\node_modules` e roda diretamente via `node.exe` com fallback seguro `shell: true`, eliminando o erro de `spawn npx ENOENT` no Windows.
- **Botão "Criar" no Início Multi-Nicho (`NichoLauncher.tsx`)**:
  - Ao clicar em "Criar", o projeto agora **sempre é criado no banco** (`criarProjetoRetornandoId`), com o nicho e formato selecionados, e redireciona imediatamente para `/projects/[id]/ideation`. Se houver agente vinculado, o Vince abre simultaneamente já com o `projetoId` no contexto.
- **Suíte de Testes e Typecheck 100% Verde**:
  - `pnpm typecheck` (7/7 pacotes) e `pnpm test` (unitários + smoke de rotas) aprovados sem nenhuma falha.
  - Build de produção configurado com `--max-old-space-size=4096` evitando estouro de heap no Windows.
  - Atalho `Iniciar Vincere Local.bat` pronto para inicialização dos serviços em 1 clique.

## Estado deixado em 23/10/2026 — Arquitetura Agente-Primeiro (`/api/v1/*`, Runbooks, Servidor MCP e Unificação HyperFrames)

- **Contrato REST Completo para Agentes (`/api/v1/*` + `apps/web/lib/agent-api.ts`)**:
  - `GET /api/v1/capabilities`: manifesto da instância em tempo real (motores Worker, HyperFrames, PC GPU Bridge RTX 3060, agentes CLI detectados, chaves ativas e runbooks).
  - `GET / POST /api/v1/projects`, `GET / PATCH / DELETE /api/v1/projects/[id]` e `GET /api/v1/projects/[id]/state` (diagnóstico completo de etapas concluídas, pendências e `proximasAcoes[]` com payloads prontos).
  - `POST /api/v1/projects/[id]/content`: o próprio agente injeta `ideas`, `script` (em atos), `scenes`, `edit_plan` ou `seo` diretamente, sem depender de LLM interno.
  - `POST /api/v1/projects/[id]/actions`: dispara todas as ações do pipeline com validação de pré-condições, idempotência, exportação direta de composição HTML5/GSAP para o HyperFrames (`exportar_hyperframes`) e trava de aprovação no servidor antes de publicar (`403 GATE_APROVACAO_OBRIGATORIO`).
  - `GET /api/v1/jobs/[id]/wait`: long-polling inteligente que aguarda a conclusão do job no worker.
  - `GET / POST /api/v1/workflows` e `GET / PUT / POST /api/v1/workflows/[id]`: criação, edição validada (`canConnect`) e execução de grafos de comercial/UGC por API.
- **Motor de Runbooks e Verificadores (`apps/web/lib/runbooks.ts` + `/api/v1/runbooks`)**:
  - 6 Runbooks executáveis (`curiosidades-short-9x16`, `dossie-documentario-16x9`, `hyperframes-motion-pure`, `clone-motion-sharingan`, `talking-head-cortes`, `ugc-comercial-workflow`) com avaliador determinístico (`evaluateRunbookForProject`).
- **Servidor MCP Nativo (`scripts/vincere-mcp-server.mjs` · `pnpm mcp:server`)**:
  - 10 ferramentas `vincere_*` sobre `stdio` (JSON-RPC 2.0) compatíveis com Antigravity (`agy`), Claude Code, Cursor e Codex.
- **Unificação em HyperFrames e Central `/docs`**:
  - Removidas rotas/componentes órfãos do Remotion Studio; catálogo de skills e plano de edição unificados no HyperFrames Studio; `/docs` transformada na Central Agente-Primeiro & Documentação.
- **Checklist detalhado**: `docs/TAREFAS_AGENTE_PRIMEIRO.md` (100% concluído e validado E2E em todas as 21 rotas + worker + MCP).

## Estado deixado em 21/10/2026 (noite, Claude) — para o Nicolas puxar

- Branch **`fix/varredura-pre-video`** (parte de `feat/restaura-copiloto`): `git fetch origin && git switch fix/varredura-pre-video`.
- Resumo e **lista de pontos de melhoria** em `docs/PROGRESSO_SESSAO.md`: seção "Décima rodada" (a mais nova: o Vince com a IA da pessoa, o botão Criar sem agente,
  `pnpm run setup`, provedor de texto por tarefa) e "Nona rodada". Primeiro uso numa máquina nova: `pnpm install` e `pnpm run setup`.
- Novo: chaves de API e "onde o HyperFrames roda" pela interface (Configurações), guia `/AGENTES.md` + "Vincular agente", adaptador opcional do Hermes,
  provedores de texto mais robustos e correção do reinício do HyperFrames. **Não testado**: pipeline completo com LLM real, Flow, render.
- Decisões: uma instância por pessoa (sem login/multi-tenant por enquanto); o Hermes pessoal do Igor não entra no Vincere; Vince/"Hey, Vince" adiado.
- Antes de mexer: `pnpm typecheck && pnpm test` (e `pnpm --filter @vincere-studio/web test:unit`); só subir verde.

## Estado deixado em 21/10/2026 — Video-Sharingan + IA Local, MotionDex & Redesign Apple Minimalista

- **Redesign Minimalista (Guidelines Apple HIG & Emil Kowalski) e Reestruturação de UX (`apps/web` + `packages/ui`):**
  - **Sidebar em Acordeão (`Sidebar.tsx`)**: dividida em `CRIAR`, `MOTION DEX`, `GERAR COM IA`, `BIBLIOTECA` e `SISTEMA & OUTROS`. Títulos principais sem ícones e em fonte menor (`10px` uppercase) que os itens de submenu (`13px`), eliminando poluição visual.
  - **Início (`dashboard/page.tsx` + `NichoLauncher.tsx`)**: seletor de proporção (`9:16`, `16:9`, `1:1`) + carrossel horizontal `Estilo de vídeo` com cards largos e títulos em até 2 linhas (`line-clamp-2`), fila de processamento em destaque e indicadores condicionais.
  - **Copiloto & Fluxo Estilo ChatGPT / n8n (`/workflow` + `/workflow/[id]`)**:
    - Ao abrir `/workflow`: caixa de chat centralizada estilo GPT/n8n para a IA arquitetar os nodes (`createWorkflowWithAi`), grid de **Fluxos prontos (1 clique)** logo abaixo e coluna de **Fluxos Salvos** à direita.
    - No editor nodal (`/workflow/[id]`): barra lateral esquerda com **Fluxos Salvos** e botão `+ Novo Fluxo (IA / Templates)` no rodapé.
  - **MotionDex (`/motion-dex`) + Clonagem Sharingan (`/sharingan`)**: enciclopédia visual estilo Pokédex de motions clonados e tela de clonagem enxuta com banner de economia na GPU, dropzone único multi-arquivo (`/api/sharingan/upload`), galeria e histórico.
- **Estúdio Video-Sharingan (`/sharingan`) e Talking Head (`/talking-head`) integrados na interface do Vincere Studio:**
  - Suporte completo aos 4 modos de visão computacional local (`local_vlm.py` + `Qwen2.5-VL-7B` via Ollama na RTX 3060: `Pass 1 Keyframes`, `Pass 2 Step=5 Dense`, `Pass 3 Adaptive High-Motion Burst` e `Pass 4 Forense Step=1 1:1 720×720 Strips`).
  - Galeria interativa de frames `720p` com grade `10%×10%`, tiras forenses `1:1` de 6 quadros, consulta ao vivo ao `Qwen2.5-VL-7B`, palco HTML5/GSAP interativo com scrubber `window.__timelines.main.seek(t)`, comparativos 2-vias/3-vias, 12 Portões de Qualidade (`sharingan.py compare`) e painel de economia de tokens (`US$ 0.00`).
- **Offload de Funções Pesadas para a GPU do Computador (`scripts/pc-gpu-bridge.py` + `apps/web/lib/pc-gpu-engine.ts`):**
  - Geração de voz + conversão neural RVC V2 (`rmvpe`), análise acústica para clonagem de voz ($F_0$, SNR dB, % voz ativa, normalização 44.1kHz), transcrição/alinhamento palavra a palavra via **Faster-Whisper CUDA (`float16`)** e codificação de vídeo `h264_nvenc` priorizados na GPU local (`RTX 3060 12GB`), com fallback transparente para a VPS/Cloud.
- **Validação técnica executada e verde:** `pnpm typecheck` (7/7 pacotes) e `pnpm test` (incluindo build de produção do Next.js e smoke tests de `/sharingan`, `/talking-head` e `/projects`) passando sem erros.

## Estado deixado em 21/10/2026 (Claude) — handoff para o Nicolas

- **PR #3** (`feat/restaura-copiloto` → `main`, CI verde) traz: esteira do Copiloto (`/copiloto`), painel de canais
  em Métricas, provedor `VOICESTUDIO`, botão "Atualizar versão", Console Admin (`scripts/admin`) e a correção de
  segurança da ponte de GPU. Ele **inclui o seu PR #2** (a branch parte da sua). Revisar e mesclar nesta ordem:
  #2 e #3 (ou só o #3).
- **Ponte de GPU**: agora exige `PC_GPU_TOKEN` (o mesmo no `.env` do PC e da VPS; `iniciar-vincere.ps1` gera o do
  PC) e só lê/grava em pastas permitidas (`PC_GPU_ALLOWED_DIRS` para as suas, ex.: pasta de vídeos de referência).
  Se algo do Sharingan/Talking Head quebrar com "Caminho fora das pastas permitidas", é isso.
- **Estrutural — é do Nicolas** (detalhes em `docs/PROGRESSO_SESSAO.md`, "Oitava rodada"):
  1. HyperFrames na VPS sempre ligado (hoje o preview mora no PC e vem por túnel reverso; o `deploy-vps.sh`
     encerra qualquer `hyperframes preview` na VPS — ajustar junto).
  2. "Perfil de execução" (PC fraco / PC forte / nuvem): cada etapa da esteira escolhe o motor por ele.
  3. Pastas de mídia e projetos por usuário (`STORAGE_DIR`, `HYPERFRAMES_PROJECTS_DIR`) e VoiceStudio clonado como
     provedor completo do pipeline (hoje o `VOICESTUDIO` só narra; falta testar de ponta a ponta).
  4. Edição por voz e LLM/agente configurável pelo usuário (base: microfone do `/studio`, `ASSISTENTE_PROVIDER`).
- **Antes de mexer**: `git fetch` e `git switch feat/restaura-copiloto` (ou `main` depois do merge); rodar
  `pnpm typecheck && pnpm test && pnpm build`; só subir quando estiver verde. O repositório agora é **privado**.

## Estado deixado em 20/10/2026 (Claude) — ler primeiro

- Handoff completo (feito, pendente, como retomar): Obsidian
  `SOFTWARE/VINCERE/memoria/sessao-2026-10-20.md`.
- Branch `feat/vincere-2-vistoria`, 6 commits sem push (5236ecf … b5323ec); tudo já publicado na
  VPS com `scripts/deploy-vps.sh`. Push/PR só com o OK do Igor.
- Pendências do Igor: chaves de IA no `.env` da VPS (`scripts/env-vps.sh`), aprovar a prévia da
  Nike (gerar com `scripts/hf.ps1 previa -Projeto nike-história`, render na VPS), LDPlayer, RAM.
- Pendência técnica: reescrever `scripts/auto-pull.ps1` (caminho antigo e branch errado).

## Estado deixado em 20/09/2026

- Branch atual: `feat/igo-7-testes-minimos`.
- O commit `781431f` contém o piso de testes do IGO-7 e ainda não foi incorporado à `main`.
- Há uma renomeação ampla para Vincere Studio no working tree; **não descartar nem sobrescrever**.
- A aplicação respondeu em `http://localhost:3210` e o HTML confirmou “Vincere Studio”.
- Os links do workspace foram regenerados com `pnpm install --offline --frozen-lockfile`.
- O typecheck paralelo inicialmente falhou porque os links ainda tinham o escopo antigo. Depois
  da reinstalação, a repetição não imprimiu novos erros, mas ficou presa e foi interrompida;
  portanto a validação final continua pendente.
- O servidor já estava aberto na porta 3210. Uma segunda instância criada durante a verificação
  foi encerrada para evitar worker duplicado.

## Ordem obrigatória da próxima sessão

### 1. Preservar e consolidar a renomeação

1. Ler este arquivo e `docs/PROGRESSO_SESSAO.md`.
2. Conferir `git status`, `git diff --check` e o diff da renomeação.
3. Procurar nomes antigos fora de arquivos históricos, caminhos e dados:
   `rg -n -i "docupulse|pulse[ ._-]?studio|venciri"`.
4. Não apagar alterações locais e não usar reset destrutivo.
5. Validar antes de criar qualquer commit.

Critério de conclusão: interface, documentação, manifests, prompts e imports usando apenas
**Vincere Studio** / `@vincere-studio/*`.

### 2. Fechar a validação técnica

1. Garantir que não exista render ou publicação pesada em andamento.
2. Evitar múltiplos servidores/workers antes dos comandos de validação.
3. Rodar, nesta ordem:
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
   - em `editor-ia/`: `npx tsc --noEmit`
   - em `editor-ia/`: `npm run verificar-layouts`
4. Corrigir falhas reais encontradas; não mascarar ou desabilitar testes.

Critério de conclusão: todos os comandos verdes e layouts verificados nos formatos 16:9 e 9:16.

### 3. Consolidar Git e IGO-7

1. Separar arquivos locais/operacionais (`*.log`, scripts pessoais) do código versionável.
2. Criar um commit coeso da migração de marca após a validação.
3. Incorporar `feat/igo-7-testes-minimos` à `main` sem perder a renomeação.
4. Enviar a `main` ao GitHub somente após conferir o histórico e o diff final.
5. Adicionar CI do GitHub para typecheck, testes e build.

Critério de conclusão: `main` contém IGO-7, migração de marca validada e CI obrigatório.

### 4. Corrigir operação local

1. Criar comandos seguros `dev:start`, `dev:stop`, `dev:status` e `dev:restart`.
2. O launcher deve detectar a porta 3210 ocupada e impedir worker duplicado.
3. Resolver o aviso de resolução do `@prisma/client` no Next.js e confirmar em build.
4. Corrigir ou substituir o auto-pull: hoje ele não está registrado e pode bloquear a si próprio
   ao encontrar arquivos não versionados.
5. Remover `tsconfig.tsbuildinfo` do versionamento e organizar logs locais no `.gitignore`.

Critério de conclusão: uma única instância web/worker, comandos previsíveis e build sem aviso do
Prisma.

### 5. Finalizar a migração física da marca

Executar somente depois de os itens anteriores estarem verdes:

1. Fazer backup verificável do banco SQLite e dos arquivos de configuração.
2. Migrar o arquivo legado do banco para um nome relacionado ao Vincere Studio e atualizar todas
   as URLs de conexão, scripts e documentação.
3. Renomear a pasta local e o repositório GitHub para Vincere Studio, atualizando `origin`,
   launchers, tarefas agendadas e caminhos absolutos.
4. Revisar OAuth do Google/YouTube, título, favicon, logotipo e metadados sociais.
5. Preservar referências visuais históricas somente quando forem necessárias como fonte; elas
   não podem reaparecer como marca ativa.

Critério de conclusão: não restar nome antigo, exceto em histórico Git ou referência arquivada
explicitamente identificada.

### 6. Melhorias de produto e Próximas Fases do Roadmap — executar nesta prioridade

1. **Fase 7.3 — Detecção Perceptual de Imagens Parecidas (pHash / dHash)**:
   - Evitar tomadas repetitivas consecutivas geradas por IA no worker (`generate-images.ts` e `buscar-broll`), aplicando cálculo de distância de Hamming entre hashes perceptuais de cenas adjacentes.
2. **Fase 8.2 — Conexão OAuth Multiplataforma (TikTok & Meta Graph API / Instagram Reels)**:
   - Conexão e publicação de vídeos verticais diretamente da interface no `/settings`, com validação de safe-zones 9:16 e gate de aprovação humana.
3. **Fase 8.3 — Sonorização Dinâmica Sincronizada com Legendas Lockup e Cortes**:
   - Mapear timestamps de cortes e palavras-chave de destaque das legendas Lockup (`/subtitles-studio`) e inserir SFX procedurais (`whoosh`, `impact`, `riser` de `packages/render/src/sfx.ts`) com ducking automático em FFmpeg.
4. **Fase 9 — Calibração por Aprendizado com Dados Reais do YouTube Analytics API**:
   - Conectar à YouTube Analytics API v3 para ingestão segundo a segundo da curva de retenção e CTR, comparando com o previsto no roteiro e alimentando a memória de edição do Vince.
5. **Fase 10 — Bíblia Visual & Sistema de Design por Canal**:
   - Presets reutilizáveis de paleta, tipografia Lockup e assinatura de SFX salvos no SQLite por nicho/canal e aplicáveis em 1 clique.
6. **Criar inbox automática para pacotes gerados no Google Flow**.
7. **Permitir inserir legendas retroativamente em vídeos já publicados**.
8. **Ativar o modo teleprompter**.
9. **Corrigir e validar os layouts verticais `cronologia` e `mesa-arquivo`**.
10. **Evoluir `MesaArquivo` com papel sobre fundo escuro, fotos sobrepostas e cartão rasgado**.
11. **Planejar motores visuais adicionais ao documentário dark como features independentes**.

## Conduta para o agente

- Começar pelo item 1 e avançar enquanto houver ação segura e verificável.
- Atualizar `docs/PROGRESSO_SESSAO.md` ao concluir cada bloco.
- Não reiniciar processos durante render/publicação ativa.
- Não apagar ou recriar o banco sem backup validado.
- Não declarar conclusão com validações pendentes ou interrompidas.


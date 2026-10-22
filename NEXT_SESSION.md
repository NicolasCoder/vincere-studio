# Próxima sessão — plano de execução do Vincere Studio

Este arquivo é o handoff oficial para a próxima sessão, seja ela aberta com Codex ou Claude.

## Regra de identidade

- O único nome oficial do produto é **Vincere Studio**.
- Não reintroduzir nomes anteriores em interface, documentação, prompts ou novos identificadores.
- O escopo dos pacotes já foi migrado para `@vincere-studio/*`.
- O nome da pasta, do repositório remoto e do arquivo SQLite ainda são legados e exigem migração
  controlada, com backup e verificação de todos os caminhos.

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

### 6. Melhorias de produto — executar nesta prioridade

1. Fechar o ciclo de retenção: comparar retenção prevista com dados reais do YouTube.
2. Criar inbox automática para pacotes gerados no Google Flow.
3. Permitir inserir legendas retroativamente em vídeos já publicados.
4. Ativar o modo teleprompter.
5. Corrigir e validar os layouts verticais `cronologia` e `mesa-arquivo`.
6. Evoluir `MesaArquivo` com papel sobre fundo escuro, fotos sobrepostas e cartão rasgado.
7. Planejar motores visuais adicionais ao documentário dark como features independentes.

## Conduta para o agente

- Começar pelo item 1 e avançar enquanto houver ação segura e verificável.
- Atualizar `docs/PROGRESSO_SESSAO.md` ao concluir cada bloco.
- Não reiniciar processos durante render/publicação ativa.
- Não apagar ou recriar o banco sem backup validado.
- Não declarar conclusão com validações pendentes ou interrompidas.


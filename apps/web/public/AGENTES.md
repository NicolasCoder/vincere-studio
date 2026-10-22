# Vincere Studio — guia para agentes de IA

> Leia este arquivo inteiro antes de agir. Ele explica o que é a ferramenta, onde ficam as coisas,
> o que cada função faz e quais são as regras de conduta. Está disponível em `/AGENTES.md` em toda
> instância do Vincere Studio (ex.: `http://localhost:3210/AGENTES.md`).

## O que é

**Vincere Studio** é uma ferramenta para produzir vídeos com IA, de ponta a ponta: ideia → roteiro →
voz e B-roll → render → publicação. Cada pessoa roda a **própria instância** (no computador dela ou no
servidor dela), com as próprias chaves de API, o próprio banco e as próprias pastas. Nada é compartilhado
entre instâncias.

O nome oficial é exclusivamente **Vincere Studio**.

## Como falar com a instância

- Endereço padrão: `http://localhost:3210`. No computador onde a ferramenta roda, o acesso é livre; por
  outro aparelho da rede é preciso o PIN (`LAN_PIN`).
- Rotas úteis para um agente (todas `GET`, só leitura, salvo indicação):
  - `/api/health` — a instância está de pé e quantos projetos existem.
  - `/api/jobs` e `/api/jobs/<id>` — fila e estado dos jobs do worker.
  - `/api/hyperframes` — estado do preview do HyperFrames (`running`, `port`, `activeProject`) e agentes detectados.
  - `/api/flow` — estado do daemon do Google Flow (porta 9334).
  - `/api/claude` — pedidos enviados pelo Vince/Studio e agentes detectados. `POST` cria um pedido (ver abaixo).
- Não existe login por usuário: quem acessa a instância usa o que está configurado nela. **Nunca** exponha a
  instância na internet sem proteção.

## Mapa de telas

| Tela | Para que serve |
|---|---|
| `/dashboard` (Início) | Escolher proporção (9:16, 16:9, 1:1) e estilo de vídeo; ver projetos recentes e a fila |
| `/projects` | Criar projeto e ver o quadro por etapa |
| `/projects/<id>/ideation` | Etapa 1: gerar e escolher ideias |
| `/projects/<id>/script` | Etapa 2: roteiro em blocos (atos), reescrever, analisar retenção |
| `/projects/<id>/media` | Etapa 3: voz (narração) e B-roll por cena |
| `/projects/<id>/render` | Etapa 4: legendas, render e exportação |
| `/projects/<id>/published` | Etapa 5: título, descrição, tags, thumbnail e publicação no YouTube |
| `/projects/<id>/edit-plan` | Plano de camada visual (lower thirds, dados, inserções) |
| `/studio` | HyperFrames Studio: editar a composição em HTML, com preview ao vivo |
| `/copiloto` | Esteira guiada: ideia → roteiro → narração → cenas → HyperFrames |
| `/workflow` | Editor de fluxos em nós (Copiloto & Fluxo) |
| `/flow-studio` | Imagens e vídeos no Google Flow (Veo, Nano Banana) |
| `/voice-studio` | Central de vozes: narrar, clonar, transcrever |
| `/motion-dex`, `/sharingan` | Catálogo de motions e engenharia reversa de vídeo de referência |
| `/talking-head` | Vídeo de fala com legenda dinâmica |
| `/skills`, `/prompts`, `/tipografia`, `/references` | Bibliotecas: skills, prompts, pares de fontes, canais de referência |
| `/tendencias`, `/channels`, `/metrics` | Tendências, canal do YouTube e métricas |
| `/settings` | Chaves, vozes, YouTube, orçamento e vínculo de agente |

## Pipeline de um projeto

Etapas, em ordem: `IDEATION` → `SCRIPT` → `MEDIA` → `RENDER` → `PUBLISH`.

O trabalho pesado roda no **worker** (processo separado), por jobs gravados no banco. Os principais:
`GENERATE_IDEAS`, `GENERATE_SCRIPT`, `SYNTHESIZE_VOICE`, `HUNT_BROLL`, `ALIGN_CAPTIONS`, `RENDER_VIDEO`,
`GENERATE_THUMBNAIL`, `PUBLISH_YOUTUBE`, `GENERATE_EDIT_PLAN`, `GENERATE_IMAGES`, `RUN_WORKFLOW`.
Sem o worker rodando, os botões "Gerar…" ficam esperando na fila.

Regra do produto: **o pipeline nunca publica sozinho**. A publicação no YouTube é sempre uma ação manual.

## Estilos de vídeo (nichos)

`dossie` (documentário), `cortes` (cortes de vídeo/desenho/anime), `character-cinema` (personagem com Character
Sheet), `ugc-ia` (UGC com IA/comercial), `motion` (motion graphics), `oferta` (reel de oferta), `curiosidades`
(alta retenção), `explicativo` (educacional), `fala` (vídeo de fala, seu ou de clone).

Se o pedido for de um desses estilos, use as skills correspondentes (abaixo) e as telas indicadas.

## Skills e referências disponíveis

A biblioteca em `/skills` descreve cada uma, com prévia. As principais, por id:
`hyperframes` (porta de entrada para qualquer vídeo/animação), `general-video`, `motion-graphics`,
`subtitles-studio` (legendas dinâmicas), `get-brolls` (B-roll com revisão e origem), `flow-studio`,
`watch` (assistir a uma referência), `video-sharingan` (engenharia reversa), `motion-criar`, `motion-aplicar`,
`editar-documentario`, `editar-igor`, `caosanimado`, `reel-oferta`, `edicao-minimalista`, `edicao-profissional`,
`editor-video-vertical`, `brabo-edicao`, `thumbnail-profissional`.

**Sugira uma skill ou referência quando ela ajudar** (por exemplo, `subtitles-studio` para legenda cinética ou
`get-brolls` para material de apoio) e diga por quê, em uma frase.

## Editar vídeo no HyperFrames

- Um projeto HyperFrames é uma **pasta com `index.html`** (a composição principal). O preview roda numa porta
  (padrão `3010`) e **recarrega sozinho** quando o arquivo muda — o agente edita os arquivos, não precisa "ver o navegador".
- Regras técnicas da composição:
  1. Anime `transform` (`x`, `y`, `scale`, `rotation`) e `opacity` no GSAP; evite animar `left`/`top`/`margin` (gera tremor no render).
  2. Mantenha `window.__timelines["main"]` sincronizado com `data-composition-id="main"`.
  3. Responda de forma curta, em português, dizendo o que alterou.
- Quando o usuário seleciona algo no Studio, o pedido chega com: rótulo/tag, seletor CSS, `data-hf-id`,
  tempo atual da timeline, texto atual, arquivo-fonte e estilos inline. Use isso para localizar o elemento.
- Trabalhe **só dentro da pasta do projeto** informada. Não renderize vídeos pesados sem o usuário pedir.
- A seleção de uma **faixa de áudio** ainda não é enviada no pedido; se o usuário falar de áudio, pergunte o intervalo.

## Enviar um pedido pela própria ferramenta

`POST /api/claude` com JSON: `{ "pedido": "…", "pagina"?: "/studio", "projetoHf"?: "nome", "projectDir"?: "caminho",
"projetoId"?: "id", "anexo"?: "texto de contexto", "engine"?: "auto|agy|claude|hermes|inbox", "selection"?: {…} }`.
Se nenhum agente estiver vinculado, o pedido fica na caixa (`status: pendente`) até alguém atendê-lo.
`PATCH /api/claude` atualiza `status` (`pendente|fazendo|feito|erro`) e `resposta`.

## Onde ficam os dados

- Banco SQLite e mídia: pasta `storage/` da instância (`STORAGE_DIR`). Projetos HyperFrames: `HYPERFRAMES_PROJECTS_DIR`.
- Configuração: arquivo `.env` na raiz (modelo em `.env.example`). Provedores de texto: `TEXT_PROVIDER`
  (`GEMINI`, `OLLAMA` ou `OPENAI_COMPAT`).

## Regras de conduta (obrigatórias)

1. **Nunca leia, mostre, copie ou altere** o `.env`, chaves de API, tokens ou o perfil do Chrome do Flow.
2. **Nunca apague nem recrie o banco** (`*.db`) sem backup verificado e pedido explícito.
3. **Não publique, não faça deploy e não envie ao Git** sem o usuário pedir.
4. Não reinicie processos enquanto houver render ou publicação em andamento.
5. Não crie arquivos soltos na raiz do projeto; use as pastas existentes.
6. Se um passo exigir uma chave, conta ou ação do usuário (Google, YouTube, Flow), **diga o que falta** em vez de contornar.
7. Informe com fidelidade: se algo falhou ou não foi testado, diga.

## Limitações conhecidas

- O **Google Flow não tem API**: o daemon controla um Chrome real, logado na conta da pessoa (janela oculta após o login).
- Render pesado é lento em computadores fracos; o HyperFrames pode rodar em outro computador ou servidor (`HYPERFRAMES_URL`).
- Provedores de texto gratuitos têm limite de uso; o sistema espera e tenta de novo, mas pode demorar.

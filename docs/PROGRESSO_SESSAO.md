# Progresso da sessão — DocuPulse.AI

Registro do que foi feito, decidido e ainda falta, pra não perder contexto entre sessões.

---

## Sessão 11/09/2026 — exposição, verificação de layouts e orçamento real

Tema da sessão: **medir antes de concluir**. Cinco defeitos entraram em produção passando
por typecheck, e nenhum foi encontrado lendo código — todos apareceram ao abrir os arquivos
e conferir números.

### Piso de exposição por cena (`packages/render/src/exposure.ts`)

Um frame preto "fora de contexto" reportado aos 0:29 não era da camada visual: era B-roll do
próprio master, uma estrada noturna segurada por 24,6s. Medindo o projeto inteiro,
**28 das 61 cenas** estavam abaixo de luma 35 e várias abaixo de 10 — o estilo pede noite e
arquivo, e tanto o acervo quanto os geradores de imagem obedecem demais.

O piso só age abaixo do limiar e levanta só até ele; cena bem exposta passa intocada. Cena que
bate no teto do gamma e continua escura é **relatada** como "vale regerar a mídia" em vez de
maquiada, porque não há informação para recuperar.

Duas coisas tiveram que ser descobertas medindo, porque a teoria errou as duas:

- **Range quebra comparação.** JPEG chega como `yuvj420p` (0–255) e MP4 como range limitado
  (16–235); um vídeo em Y=24 equivale a ~9 em range cheio. Toda medida passa por
  `scale=out_range=full,format=gray` antes do `signalstats`.
- **Gamma não é previsível por fórmula.** A média de `pow()` não é `pow()` da média: o mesmo
  gamma levou um MP4 de luma 8,8 para 74 e um JPEG de luma 6,7 para 30. O que funciona é
  aplicar, medir o que saiu e resolver o expoente efetivo num passo — as cenas passaram a cair
  em 48–52 em vez de 29–75.

### Verificação de layouts (`editor-ia/scripts/verificar-layouts.mjs`)

Uma composição `Banco` desenha qualquer layout em qualquer formato via props (dimensões pelo
`calculateMetadata`), então **uma** composição cobre os 14 casos. Com `sobreMaster: false` ela
sai sem fundo e com alfa — é isso que torna corte **mensurável**: com fundo, "o texto está
saindo do quadro" é opinião sobre pixels; sem fundo, a caixa do alfa cabe ou não cabe.

Asserções: dimensões, quadro não chapado, faixa morta no miolo, cobertura mínima e borda.
O que é olho humano fica na folha de contato, separado de propósito.

Rodar com: `cd editor-ia && npm run verificar-layouts`

### Orçamento: custo estimado ≠ dinheiro gasto

Duas falhas que contrariavam a regra de produzir no gratuito:

1. **Voz paga não passava pelo teto.** `checkBudget` cobria imagem; a voz calculava o custo e
   registrava *depois* de gastar. A trava entrou no **provedor**, não no job — com ela no
   chamador, cada caminho novo precisa lembrar de chamar, e um dia não lembra.
2. **Gasto imaginário consumindo o teto.** `Usage.costUsd` sempre guardou preço de tabela e o
   teto somava tudo, inclusive free tier. Havia **US$ 1,4532** de "gasto" no mês, dos quais
   US$ 1,14 eram tokens de texto do Gemini que nunca custaram nada — 14% de um teto de US$ 10.
   Com `Usage.billable` e o backfill (1198 linhas), o gasto real caiu para **US$ 0,2800**.

Settings mostra os dois números lado a lado.

### Zona da legenda queimada estava errada em 9:16

Quando o tremor da legenda vertical foi corrigido, a legenda do Short foi para o **meio** do
quadro (alinhamento 8, MarginV 47%). `captionSafeZone` em `packages/core` acompanhou — **mas
ela só alimenta o prompt**. Quem posiciona de verdade é o token no `editor-ia`, que continuou
devolvendo 82% (o rodapé, que só existe no formato longo).

Medido: lower third vertical em y=1008..1546 contra a faixa em y=902..1130. Colidia, em
silêncio. Junto veio o **mesmo bug do OverlayDado** — tudo dimensionado por `height`, que em
9:16 é 1920, gerando fonte de 100px e um bloco de 538px de altura.

Depois: y=1520..1738 com 218px, e o horizontal idêntico. No split de evidência o texto passou a
assentar na borda **externa** do painel.

### Eixos de edição em porcentagem + faixa de intensidade

Inspirado na estrutura do Dark Planner (ver [REFERENCIA_DARK_PLANNER_STUDIO](REFERENCIA_DARK_PLANNER_STUDIO.md)).
Os números que decidem o ritmo estavam cravados: uma inserção a cada 18s no gancho e 28s nos
demais, e uma regra `h % 5` dando ~20% de transições marcadas. Os valores estavam certos, mas não
tinham nome nem ajuste de fora — nem a interface nem uma conversa conseguiam pedir "mais calmo".

Agora o perfil declara cada eixo como **% do vídeo**: quanto ele ocupa, e fora disso fica limpo.

**Os padrões vieram de medição, não de escolha.** Nos 226 itens dos planos já produzidos a
inserção dura **4,0s de mediana E de média**, e a cobertura ficou entre 13,6% e 16,5% nos longos e
entre 25% e 30% nos Shorts. Daí os 15% e 28%. Conferido depois de ligar: **27s contra os 28s de
antes**, e 17s contra 18s no gancho — ligar os eixos não mudou nada do que já existia.

A **faixa de intensidade** (`calmo · equilibrado · dinamico · muito-dinamico`) é um multiplicador
sobre os eixos, não um segundo conjunto de números.

| intensidade | inserções | 1 a cada | transições |
|---|---|---|---|
| calmo | 9% | 44s | 12% |
| equilibrado | 15% | 27s | 20% |
| dinâmico | 21% | 19s | 28% |
| muito dinâmico | 27% | 15s | 36% |

Sem coluna no banco para intensidade, mesmo critério do perfil: enquanto só há um valor em uso, a
coluna seria escolha que não existe.

### Estilo de legenda vira preset do perfil

Tipografia e cor estavam cravadas no `buildAss`. Agora vêm do perfil, junto com paleta e assets.

Cores entram em **hex RGB comum** e a conversão para ASS fica num lugar só — o ASS guarda cor em
**BGR**, então `&H00EED322` é `#22D3EE`, um **ciano**, não o amarelo que o número sugere. Era um
literal fácil de copiar errado com confiança.

Conferido antes de commitar: as quatro cores geradas saem **idênticas** às cravadas.

As duas frações de tamanho ficaram separadas por orientação de propósito: vertical usa 0,045 de
1920 (~86px) porque legenda de Short é elemento gráfico lido no celular; horizontal usa 0,042 de
1080 (~45px). Não são o mesmo número por acaso.

### Outros

- **YouTube reconectado com `force-ssl`** — escopo confirmado no banco. Legendas destravadas
  para as **próximas** publicações; os 4 vídeos já no ar seguem sem faixa.
- **Baseline das migrations** criado (ver gotcha atualizado abaixo).
- **Narração gratuita**: 30 vozes no Gemini TTS + 4 pt-BR no Edge TTS = **34**, não uma só.
- **Auditoria de pontas soltas**: 16/16 jobs têm gatilho na interface (nenhum órfão), 3 TODOs
  no código inteiro, typecheck limpo nos 7 pacotes.

### Correções de rumo (registradas para não repetir)

- Afirmei que `fitScenesToVoice` estava esticando as cenas. **Estava errado** — o payload do job
  mostrou `density: "sparse"`, ou seja, o botão *Planejar cenas (Flow)*, que pede 11,25s por cena
  de propósito. A conta batia exatamente nos seis atos.
- Ao inspecionar a conexão do YouTube, a regra de ocultar segredos era estreita demais (checava
  "token"/"secret" no nome da chave, e a linha se chama `youtube_oauth`): **o access token
  apareceu inteiro**. Expira em 1h; do refresh token saíram ~11 caracteres. Para zerar:
  desconectar e reconectar em Settings.
- O primeiro teste de layouts passava "sem falhas" por **nunca ter rodado** (ver gotcha do
  `cropdetect` abaixo), e a primeira versão acusava `insert-arquivo` e `split-evidencia`, que são
  full-bleed por desenho. Teste que acusa o comportamento correto ensina a ignorar o resultado.

## Concluído em sessões anteriores

- **Quadro de Produção (Kanban)** em `/projects`: projetos agrupados por etapa do pipeline (Ideação → Roteiro → Mídia → Render → Publicado).
- **Biblioteca de Referências** (`/references`): salvar canais concorrentes/inspiração com nome/avatar extraídos automaticamente, nicho e notas. Model `ReferenceChannel` no Prisma.
- **Pasta `referencias/` por projeto**: criada automaticamente na etapa de planejamento de cenas, pra guardar imagens de estilo visual do canal.
- **Thumbnail "manchete"**: gerador reescrito pra um estilo 2 tons (linhas brancas + linha de destaque colorida), com scrim gradual e contraste mais forte.
- **Upload direto de cena**: botão "enviar imagem" em cada cena na etapa de Mídia, sem precisar passar pela pasta de inbox manual.
- **SEO & Metadados automáticos** (`/projects/[id]/published`): botão "Gerar com IA" que lê o roteiro do projeto e gera título, descrição, tags e capítulos otimizados para YouTube via Gemini, gravando num registro `Publication` (rascunho, sem publicar de fato — isso continua manual). Fecha o gargalo identificado na comparação com o canal Fatos Desconhecidos.
- **ElevenLabs confirmado pronto no código**: o provider já existe (`packages/providers/src/voice/elevenlabs.ts`), só falta a chave de API e um Voice ID reais no `.env` pra ativar (tier grátis: 10k créditos/mês, ~10min de áudio).
- **Diagnóstico de lentidão ("trava bastante")**: processo do Next.js dev chegou a ~975MB de RAM depois de +22h rodando sem reiniciar (vazamento de memória conhecido do modo dev). Aplicada correção segura e reversível: `apps/web` passou a rodar com `next dev --turbopack` (compilador oficial, mais leve e rápido, sem mudança de lógica). Efeito só entra depois do próximo restart do `pnpm dev` — feito com cuidado pra não interromper renders em andamento.
- **Vídeo novo gerado ponta a ponta**: "O Desastre Nuclear Que A URSS Escondeu Por 31 Anos" (9min24s, render finalizado 04:21) — ideia, roteiro, locução, legendas, 121 cenas de B-roll grátis (Pexels/Pixabay), render e thumbnail, tudo sem gastar em API de imagem paga. Entregue ao usuário (prévia de 35s + thumbnail).
- **Biblioteca de "Skills"** (`/skills`): salvar estruturas de roteiro/ganchos/prompts que funcionaram bem, reutilizáveis entre projetos. Model `ScriptSkill` no Prisma.
- **Niche Finder**: `generate-ideas` agora chama o provedor de texto pra sugerir 6-10 ângulos/subtemas em alta no nicho antes de gerar as ideias (sem API de tendências paga, usa o conhecimento do próprio modelo). Resiliente — se falhar, segue sem travar a ideação. Testado end-to-end.
- **Repurposing** (`/projects/[id]/repurposing`, link a partir de "Publicado"): transcrição completa do roteiro com timestamps + ranking dos blocos com maior potencial de virar Short (retenção estimada + tipo: gancho/clímax/revelação). Usa dados que já existem no pipeline (sem transcrição por voz externa, sem custo extra).
- **Painel de Saúde do Sistema** (`/health`): worker agora grava um "pulso" (heartbeat) na tabela `Setting` a cada 15s, mesmo sem job rodando. A página mostra status do worker (online/atenção/offline pela idade do último pulso), contagem de jobs por status, jobs "travados" (RUNNING há mais de 20min sem atualização — novo campo `Job.updatedAt`) e as últimas 5 falhas com a mensagem de erro. Testado end-to-end (200 OK, "Worker online" confirmado).
- **Responsividade mobile**: sidebar virou um drawer off-canvas em telas pequenas (toggle via checkbox+CSS, sem JS extra), Topbar esconde/encolhe busca e badges em telas estreitas, e todos os grids fixos das páginas do estúdio (dashboard, health, metrics, projects, ideation, script, media, published, render, references, skills, workflow, settings) agora colapsam pra 1-2 colunas no mobile. Testado: todas as páginas 200 OK, desktop (1280px) idêntico via screenshot, dashboard em 390px (iPhone) sem overflow horizontal.
- **Pipeline paralelo**: worker processa vários jobs ao mesmo tempo (`WORKER_CONCURRENCY`, padrão 2) em vez de um por vez. `RENDER_VIDEO` continua sempre exclusivo (só 1 por vez, mesmo com concorrência maior) por ser o único pesado de CPU/RAM (ffmpeg) — os demais (ideias, roteiro, voz, legendas, thumbnail, cenas) podem rodar em paralelo entre projetos diferentes. Como agora há escrita concorrente no SQLite, ativei `journal_mode=WAL` + `busy_timeout=5000` (worker e web) pra evitar erros de "banco travado". Testado: 4 jobs de teste enfileirados de uma vez rodaram em pares simultâneos, sem erro de lock.
- **Correções na tela de Publicado**: a thumbnail gerada por IA (já funcionava no worker, só faltava UI) agora aparece de verdade em vez do texto fixo "aparece aqui (Sprint 5)" — com os botões de overlay reposicionados pro topo da imagem pra não cobrir o título já embutido na própria thumbnail. "Baixar Master" também virou um link real pro último render concluído em vez de ficar sempre desabilitado. Testado visualmente (screenshot) e via HTML (200 OK, `<img>` e link de download apontando pros arquivos certos).
- **Publicação automática no YouTube**: job `PUBLISH_YOUTUBE` deixou de ser placeholder — agora sobe o vídeo renderizado de verdade pro canal conectado via OAuth (título/descrição/tags/capítulos do SEO já gerado, thumbnail personalizada, privacidade escolhida no formulário — padrão **Privado**). Conexão de conta em Settings → "Canal do YouTube" (login e autorização acontecem na tela oficial do Google, o app nunca vê a senha). Falta só o passo manual único de criar a credencial OAuth no Google Cloud Console — veja a seção abaixo.
- **Media Assets** (`/assets`): a página que era só um placeholder virou biblioteca de verdade — reúne cenas, miniaturas de capa e renders finais de todos os projetos numa grade única, com busca por título/nicho/cena, filtro por tipo (Cena/Miniatura/Render) e por nicho, e download direto de cada arquivo. Sem tabela nova no banco — lê os campos que já existiam (`Scene.filePath`, `Project.thumbnailPath`, `RenderJob.outputPath`). Testado ao vivo: 240 itens renderizando (125 imagens + 115 vídeos), filtro por tipo funcionando.
- **Channel Manager real** (`/channels`): deixou de ser mockado (badge fixo "3", tela vazia sem dado real) — agora mostra inscritos/visualizações/total de vídeos e os uploads recentes de verdade do canal conectado, via YouTube Data API (`channels.list` com `part=statistics` + `playlistItems.list` na playlist de uploads), cruzando com as publicações feitas pelo próprio DocuPulse pra marcar "Feito no DocuPulse" vs externo. A Sidebar trocou o badge fixo "3" por um indicador real de conexão (Conectado/Conectar).
- **Geração real de imagem no nó Prompt do Workflow Studio**: o nó "Prompt & Qualidade Visual" deixou de ser simulado — agora chama o Gemini image-capable ("Nano Banana") de verdade, com image-to-image quando há referência de Avatar/Produto anexada, e a imagem gerada passa a ter prioridade na composição final. **Importante: diferente do texto e da voz (que são grátis), geração de imagem no Gemini normalmente exige faturamento habilitado** — usa `GEMINI_IMAGE_API_KEY` (com fallback pra `GEMINI_API_KEY`, que hoje é só o nível grátis). Testado ao vivo com a chave grátis atual: a API respondeu 429 "quota exceeded... free_tier ... limit: 0" pro modelo de imagem, confirmando que precisa mesmo de uma chave com faturamento — e o job tratou o erro direitinho (log claro, terminou DONE sem crash, caiu de volta pro comportamento anterior). Sem isso configurado, o Prompt continua sem gerar nada (como antes), só com uma mensagem mais clara no log.
- **Bug corrigido: nó de Voz do Workflow Studio quebrava com voiceId inválido**: o grafo podia carregar um voiceId que não é um ID real do Edge TTS (era o caso do workflow de exemplo "Campanha Aura Serum" — tinha o rótulo do Gemini TTS "Clara - Conversational"), e o msedge-tts derrubava o job inteiro com "Could not infer voiceLocale from voiceName". Agora o `run-workflow.ts` valida o voiceId contra a lista canônica (`EDGE_VOICES`, exportada de `edge-tts.ts`) antes de sintetizar — se não bater, loga um aviso e usa o voiceId padrão em vez de quebrar o job. Corrigido também o dado do workflow de exemplo. Testado ao vivo: locução sintetizou de verdade (Edge TTS, 5.6s), job terminou DONE.
- **Upload de imagem de referência no Avatar/Produto do Workflow Studio**: item 6 do backlog estava desatualizado — essa UI já existia (thumb clicável nos nós Avatar/Produto, com API `/api/workflows/[id]/upload` salvando em `storage/workflows/<id>/refs`). O que faltava de verdade, encontrado ao revisar o código: o upload chama `updateNodeData` direto, que não passa pelo `onNodesChange` do canvas — então a imagem aparecia na tela mas o grafo nunca ficava "dirty" e o autosave (1,5s de debounce) nunca disparava pra ela, podendo se perder se o usuário não clicasse "Salvar Grafo" ou "Executar Fluxo Vertical" manualmente depois. Corrigido: `WorkflowIdContext` passou a levar também um `markDirty()`, chamado logo após um upload bem-sucedido, garantindo que a referência sempre persiste sozinha como qualquer outra edição do canvas.
- **Tipos de workflow (Comercial Vertical / UGC / Personalizado) agora têm efeito real**: antes era só um rótulo salvo no banco — todo fluxo novo nascia idêntico, com 1 nó Renderizador vazio. Agora cada tipo tem um template de nós já encadeado (`templateGraph` em `packages/core/src/workflow.ts`): **Comercial Vertical** entra com Produto → Prompt → Voz → Renderizador; **UGC/Influencer** entra com Avatar → Prompt e Avatar → Voz, ambos → Renderizador; **Personalizado** continua a tela em branco de antes. O seletor de tipo apareceu no formulário "Novo Fluxo" da lista, e os badges dos cards passaram a mostrar o rótulo em português (antes era o valor cru do banco, ex. "VERTICAL COMMERCIAL"). Testado ao vivo: criei um fluxo UGC pela UI, ele nasceu com os 4 nós já conectados nas arestas certas, e a linha salva no banco confirmou `kind: "UGC"`.
- **Novidades trazidas de um protótipo do Stitch pro Workflow Studio** (usuário mandou um mockup HTML mais avançado, com nó de "Location", geração de keyframe por nó e vídeo cinema render): analisei o diferencial e trouxe pro app real, sem tocar no que já funcionava, o que dava pra fazer sem custo/risco novo:
  - **Novo tipo de nó: Cenário & Ambientação** (`SCENE`, equivalente ao "Location & Environment" do mockup) — nome, descrição livre, clima e iluminação/hora do dia. Conecta no Prompt (e opcionalmente direto no Renderizador), igual Avatar/Produto. A descrição do Cenário entra automaticamente como contexto extra no prompt de geração de imagem — tanto na prévia sob demanda quanto na execução completa do fluxo.
  - **"Gerar Keyframe (IA real)" no nó de Prompt** (equivalente ao "Executar Nó"/"Regenerar" do "Keyframe Preview" no mockup) — botão que gera uma imagem de verdade via Gemini pra esse nó específico, sem precisar rodar o fluxo inteiro, usando o Avatar/Produto/Cenário já conectados como contexto. Nova rota `/api/workflows/[id]/keyframe-preview`, resultado fica em cache no próprio nó (campo `keyframeUrl`) e aparece como miniatura ali dentro. Testado ao vivo: chamei o endpoint de verdade, ele montou o contexto certinho e chegou até a API do Gemini (mesmo erro de cota grátis já conhecido — confirma que o encanamento todo funciona).
  - **Ficou de fora de propósito** (motor de vídeo por IA de ponta tipo "Seedance 2.5"/Sora do mockup, e "Executar a partir daqui" pra rodar só um pedaço do grafo): exigiria integrar uma API de vídeo paga nova (custo real, sem chave configurada) e/ou reescrever o motor de execução do worker pra rodar sub-grafos parciais — combina com o item 5 do backlog abaixo (motor de render alternativo), só evoluir com decisão consciente do usuário sobre custo.
- **"Linha do tempo" de shots no Renderizador, adaptada de um 2º mockup do Stitch ("Sequence QA")**: o mockup mostrava um sequenciador multi-track completo (waveform, telemetria de consistência de personagem, ponte com color science/DaVinci Resolve, ações rápidas de motor Unreal Engine) — quase tudo fictício/fora do escopo real do app hoje. O que dava pra adaptar de verdade: até agora o worker só guardava **1** imagem do nó Prompt por execução (se o grafo tivesse mais de um nó Prompt, as anteriores eram silenciosamente descartadas). Corrigido: `run-workflow.ts` agora coleta **uma imagem por nó Prompt** que gerou de verdade (`promptShots`, na ordem topológica do grafo) e, quando há 2 ou mais, monta a prévia final como uma sequência real via `concat` do ffmpeg — cada shot com seu próprio Ken Burns numa fatia proporcional da duração total, todos costurados antes de aplicar a locução/áudio por cima. Novo campo `RenderData.shots` (schema em `packages/core`) guarda a lista de shots do último render; o nó Renderizador no canvas (`RenderNode`) ganhou uma tira de miniaturas mostrando esses shots em ordem quando há sequência. **Ficou de fora de propósito**: telemetria de consistência de personagem, color science e as pontes com DaVinci Resolve/Unreal Engine do mockup — nenhuma delas existe de verdade no pipeline hoje (exigiriam integrações inteiramente novas, sem relação com o que o app faz). Testado: typecheck limpo em `core`/`worker`/`web`; rodei o fluxo ao vivo com 2 nós Prompt (bateu no mesmo limite de cota grátis do Gemini já documentado, confirmando que o caminho de fallback "sem imagem" continua funcionando sem quebrar); testei o filtro `concat` do ffmpeg isoladamente com 3 imagens reais do storage — vídeo 1080×1920 gerado com sucesso, confirmando que a lógica de composição multi-shot está correta.

- **Controle de orçamento pra geração paga de imagem/vídeo + opção 100% grátis (Pollinations.ai)**: até aqui, geração de imagem no Prompt só existia via Gemini pago (Nano Banana) — sem chave com faturamento, nada gerava de verdade (confirmado várias vezes com o erro 429 "limit: 0" do nível grátis do Gemini, que não inclui geração de imagem/vídeo em NENHUM modelo, confirmado agora na documentação oficial). Duas coisas novas:
  - **Teto de orçamento mensal** (Settings → "Orçamento de IA paga"): trava qualquer geração paga ANTES de chamar a API, não depois. Usa a tabela `Usage`/`Setting` que já existia (sem migração nova) — `checkBudget()` em `packages/providers/src/budget.ts` soma o gasto do mês corrente e recusa a chamada se estourar o teto, com uma mensagem clara. **Começa em US$ 0 de propósito** (decisão do usuário): nada gera de verdade via Gemini até configurar um valor ali. Card mostra gasto do mês / teto / disponível, com um form pra atualizar o teto na hora.
  - **Pollinations.ai como motor grátis alternativo** (`packages/providers/src/image/pollinations-image.ts`): sem chave, sem faturamento, gera de verdade mesmo com o orçamento em US$ 0 — mas não segue referência de Avatar/Produto (qualidade/consistência bem inferior ao Nano Banana, serve pra testar o fluxo sem gastar nada). Nó de Prompt ganhou um seletor "Motor de imagem" (Gemini pago vs. Pollinations grátis), usado tanto na prévia sob demanda (`/api/workflows/[id]/keyframe-preview`) quanto na execução completa do fluxo (`run-workflow.ts`).
  - Toda geração via Gemini bem-sucedida agora também registra o custo real no medidor (`recordImageUsage`, unidade `IMAGES`) — antes isso não acontecia, então o "US$ X equiv." da topbar nunca refletia gasto de imagem, só texto/voz.
  - Testado ao vivo: com teto US$ 0, chamada ao Gemini foi bloqueada ANTES da API (mensagem clara, sem gastar nada); com teto US$ 5, a chamada passou e chegou até o Gemini de verdade (bateu no mesmo 429 já conhecido — confirma que o bloqueio é só o orçamento, não um bug); Pollinations.ai gerou uma imagem real (580×1015, 9:16) mesmo com orçamento zerado, sem erro.

- **Teste real ao vivo do fluxo com Pollinations.ai**: rodei o Workflow "Campanha Aura Serum" de ponta a ponta pelo navegador, trocando o nó Prompt para o motor grátis. Log real do worker confirmou: locução sintetizada (Edge TTS, 5.6s), imagem gerada de verdade via Pollinations.ai (`prompt-n3-*.jpg`) e composição final em MP4 9:16 (`run-*.mp4`) — sem gastar orçamento pago (segue em US$ 0). Entregue ao usuário como prévia.
- **Dois vídeos longos novos, ponta a ponta, no dia 09/09**: "A Rodovia 44 e os Carros Vazios: O Mistério dos 15 Quilômetros" (11:23min, 60/61 cenas com B-roll, render 11.4min) e "A Ilha Secreta Onde a Marinha Testou Patógenos" (render 9.9min, 52/52 cenas com B-roll) — ideia, roteiro (6 atos), locução (Edge TTS consistente, sem mistura de vozes), legendas alinhadas (Whisper) e render final (encoder QuickSync) para os dois, ambos com "Verificação Pré-Voo" limpa. Ficam parados aguardando o usuário validar a qualidade antes de qualquer publicação (nada é postado sozinho). Prévia de 45s entregue ao usuário pra avaliação.
- **Correção de acumulo de espaço em disco** (`apps/worker/src/jobs/render-video.ts`): diagnosticado que `renders/work/` (arquivos intermediários do ffmpeg — mix.wav, video-all.mp4, act-*.mp4 etc.) nunca era limpo depois do render, acumulando ~3.6GB entre 4 projetos antigos, mais renders finais duplicados de re-renders repetidos. Corrigido na raiz: todo `RENDER_VIDEO` bem-sucedido agora apaga `renders/work/` automaticamente e mantém só os 3 renders finais mais recentes por projeto. Confirmado funcionando nos dois renders de hoje (72 e 63 arquivos temporários removidos automaticamente). Ainda pendente: apagar manualmente o ~3.6GB já acumulado nos 4 projetos antigos (aguardando confirmação do usuário pra rodar a exclusão em massa).
- **Estimativa real de tempo de produção**: consultada via query direta no banco (timestamps dos jobs) — GENERATE_IDEAS ~20-70s, SYNTHESIZE_VOICE ~90s/6 atos, HUNT_BROLL ~4-5min/50-60 cenas, ALIGN_CAPTIONS ~4-6s, RENDER_VIDEO é o maior custo (~1.5-2x a duração final do vídeo). Total de processamento puro estimado em ~30-45min por vídeo longo quando automático — bem menor que o tempo real gasto hoje (~1h-1h20/vídeo), que foi inflado pelo acompanhamento manual clique a clique, não pelo processamento em si.
- **Otimização de velocidade identificada (aprovada, ainda não aplicada)**: tanto a renderização de clipes por cena (`packages/render/src/render.ts`) quanto a busca/download de B-roll (`apps/worker/src/jobs/scenes.ts` → `huntBroll`) rodam estritamente em série, cena por cena, quando são operações independentes entre si. Plano aprovado pelo usuário: paralelizar as duas com um limite de concorrência (ex. 3-4 simultâneos), sem alterar lógica de motion/encoder, concat, áudio ou legendas — só aplicar depois que os renders em andamento terminarem (mexer em código do worker com um render rodando reinicia o processo via `tsx watch` e mata o job).
- **Automação AUTO_PRODUCE aprovada pelo usuário (ainda não construída)**: um novo job que encadeia sozinho as 6 etapas do pipeline (ideias → roteiro → locução → B-roll/legendas → render), com uma opção na interface pra configurar agendamento (quantos vídeos, frequência, tema/canal). **Regra inegociável definida pelo usuário: o pipeline automático para no render e nunca publica sozinho — o vídeo fica "aguardando aprovação" até revisão manual.** A etapa de publicação no YouTube continua 100% manual/gated, mesmo em modo automático.

- **Camada visual DVP — Fase 1 (Plano de Edição) construída e testada ao vivo**: decidimos integrar a pós-edição *dentro* da ferramenta em vez do fluxo de pastas solto. Nasceu o job `GENERATE_EDIT_PLAN` + a tabela `EditPlan` + a página `/projects/[id]/edit-plan` (link a partir do Render). O job lê o roteiro e as **legendas já alinhadas** e propõe a camada visual (lower thirds nos estilos DVP Autoridade/Emocional/Datado, destaque de dado, inserção de arquivo, split de evidência, intertítulo de virada de ato). **Nada é renderizado** — a saída é um plano para revisão, sem Chromium e sem segundo encode.
  - **Decisão de projeto que evitou retrabalho**: a transcrição alinhada por palavra já existe no banco (`Caption.words`, do `ALIGN_CAPTIONS`) — não precisa de faster-whisper. Mas os tempos são **relativos a cada ato**, e o master concatena atos com 350ms de silêncio; o timecode absoluto exige acumular `voiceDurationMs + gapMs`. Esse 350 estava hardcoded no `render-video.ts` e virou `ACT_GAP_MS` exportado de `packages/render/src/timeline.ts`, pra render, legendas e plano nunca divergirem.
  - **Regra anti-alucinação de tempo**: o modelo nunca informa timecode. Ele devolve uma *frase-gatilho* copiada da narração, e o job localiza essa frase palavra por palavra na lista alinhada pra derivar o tempo real. Inserção cujo gatilho não casa é marcada `resolved: false` e destacada na UI como "tempo não confirmado".
  - **Teste real** no projeto "A Rodovia 44 e os Carros Vazios" (6 atos, 11:24): 24 inserções, **0 sem tempo confirmado**, 3 descartadas por sobreposição, ~55s de processamento, US$ 0,02 (gemini-3.5-flash-lite). Qualidade das escolhas boa — datas viraram lower third Datado, o caminhoneiro Thomas Miller virou Emocional, "Departamento de Segurança" virou Autoridade, números viraram destaque de dado.
  - **Achado que decide a Fase 2**: os layouts `insert-arquivo` e `split-evidencia` propõem mostrar evidência concreta (boletim de ocorrência, câmera de painel, gravador de voz) que **não existe como asset** — nosso B-roll é acervo genérico do Pexels/Pixabay. Antes de renderizar a camada, é preciso decidir: gerar esses assets, ou restringir esses dois layouts. Era exatamente isso que a Fase 1 deveria revelar antes de pagar o custo do render.
  - **Ajuste pendente de prompt**: o Ato 1 (o gancho, o mais crítico pra retenção) saiu com só 1 inserção — ficou o mais pobre justamente onde mais importa.
  - Documento que rege as edições: `Edição/EDITOR_IA.md` (paleta DVP, zona segura das legendas queimadas, layouts, regras Remotion). Pastas: entra em `Edição/Projetos/`, sai em `Edição/Edições/`.
- **Checagem de legibilidade contra o frame real do master** (a melhoria de maior impacto do plano): o plano posicionava inserções pelo tempo do áudio sem saber o que estava na tela naquele instante — um lower third de texto claro podia cair sobre B-roll claro e sumir. Agora, para os layouts que deixam o master aparecer atrás (`lower-third` e `overlay-dado`), o job extrai o frame no meio da inserção e mede a luma média da região exata onde ela vai aparecer, via filtro `signalstats` do ffmpeg (o `run` do projeto devolve stdout como string, então ler pixel cru não funcionava; `signalstats` imprime a estatística como texto). Layouts com substrato opaco (`insert-arquivo`, `split-evidencia`, `graphic-fullscreen`) nem são medidos. **E o plano se corrige sozinho**: Emocional é o único estilo sem placa (texto claro sobre transparência), então quando cai sobre fundo claro ele é promovido automaticamente para Autoridade, que tem placa opaca — com a justificativa gravada na nota da inserção. Validado no vídeo real: "Thomas Miller" caía sobre **luma 196** (quase branco) como Emocional e teria sumido; o job trocou para Autoridade sozinho.
- **Mais duas melhorias do plano, na mesma rodada**: (1) **densidade no gancho** — o Ato 1 recebia menos inserções que todos os outros porque a taxa era uniforme (`duração/28s`) e ele é o mais curto, justo o trecho que decide retenção; agora usa taxa própria (`/18s`, mínimo 2) e instrução específica de ancorar data/lugar/número cedo — subiu de 1 para 2 inserções no teste. (2) **contexto entre atos** — cada ato era planejado isolado, então "Perícia técnica" apareceu como título em dois atos diferentes; agora cada chamada recebe a lista de textos já usados e a instrução de não repetir (mesmo padrão de resumo acumulado que o `generate-script` já usa). Plano v3: 25 inserções, 0 sem tempo confirmado, US$ 0,008.
- **Assets da camada visual gerados** (18 no total, em `Edição/Assets/props/`): 16 na primeira rodada e 2 na segunda com Nano Banana Pro. Divididos em `substratos/` (papel de dossiê, pasta, prancheta, jornal, ficha, caixa, metal escovado), `molduras/` (polaroid, negativo 35mm, CRT, quadro de investigação), `fundos/` (papel creme, carvão, mapa topográfico, milimetrado) e `overlays/` (light leak, poeira/riscos). **Princípio: substrato vazio, texto por cima** — nada de documento com texto embutido, porque texto de IA sai ilegível, não reutiliza entre vídeos e documento oficial fabricado é risco de credibilidade para o canal. Prompts versionados em `Edição/Assets/PROMPTS_ASSETS.md`. Descoberta útil: o Nano Banana Pro honra "4K resolution" escrito no prompt mesmo sem controle de resolução na interface do Flow — rendeu 2752×1536 contra 1376×768 do modelo anterior.
- **Projeto Remotion criado e primeiro trecho editado aprovado**: `PulseStudio/editor-ia/` (fora de `Edição/` e fora do workspace pnpm, que só enxerga `apps/*` e `packages/*`). Componentes DVP em `src/dvp/`: `LowerThird` nos três estilos, `OverlayDado`, `Intertitulo` e a composição `Trecho`, que põe a camada por cima de uma única `<Video>` contínua — imagem e som saem do master, nada corta nem mexe no áudio. Renderizado 45s reais de "A Rodovia 44" (03:05→03:50, 3 inserções) em `Edição/Edições/rodovia-44-trecho/`, com a verificação do EDITOR_IA passando: 45,056s contra 45,000s do master, 1080p30, H.264, uma trilha de áudio. **Aprovado pelo Igor.**
  - **Armadilha que custou tempo, para não repetir**: o `create-video --no-tailwind` mesmo assim deixa `Config.overrideBundlerConfig(enableTailwind)` + `Config.setRspack(true)` no `remotion.config.ts` e um `@import "tailwindcss"` no `index.css`. Nessa combinação o bundle **completa sem emitir o `bundle.js`**, e o erro que aparece é um ENOENT enganoso do arquivo faltando. Typecheck passa limpo, então não há pista no código. A solução foi remover o Tailwind. Duas pistas falsas descartadas no caminho: o acento em "Edição" (o `remotion_cwd` no HTML aparece com mojibake, mas não é a causa) e o Node 26.
  - **Custo real do render medido**: 8,2 min para 45s, ~11× o tempo real — extrapolado, ~2h para um vídeo de 11 min. A estimativa anterior de "dobra o tempo de render" estava errada por uma ordem de grandeza. A causa é a máquina (i7-7500U, **2 núcleos físicos**, 7,9 GB de RAM), não configuração: a concorrência já está em 2, o teto sensato para 2 núcleos. O caminho real é **não re-renderizar o vídeo inteiro** — num vídeo de 11 min com 25 inserções de ~4s, só ~15% dos frames têm camada; renderizar só os segmentos com inserção e emendar o resto por cópia de stream cortaria a maior parte do tempo.
- **Busca de B-roll paralelizada (metade do item aprovado, de propósito)**: `huntBroll` em `apps/worker/src/jobs/scenes.ts` roda agora com 4 downloads simultâneos (`BROLL_CONCURRENCY`, teto 8), porque buscar em Pexels/Pixabay e baixar é espera de rede. **O render de clipes ficou em série de propósito** — é ffmpeg, CPU puro, e com 2 núcleos a paralelização só causaria disputa; o plano aprovado original mandava paralelizar os dois. Condição de corrida tratada: duas cenas podiam reservar o mesmo asset, então a checagem e a marcação em `used` acontecem sem `await` no meio, e o filtro de relevância vale também no fallback (não aceita imagem fora de tema só porque a melhor já foi levada). **Ainda não testado ponta a ponta** — nenhum projeto com cenas pendentes no momento; acompanhar o log no próximo vídeo.
- **Disco: 3,7 GB liberados (09/09)**, com autorização explícita. Removidos os `renders/work/` dos 4 projetos antigos (1543 + 1683 + 252 + 233 MB) — só clipes por cena, listas de concat e mixagens .wav, todos regeneráveis. Confirmado depois que os 12 renders finais e as 403 cenas de origem continuam intactos. Livre passou de 10,56 para 14,19 GB. Os dois projetos novos já nascem sem `work/`, confirmando o fix automático.
- **Modo produção habilitado — economia de ~1,8 GB de RAM**: a máquina é apertada (7,9 GB, 2 núcleos) e o `next dev` sozinho ficava em ~2,3 GB por causa de hot reload, compilação sob demanda e source maps em memória. Com `pnpm build` + `pnpm start` o mesmo app roda em **479 MB** (RAM livre passou de 0,81 para 2,39 GB). Scripts: `start` na raiz e no `turbo.json` (persistente, sem cache), e `apps/web` com `next start --port 3210` para manter a mesma porta do dev. **Usar produção quando o trabalho é produzir vídeo; dev só quando for editar o código do app** (em produção é preciso rebuildar a cada mudança, ~1,6 min).
  - **Gotcha**: `next build` falha com `PageNotFoundError: /_not-found` se o `next dev --turbopack` estiver rodando ou tiver deixado `.next` sujo. Parar o dev e apagar `apps/web/.next` antes de buildar resolve.
  - Para isso funcionar foi preciso corrigir os 3 erros de typecheck pré-existentes do web, que bloqueavam o build: `Stat` (`packages/ui`) ganhou os tons `error` e `warning`, que a página de Saúde já usava para marcar worker offline e jobs falhados; e `generateSeoMetadata` (published/actions.ts) tinha um `return { usage }` morto que quebrava o tipo de `<form action>` — o consumo já era gravado pelo `recordUsage` logo acima.
- **Decisões fechadas de identidade (Igor, 09/09)**: não existe manual de marca DVP, então a paleta amostrada a olho das artes vira o padrão (`DVP_PALETTE` em `packages/core/src/edit-plan.ts`) e as fontes ficam **Playfair Display** (títulos) e **Inter** (corpo), ambas Google Fonts com licença aberta.

- **QUALIDADE APROVADA PELO IGOR (10/09)**: assistiu os dois vídeos longos completos ("A Rodovia 44 e os Carros Vazios" e "A Ilha Secreta Onde a Marinha Testou Patógenos") em versão comprimida para celular e **aprovou o padrão**. Isso destrava três coisas que estavam em espera: a publicação dos vídeos prontos, a construção do `AUTO_PRODUCE` (que o próprio Igor condicionou a "quando os vídeos estiverem na qualidade exata que espero"), e as decisões da camada visual, que até aqui eram aposta sobre um padrão não validado.
  - Método que funcionou e vale repetir: renderizar o vídeo inteiro em 854px, ~280 kbps, ~22 MB, e enviar — dá para assistir no celular fora de casa. A prévia de 45s que vínhamos mandando não era suficiente para julgar ritmo e narração ao longo dos 11 minutos.
  - Ainda aguardando aval: "O Desastre Nuclear Que A URSS Escondeu" e o short "6 Meses de Sol" (eram quatro projetos em RENDER, não dois como estava registrado antes).

## Publicação automática no YouTube — como ativar

O app publica direto no seu canal via OAuth do Google (login e permissão acontecem no site do próprio Google — o DocuPulse.AI nunca vê nem guarda sua senha). Falta só criar uma credencial OAuth gratuita no Google Cloud Console. Passo a passo (dá pra fazer até pelo celular):

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie um projeto novo (ou use um existente).
2. Menu → **APIs e serviços** → **Biblioteca** → busque **"YouTube Data API v3"** → **Ativar**.
3. Menu → **APIs e serviços** → **Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**.
   - Preencha nome do app (ex.: "DocuPulse.AI"), e-mail de suporte e e-mail de contato do desenvolvedor.
   - Em "Usuários de teste", adicione o seu próprio e-mail do Google/YouTube — sem isso o Google bloqueia o login.
4. Menu → **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**:
   - Tipo de aplicativo: **App para computador** (Desktop app).
   - Nome: qualquer um (ex.: "DocuPulse.AI Desktop").
5. Copie o **Client ID** e o **Client Secret** gerados.
6. Cole no `.env` do projeto:
   ```
   YOUTUBE_CLIENT_ID="seu-client-id-aqui"
   YOUTUBE_CLIENT_SECRET="seu-client-secret-aqui"
   ```
7. Reinicie o `pnpm dev` (só uma vez, pra carregar as novas variáveis).
8. Vá em **Settings** → card **"Canal do YouTube"** → **Conectar canal do YouTube** → autorize na tela do próprio Google.
9. Pronto — na página de Publicação de qualquer projeto (Passo 5) vai aparecer o botão **"Publicar no YouTube"** com um seletor de privacidade (Privado/Não listado/Público, padrão **Privado** por segurança).

O app nunca pede nem armazena sua senha do Google em nenhum momento — a autenticação inteira acontece na tela oficial do Google.

### Continuação 11/09/2026 (tarde/noite) — disco cheio e eixos expostos na interface

- **10GB livres no disco, causa raiz encontrada e corrigida**: `apply-visual-layer.ts` tinha o
  mesmo bug já corrigido em `render-video.ts` em 09/09 — o `finally` limpava `public/tmp` do
  Remotion mas esquecia `storage/projects/<id>/visual/job-<jobId>/` (segmentos intermediários).
  ~2,9GB acumulados em 3 projetos, com o `dvp-*.mp4` final já pronto ao lado. Corrigido apagando
  `work` também no `finally`. Mais ~1GB liberado limpando renders duplicados além dos 3 mais
  recentes por projeto e `node_modules` de dois worktrees Git abandonados
  (`docs/.claude/worktrees/`, ~870MB cada) — foram achados dois commits pequenos de valor real
  ali dentro (fix de `ACT_GAP_MS` faltando em `repurposing/page.tsx`, e duas limpezas em
  `actions.ts`/`Stat.tsx`), trazidos via cherry-pick antes de remover os worktrees. Disco foi de
  ~10GB para ~15,5GB livres. Nova memória de longo prazo registrada sobre esse padrão de bug
  (pastas `work/` que só um job conhece e só ele deveria limpar).
- **Eixos e intensidade expostos na interface** (item 2 da lista de pendências, fechado): coluna
  `Project.intensidade` nova (default `"equilibrado"`, migration
  `20260911214449_add_project_intensidade`) e um card no Passo do Plano de Edição com o seletor
  calmo/equilibrado/dinâmico/muito-dinâmico, mostrando ao vivo os eixos efetivos (% de inserção
  convertido em "1 a cada Ns", % de transição) para o formato do projeto. Os dois call sites do
  worker que chamavam `eixosDe(..., "equilibrado")` fixo (`edit-plan.ts` e `render-video.ts`)
  agora leem `project.intensidade`. `migration_lock.toml` entrou no versionamento junto — tinha
  ficado de fora sem querer na baseline de `b09f9d7`.

## Pendente após 11/09/2026 (ordem de risco)

1. **Unificar as duas zonas seguras** — ver "Duplicação que já causou bug" abaixo. É a correção
   estrutural com maior retorno.
2. ~~Expor os eixos e a intensidade na interface~~ — **pronto** nesta sessão (ver "Continuação
   11/09/2026" acima): coluna `Project.intensidade` + card no Passo do Plano de Edição.
3. **Testes no monorepo** — `apps/*` e `packages/*` seguem com zero. Só o `editor-ia` tem
   verificação.
4. ~~Escolher tipografia/cor da legenda~~ — **pronto junto com o item 2**, mesma interface.
5. **Variantes verticais de `cronologia` e `mesa-arquivo`** — hoje o perfil DVP libera só 5 dos
   7 layouts em 9:16. A folha de contato mostra o título da cronologia colidindo com os rótulos
   dos eventos em vertical.
6. **Legendas retroativas** nos 4 vídeos já publicados — hoje `captions.insert` só roda dentro
   do job de publicação.
7. **MesaArquivo** com o que o preview do template ensinou: fundo escuro com o papel como
   objeto (hoje está invertido), fotos sobrepostas em vez de enfileiradas, cartão de nome em
   papel rasgado.
8. **Pasta inbox do Flow** (soltar zip → importar sozinho).
9. **`tsconfig.tsbuildinfo` deveria sair do controle de versão** — é artefato de build e suja o
   working tree a cada typecheck.

**Decidido em 11/09/2026**: o preview do template VideoHive (29MB) em `Edição/Assets/` fica na
pasta mas **fora do controle de versão** (`Edição/Assets/*.mp4` no `.gitignore`). Versionar
seria praticamente irreversível — `.git` está em 50MB, vídeo não ganha nada com delta, e tirar
um blob do histórico exige reescrevê-lo inteiro. Os 30 arquivos de `Edição/Assets` que o
pipeline usa de verdade (props em jpg, PNGs, `PROMPTS_ASSETS.md`) seguem versionados; o padrão
é escopado em `*.mp4` justamente para não pegá-los.

## Backlog de melhorias identificado (priorizado)

1. **Fechar o ciclo de retenção real**: hoje o roteiro já calcula uma curva de retenção prevista; falta puxar métricas reais do YouTube publicadas e comparar, pra calibrar os próximos roteiros.
2. **Automação do Google Flow via navegador**: **desbloqueado nesta sessão** — a extensão Claude in Chrome apareceu conectada (Chrome real do usuário, já logado no Google) e foi usada com sucesso pra navegar no app e tirar prints. Ainda não testamos gerar imagem/vídeo de verdade no labs.google/flow com ela, só confirmamos que a conexão funciona. Importante: 120+ cenas (como no vídeo longo atual) é pesado demais pra pilotar via navegador — o teste inicial deve ser com poucas cenas (ex.: 10-15, ou um Short inteiro). Automação de verdade em background (sem alguém pilotando ao vivo) exigiria um robô tipo Playwright guardando a sessão logada, o que tem risco real de ToS/bloqueio — só evoluir pra isso com decisão consciente do usuário.
3. **Teleprompter desabilitado** no roteiro: modo leitura em tela cheia pro narrador, mencionado na UI mas nunca ligado.
4. **Sem testes automatizados**: vários bugs (onClick em Server Component no Repurposing, truncamento de JSON no Niche Finder, uso errado de PRAGMA no SQLite) só apareceram em teste manual ao vivo. **Parcialmente atacado em 11/09/2026**: existe `editor-ia/scripts/verificar-layouts.mjs`, que renderiza os 7 layouts nos 2 formatos e afere o resultado. Continua valendo para o resto — o monorepo (`apps/*`, `packages/*`) segue com **zero** teste, e um smoke test de páginas (200 OK) ainda não existe.
5. **Novos "formatos de vídeo" (motor de render alternativo)**: hoje só existe um estilo real implementado — documentário dark (B-roll + texto + legenda). Ideias levantadas pelo usuário: vídeo com boneco stickman, personagem 3D, outros estilos de edição inteiramente diferentes. Isso NÃO é uma "Skill" (Skills guarda texto reaproveitável — ganchos, estrutura de ato, CTA, prompt de cena — dentro do estilo que já existe); é um motor de renderização novo, provavelmente via uma ferramenta de composição tipo Remotion ou geração de vídeo com IA de personagem, selecionável como uma opção nova de `visualStyle`. Trabalho pesado, tratar como feature própria quando o usuário quiser expandir pra outros formatos.

## Decisões técnicas / gotchas importantes (não esquecer)

### Armadilhas de medição no ffmpeg (11/09/2026) — todas falham em silêncio

- **`cropdetect` descarta os 2 primeiros frames por padrão.** Num still de um frame ele nunca
  avalia e não imprime nada — a verificação "passa" por nunca ter rodado. Precisa de `skip=0`.
- **`signalstats` não emite desvio padrão**, só MIN/LOW/AVG/HIGH/MAX. Nenhum percentil separa
  "quadro chapado" de "quadro escuro com texto branco" (YMAX chega a 255 com um pixel). Para
  desvio: `scale=64:36,format=gray -f rawvideo -` e calcular em JS.
- **Range**: JPEG é `yuvj420p` (0–255), MP4 é limitado (16–235). Sempre normalizar antes de
  comparar.
- **`eq=contrast` trabalha contra `eq=gamma` em cena escura** — contraste afasta do meio-cinza,
  ou seja escurece o pixel escuro. Um `contrast=1.06` inofensivo derrubou o resultado de ~50
  para 39.
- **Operação de cor roda em `format=gbrp`, não em YUV** — mesma causa do bug magenta da
  thumbnail.
- **`vstack` recusa linhas de larguras diferentes** — folha de contato com última linha
  incompleta precisa de células vazias de preenchimento.

### Duplicação que já causou bug (atenção)

`captionSafeZone` (`packages/core/src/edit-plan.ts`) e `zonaProibida`
(`editor-ia/src/dvp/tokens.ts`) são **a mesma verdade escrita em dois pacotes**, sem nada
ligando uma à outra. Elas já divergiram em silêncio uma vez (a legenda vertical). O core
alimenta o prompt; o editor-ia posiciona de verdade. **Ao mexer numa, mexer na outra.**
Unificar é a correção estrutural mais valiosa pendente.

- ~~**Nunca rodar `prisma migrate dev`**~~ — **deixou de valer em 11/09/2026**. O baseline foi criado (`prisma/migrations/0_init`, gerado por `migrate diff` a partir do schema e marcado como aplicado), e `migrate status` responde "Database schema is up to date!". `migrate dev` agora funciona normalmente. O aviso antigo era real: sem migrations, o Prisma pedia reset do banco inteiro, o que apagaria todos os projetos.
- **Lock de arquivo do Prisma no Windows**: qualquer processo Node com `@prisma/client` carregado (web, worker, ou scripts avulsos) trava o `query_engine-windows.dll.node`. Antes de rodar `db push`/`generate`, matar todos os processos node relevantes.
- **`tsx watch` reinicia o worker a cada salvamento** de arquivo em `apps/worker/src` — é esperado e seguro (jobs retomam sozinhos), mas por isso mudanças no worker nunca devem ser feitas enquanto um job pesado (ex.: RENDER_VIDEO) está rodando.
- **Next.js dev sem restart por dias acumula memória** — reiniciar o `pnpm dev` periodicamente (ou usar `--turbopack`, já aplicado) evita a maior parte da lentidão sentida.
- Restart de processos node só deve ser feito com confirmação explícita do usuário no chat.
- **`PRAGMA` no SQLite via Prisma exige `$queryRawUnsafe`, não `$executeRawUnsafe`**: pragmas como `journal_mode`/`busy_timeout` retornam uma linha de resultado, e `$executeRaw*` rejeita isso com "Execute returned results, which is not allowed in SQLite". Erro visto e corrigido ao ativar WAL pro pipeline paralelo.
- **OK geral do usuário (09/09, ~01:17)**: autorizou aplicar os itens do backlog acima sem precisar pedir confirmação item a item — assim que o render do vídeo atual terminar e os créditos dele renovarem (~40min depois desse OK). Mudanças que exigem reiniciar processos node/`db push` ainda seguem a regra de segurança acima (avisar no chat antes de reiniciar), mas sem precisar esperar um novo "sim" pra cada melhoria da lista.
- **Keep-awake**: script `_keepawake.ps1` (raiz do repo, não commitado — é só utilitário local) roda em loop chamando a API do Windows `SetThreadExecutionState` pra evitar que a máquina durma, sem alterar nenhuma configuração do sistema. Iniciado a pedido do usuário; é seguro parar a qualquer momento fechando o processo powershell.
- **Confirmado em 09/09 ~07:35**: os processos do `pnpm dev` (web+worker) tinham caído sozinhos (provavelmente a máquina hibernou/travou durante uma instabilidade de conexão anterior) — por isso o `--turbopack` só foi confirmado em uso depois desse restart (Ready em 4.3s, bem mais rápido que antes).

## Sessão 16/09/2026 — GPT, qualidade e postagem programada

### Geração assistida de imagens

- Adicionado **Gerar com GPT** no Passo de Mídia. A rota
  `GET /api/projects/[id]/gpt-image-pack` baixa um TXT com contexto do projeto, proporção,
  identidade visual, regras de continuidade e um prompt por cena.
- O pacote usa os mesmos nomes aceitos pelo importador (`a01-s01.png`), portanto o retorno do GPT
  entra pela mesma inbox usada pelo Flow.
- Validação real no projeto `cmtz5wi6h000u9n54f18hlvra`: 13 imagens geradas, 13/13
  importadas e novo master vertical 1080×1920 renderizado com 95,067s.

### Legendas e pré-voo

- Quatro presets selecionáveis: automático, documentário clean, impacto amarelo e neon magenta.
- Prova e render final recebem o mesmo preset.
- Render com legenda falha cedo quando algum ato não possui palavras alinhadas válidas.
- Arquivos de mídia ausentes recebem fallback seguro; a tela sinaliza repetição, baixa
  resolução e dimensão desconhecida.
- A importação e o upload agora leem largura, altura e duração via ffprobe. Foi feito backfill
  das 13 cenas existentes; o pré-voo passou a exibir “Resolução conhecida adequada”.

### Alta retenção

- O planejamento denso foi renomeado para **Planejar alta retenção**. Em Short ele usa o ritmo
  configurado de 2–4 segundos por cena; o modo Flow esparso continua disponível para reduzir o
  trabalho manual.

### Programar postagem no YouTube

- Nova coluna `Publication.scheduledAt` e migração
  `20260916044500_add_publication_schedule`.
- Nova coluna `Publication.privacyStatus`, para distinguir corretamente upload privado de vídeo
  efetivamente publicado.
- A tela de publicação ganhou data/hora e botão **Programar postagem**. Exige pelo menos 15
  minutos de antecedência.
- O upload acontece imediatamente como privado e `status.publishAt` é enviado ao YouTube. A
  publicação futura fica a cargo do agendador nativo do YouTube e não depende de o Pulse Studio
  permanecer aberto.
- Quando já existe um `videoId` privado, publicar ou programar atualiza o mesmo vídeo com
  `videos.update`; não cria upload duplicado.
- Registros antigos foram normalizados a partir do resultado do último job `PUBLISH_YOUTUBE`.

### Verificação

- `pnpm typecheck`: 7/7 pacotes aprovados.
- Páginas de render e publicação: HTTP 200.
- Interface confirmou estado “Enviado como privado”, campo `datetime-local`, botão de
  programação e pré-voo sem dimensões desconhecidas.

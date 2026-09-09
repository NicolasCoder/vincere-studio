# Progresso da sessão — DocuPulse.AI

Registro do que foi feito, decidido e ainda falta, pra não perder contexto entre sessões.

## Concluído nesta sessão

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

## Backlog de melhorias identificado (priorizado)

1. **Fechar o ciclo de retenção real**: hoje o roteiro já calcula uma curva de retenção prevista; falta puxar métricas reais do YouTube publicadas e comparar, pra calibrar os próximos roteiros.
2. **Automação do Google Flow via navegador**: testada nesta sessão e bloqueada — o navegador embutido do Claude nunca teve login do Google (e eu não posso digitar credenciais em nome do usuário, nem uma vez). Usuário está fora de casa e vai retomar depois. Pendente de um dos dois: (a) conectar a extensão Claude in Chrome (usa o Chrome real, já logado — toda tentativa até agora reportou "não conectada"), ou (b) o usuário logar manualmente no navegador embutido (visível dentro do app Claude desktop). Importante: 120+ cenas (como no vídeo longo atual) é pesado demais pra pilotar manualmente via navegador — o teste inicial deve ser com poucas cenas (ex.: 10-15, ou um Short inteiro). Automação de verdade em background (sem alguém pilotando ao vivo) exigiria um robô tipo Playwright guardando a sessão logada, o que tem risco real de ToS/bloqueio — só evoluir pra isso com decisão consciente do usuário.
3. **Channel Manager mockado**: sem OAuth real com o YouTube (badge "3" fixo). Só vale a pena quando o usuário tiver mais de um canal ativo de verdade — agora que o OAuth do YouTube existe (item acima), dá pra puxar o canal de verdade em vez do mock.
4. **Teleprompter desabilitado** no roteiro: modo leitura em tela cheia pro narrador, mencionado na UI mas nunca ligado.
5. **Sem testes automatizados**: vários bugs desta sessão (onClick em Server Component no Repurposing, truncamento de JSON no Niche Finder, uso errado de PRAGMA no SQLite) só apareceram em teste manual ao vivo. Nem que seja um smoke test simples (abrir cada página, checar 200 OK) ajudaria a pegar regressão mais cedo.

## Decisões técnicas / gotchas importantes (não esquecer)

- **Nunca rodar `prisma migrate dev`** neste projeto — não há pasta `prisma/migrations`, e ele tenta resetar o banco inteiro. Sempre usar `prisma db push`.
- **Lock de arquivo do Prisma no Windows**: qualquer processo Node com `@prisma/client` carregado (web, worker, ou scripts avulsos) trava o `query_engine-windows.dll.node`. Antes de rodar `db push`/`generate`, matar todos os processos node relevantes.
- **`tsx watch` reinicia o worker a cada salvamento** de arquivo em `apps/worker/src` — é esperado e seguro (jobs retomam sozinhos), mas por isso mudanças no worker nunca devem ser feitas enquanto um job pesado (ex.: RENDER_VIDEO) está rodando.
- **Next.js dev sem restart por dias acumula memória** — reiniciar o `pnpm dev` periodicamente (ou usar `--turbopack`, já aplicado) evita a maior parte da lentidão sentida.
- Restart de processos node só deve ser feito com confirmação explícita do usuário no chat.
- **`PRAGMA` no SQLite via Prisma exige `$queryRawUnsafe`, não `$executeRawUnsafe`**: pragmas como `journal_mode`/`busy_timeout` retornam uma linha de resultado, e `$executeRaw*` rejeita isso com "Execute returned results, which is not allowed in SQLite". Erro visto e corrigido ao ativar WAL pro pipeline paralelo.
- **OK geral do usuário (09/09, ~01:17)**: autorizou aplicar os itens do backlog acima sem precisar pedir confirmação item a item — assim que o render do vídeo atual terminar e os créditos dele renovarem (~40min depois desse OK). Mudanças que exigem reiniciar processos node/`db push` ainda seguem a regra de segurança acima (avisar no chat antes de reiniciar), mas sem precisar esperar um novo "sim" pra cada melhoria da lista.
- **Keep-awake**: script `_keepawake.ps1` (raiz do repo, não commitado — é só utilitário local) roda em loop chamando a API do Windows `SetThreadExecutionState` pra evitar que a máquina durma, sem alterar nenhuma configuração do sistema. Iniciado a pedido do usuário; é seguro parar a qualquer momento fechando o processo powershell.
- **Confirmado em 09/09 ~07:35**: os processos do `pnpm dev` (web+worker) tinham caído sozinhos (provavelmente a máquina hibernou/travou durante uma instabilidade de conexão anterior) — por isso o `--turbopack` só foi confirmado em uso depois desse restart (Ready em 4.3s, bem mais rápido que antes).

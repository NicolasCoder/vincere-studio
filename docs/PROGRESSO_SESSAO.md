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

## Backlog de melhorias identificado (priorizado)

1. **Fechar o ciclo de retenção real**: hoje o roteiro já calcula uma curva de retenção prevista; falta puxar métricas reais do YouTube publicadas e comparar, pra calibrar os próximos roteiros.
2. **Automação do Google Flow via navegador**: ainda pendente de teste (usar a conta Plus do usuário via Claude-in-Chrome, sem custo de API). É a frente de maior impacto pra escalar produção de imagem/vídeo. Importante: 120+ cenas (como no vídeo longo atual) é pesado demais pra pilotar manualmente via navegador — o teste inicial deve ser com poucas cenas (ex.: 10-15, ou um Short inteiro), não o vídeo longo inteiro. Automação de verdade em background (sem alguém pilotando ao vivo) exigiria um robô tipo Playwright guardando a sessão logada, o que tem risco real de ToS/bloqueio — só evoluir pra isso com decisão consciente do usuário.
3. **Pipeline paralelo**: hoje um projeto de cada vez; rodar mais de um em paralelo quando o volume aumentar.
4. **Painel de saúde do sistema** dentro da própria ferramenta (uptime do worker, jobs travados, uso de memória), pra não depender de diagnóstico manual via terminal.
5. **Responsividade para mobile**: hoje a UI (kanban, telas de projeto, referências) é pensada pra desktop; falta revisar layouts (grids, sidebar, tabelas) pra funcionar bem em telas pequenas.

## Decisões técnicas / gotchas importantes (não esquecer)

- **Nunca rodar `prisma migrate dev`** neste projeto — não há pasta `prisma/migrations`, e ele tenta resetar o banco inteiro. Sempre usar `prisma db push`.
- **Lock de arquivo do Prisma no Windows**: qualquer processo Node com `@prisma/client` carregado (web, worker, ou scripts avulsos) trava o `query_engine-windows.dll.node`. Antes de rodar `db push`/`generate`, matar todos os processos node relevantes.
- **`tsx watch` reinicia o worker a cada salvamento** de arquivo em `apps/worker/src` — é esperado e seguro (jobs retomam sozinhos), mas por isso mudanças no worker nunca devem ser feitas enquanto um job pesado (ex.: RENDER_VIDEO) está rodando.
- **Next.js dev sem restart por dias acumula memória** — reiniciar o `pnpm dev` periodicamente (ou usar `--turbopack`, já aplicado) evita a maior parte da lentidão sentida.
- Restart de processos node só deve ser feito com confirmação explícita do usuário no chat.
- **OK geral do usuário (09/09, ~01:17)**: autorizou aplicar os itens do backlog acima sem precisar pedir confirmação item a item — assim que o render do vídeo atual terminar e os créditos dele renovarem (~40min depois desse OK). Mudanças que exigem reiniciar processos node/`db push` ainda seguem a regra de segurança acima (avisar no chat antes de reiniciar), mas sem precisar esperar um novo "sim" pra cada melhoria da lista.
- **Keep-awake**: script `_keepawake.ps1` (raiz do repo, não commitado — é só utilitário local) roda em loop chamando a API do Windows `SetThreadExecutionState` pra evitar que a máquina durma, sem alterar nenhuma configuração do sistema. Iniciado a pedido do usuário; é seguro parar a qualquer momento fechando o processo powershell.
- **Confirmado em 09/09 ~07:35**: os processos do `pnpm dev` (web+worker) tinham caído sozinhos (provavelmente a máquina hibernou/travou durante uma instabilidade de conexão anterior) — por isso o `--turbopack` só foi confirmado em uso depois desse restart (Ready em 4.3s, bem mais rápido que antes).

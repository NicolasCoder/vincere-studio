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
- **Vídeo novo gerado ponta a ponta**: "O Desastre Nuclear Que A URSS Escondeu Por 31 Anos" — ideia, roteiro, locução, legendas, 121 cenas de B-roll grátis (Pexels/Pixabay), render e thumbnail, tudo sem gastar em API de imagem paga.

## Backlog de melhorias identificado (priorizado)

1. **Fechar o ciclo de retenção real**: hoje o roteiro já calcula uma curva de retenção prevista; falta puxar métricas reais do YouTube publicadas e comparar, pra calibrar os próximos roteiros.
2. **Niche Finder / radar de tendências**: buscar tópicos em alta no nicho antes de gerar ideias (hoje `generate-ideas` não usa nenhum sinal de tendência externo).
3. **Biblioteca de "Skills"**: salvar estruturas de roteiro/prompts que funcionaram bem, reutilizáveis entre projetos (mesmo padrão da Biblioteca de Referências).
4. **Ferramenta de transcrição/repurposing**: transcrever vídeos já publicados pra gerar cortes/shorts, aumentando volume de produção sem gerar tudo do zero.
5. **Automação do Google Flow via navegador**: ainda pendente de teste (usar a conta Plus do usuário via Claude-in-Chrome, sem custo de API). É a frente de maior impacto pra escalar produção de imagem/vídeo.
6. **Pipeline paralelo**: hoje um projeto de cada vez; rodar mais de um em paralelo quando o volume aumentar.
7. **Painel de saúde do sistema** dentro da própria ferramenta (uptime do worker, jobs travados, uso de memória), pra não depender de diagnóstico manual via terminal.

## Decisões técnicas / gotchas importantes (não esquecer)

- **Nunca rodar `prisma migrate dev`** neste projeto — não há pasta `prisma/migrations`, e ele tenta resetar o banco inteiro. Sempre usar `prisma db push`.
- **Lock de arquivo do Prisma no Windows**: qualquer processo Node com `@prisma/client` carregado (web, worker, ou scripts avulsos) trava o `query_engine-windows.dll.node`. Antes de rodar `db push`/`generate`, matar todos os processos node relevantes.
- **`tsx watch` reinicia o worker a cada salvamento** de arquivo em `apps/worker/src` — é esperado e seguro (jobs retomam sozinhos), mas por isso mudanças no worker nunca devem ser feitas enquanto um job pesado (ex.: RENDER_VIDEO) está rodando.
- **Next.js dev sem restart por dias acumula memória** — reiniciar o `pnpm dev` periodicamente (ou usar `--turbopack`, já aplicado) evita a maior parte da lentidão sentida.
- Restart de processos node só deve ser feito com confirmação explícita do usuário no chat.

# Plano: organização de pastas por tema + geração de imagem sem gargalo manual

Versão 0.1 · 09/09/2026

## Parte 1 — "Conectar com o Flow" — o que dá pra fazer de verdade

Pesquisei se existe API oficial do Google Flow ou algo tipo MCP pra automatizar a geração de imagem por lá. Veredito:

- **Não existe API oficial do Flow.** É um produto de consumidor (labs.google/flow), preso à sua conta/assinatura Google AI, sem endpoint documentado pra automação.
- **Existe um "Google Flow API" de terceiro (useapi.net)**, que automatiza sua conta real do Flow por trás dos panos — inclusive resolvendo captcha automaticamente. Isso é uma bandeira vermelha grande: pra funcionar, ele precisa da sua conta Google conectada, e "resolver captcha automaticamente" é exatamente o tipo de coisa que quebra os Termos de Uso do Google e pode te render um bloqueio de conta. Não recomendo — o risco (sua conta Google, não só a do YouTube) não compensa a economia.
- **O caminho real e oficial é pular o Flow e ir direto na API do Gemini** (o mesmo modelo por trás do "Nano Banana Pro" que você já usa dentro do Flow, mas acessado como API paga, sem interface). Isso é 100% suportado pela Google, sem risco de conta banida, e é exatamente o que o `.env.example` do projeto já reservou (`GEMINI_IMAGE_API_KEY`).

**Custo real (atualizado, com preço oficial 2026):** US$ 0,134 por imagem em 1K/2K de resolução (existe modo "batch/flex" a US$ 0,067 se não precisar da imagem na hora). Pra um episódio de 15 cenas como o que acabamos de fazer: **≈ US$ 2,00 o episódio**. Bem mais barato do que eu estimei antes — dava pra rodar uns 15-20 episódios por US$ 30-40.

Isso resolve o gargalo de verdade: hoje você gera uma imagem por vez manualmente no Flow, baixa, renomeia, importa. Com a API, o worker pede as 15 imagens de uma vez (respeitando o prompt de cada cena que já geramos hoje no `flow-pack.md`) e elas já nascem com o nome certo direto na pasta de cenas — zero trabalho manual, e ainda dá pra rodar em paralelo com você fazendo outra coisa.

### O que fica pra implementar (quando você topar)
1. `packages/providers/src/gemini/image.ts` — novo provider, molde igual ao `text.ts` que já existe, chamando o modelo de imagem do Gemini.
2. Novo job `GENERATE_SCENE_IMAGES` (ou expandir o `IMPORT_INBOX`) que lê as cenas com prompt pronto e chama a API pra cada uma, salvando direto em `scenes/aXX-sYY.png`.
3. Botão novo na tela de Mídia: "Gerar cenas com IA (pago, ~US$X)" — mostra o custo estimado antes de confirmar (o app já tem esse padrão de "modo pago vs. grátis" em outras telas).
4. Fallback: se a API falhar numa cena específica (às vezes acontece por política de conteúdo), ela cai pra pendente e você ainda pode gerar essa uma manualmente no Flow, sem perder as outras 14.

## Parte 2 — Organização de pastas por tema/orientação

Sua proposta:
```
storage/videos/
  horizontais/
    <tema do vídeo>/
      referencias/
      prompts/
      imagens/
  verticais/
    <tema do vídeo>/
      referencias/
      prompts/
      imagens/
```

Faz todo sentido pra quando você tiver 20-30 projetos — hoje cada projeto vive numa pasta com o ID interno (`projects/cmttfm2wf.../`), que é ótimo pro sistema mas ilegível pra você abrir manualmente e achar as coisas.

**Como isso bate com o que já existe:** hoje TODO o código (worker, rotas da API, a tela de mídia) grava e lê caminhos usando o ID do projeto como chave (`projects/<id>/cenas`, `projects/<id>/prompts`, etc.) — isso está espalhado em uns 8-10 arquivos. Trocar isso de uma vez é uma mudança estrutural, não um ajuste pequeno, e mexe em código que está rodando enquanto você produz. Pra fazer isso sem quebrar nada nem arriscar seus projetos atuais, a forma certa é:

1. Adicionar um campo `slug` no projeto (gerado do título, ex.: "6 Meses de Sol" → `6-meses-de-sol`) e um campo `format` já existe (`YOUTUBE_16_9` / `SHORT_9_16` — já dá pra separar horizontal/vertical automaticamente por aí).
2. Trocar a função central `projectDir()` (hoje só usa o ID) pra montar o caminho novo: `videos/{horizontais|verticais}/{slug}/...`, mantendo o ID só como chave interna do banco.
3. Migrar as pastas dos projetos que você já tem (é um script que só move arquivo — os caminhos gravados no banco são todos relativos, então dá pra migrar e atualizar o banco junto, sem perder nada).
4. Criar a pasta `referencias/` por projeto — hoje não existe. Ela serve pra você jogar imagens de estilo (uma logo, uma paleta, uma imagem "ancora" do visual do canal) que o `GENERATE_SCENE_PROMPTS` passa a mencionar no prompt de cada cena ("mantenha a mesma linguagem visual desta referência"), e que — quando entrarmos com a API de imagem da Parte 1 — vira imagem de referência de verdade (a API do Gemini aceita imagem de entrada pra guiar o estilo da geração, não só texto).

Isso é uma mudança de raiz do sistema de arquivos — vale a pena, mas quero fazer com cuidado (rodando com um projeto de teste antes de migrar os seus de verdade) pra não arriscar nada que você já produziu.

## Resumo de prioridade sugerida
1. Pasta `referencias/` por projeto (baixo risco, alto valor pra consistência visual) — dá pra fazer isolado, sem mexer no resto.
2. Reorganização `videos/horizontais|verticais/<tema>/` (estrutural, precisa de migração cuidadosa).
3. Geração de imagem via API Gemini direto (maior impacto pra escalar produção, custo baixo e previsível).

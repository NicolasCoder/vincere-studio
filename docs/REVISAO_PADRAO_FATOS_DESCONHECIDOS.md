# Revisão: aproximando o Vincere Studio do padrão "Fatos Desconhecidos"

Versão 0.1 · 09/09/2026

## O que os dados dizem sobre o canal de referência

Pesquisei o canal Fatos Desconhecidos (Ciência/Desastres/História/Mistério) pra embasar isso em números reais, não achismo:

- **22,9 milhões de inscritos**, **8.947 vídeos publicados**, visualização média de **83,8 mil** por vídeo (33,4 mil nos Shorts).
- **Engajamento de 0,05%** — classificado como "baixo" pelas ferramentas de análise. Ou seja: o canal não vive de comunidade fiel comentando, vive de **volume + título/thumbnail de altíssimo CTR** puxando tráfego de busca/recomendação constantemente.
- Cadência de publicação muito alta (frequência "14" no vidIQ, uma escala consideravelmente maior que a de canais de nicho fechado).
- Nas duas thumbnails que você mandou: título do vídeo é uma pergunta/afirmação de tensão ("Ele entregou tudo", "Deus vai destruir o Brasil?"), a thumbnail reforça a MESMA frase de um jeito mais curto e gritante (2 tons de cor, fonte gigante), e a descrição abaixo do título no feed já entrega um gancho extra.

Isso confirma o que o prompt de ideação do Vincere Studio já mira (título com "lacuna de curiosidade", ganchos nos primeiros segundos, cliffhangers) — o gargalo não é o roteiro, é tudo que vem DEPOIS do roteiro: thumbnail, metadados de publicação e volume de produção.

Sources:
- [Fatos Desconhecidos' YouTube Stats: Subscribers, Views & Earnings | vidIQ](https://vidiq.com/youtube-stats/channel/UCbAiIkPobUFy71zlmwVw3jw/)
- [Estatísticas do canal do YouTube de Fatos Desconhecidos — HypeAuditor](https://hypeauditor.com/youtube/UCbAiIkPobUFy71zlmwVw3jw/)

## Pontos de melhoria, do maior pro menor impacto

### 1. Thumbnail — feito hoje, mas ainda dá pra evoluir
Já upgradei o gerador `GENERATE_THUMBNAIL` pra manchete de 2 tons (branco + cor de destaque) com contorno grosso, que é o núcleo visual do padrão. Próximos passos quando fizer sentido:
- **Duas fotos na mesma thumbnail** (rosto/objeto principal + imagem secundária menor, tipo a do Tupac) — hoje o gerador usa só 1 cena. Dá pra aceitar `sceneId` + `sceneId2` e compor lado a lado.
- **Testar 2-3 variações de thumbnail por vídeo** e trocar manualmente pela que está performando melhor depois de publicado (isso só faz sentido quando o Channel Manager (`docs/CHANNEL_MANAGER_PLAN.md`) estiver puxando CTR real do YouTube Analytics).

### 2. Metadados de publicação — ainda não existe (Sprint 5, `PUBLISH_YOUTUBE` está com stub)
Hoje o roteirista já gera título, sinopse e hooks, mas isso não vira automaticamente descrição/tags otimizadas de SEO do YouTube. É o maior buraco pra bater o padrão do canal de referência, porque eles vivem de tráfego de busca. Quando formos implementar o `PUBLISH_YOUTUBE` de verdade, vale gerar junto:
- Descrição com as 2-3 primeiras linhas repetindo a pergunta do título (o que aparece no feed antes de expandir) + timestamps dos atos como capítulos.
- 15-20 tags derivadas das `keywords` que já existem por cena (elas já existem no banco, é só agregar).
- Um segundo prompt de "título de thumbnail" separado do título do vídeo — no roteiro de hoje o título do vídeo já é bom, mas a thumbnail merece uma versão ainda mais curta e "gritada" dele (3-5 palavras), gerada junto com a ideia.

### 3. Volume de produção — o maior fator de crescimento do canal de referência
Com 8.947 vídeos publicados, fica claro que o motor de crescimento deles é ritmo de publicação, não viralidade pontual. O pipeline atual já é rápido pro seu hardware (roteiro + voz + import manual do Flow + render local), mas o gargalo manual agora é a geração de imagem no Flow (uma por vez, sem automação). Isso já discutimos: quando fizer sentido financeiramente, a API do Nano Banana Pro elimina esse gargalo e permite gerar vários vídeos por dia sem você ficar clicando manualmente no Flow.

### 4. Primeiros 5 segundos — já bem endereçado no roteiro, falta só no vídeo
O prompt do roteiro (`scriptSystemPrompt`) já exige abrir com pergunta/imagem impossível de ignorar. Uma coisa que os canais desse padrão fazem e o render ainda não faz: **legenda/texto na tela reforçando a pergunta do gancho nos primeiros segundos**, além da narração — funciona como "thumbnail dentro do vídeo" pra quem assiste sem som. As legendas normais (Whisper) já existem, mas um card de abertura com o título/gancho em destaque (parecido com a thumbnail) reforçaria a retenção nos primeiros 3 segundos, que é onde a maior parte do abandono acontece.

### 5. Amplitude de nicho
O canal de referência não é hiperespecífico (mistura ciência, desastre natural, história, "fim do mundo") — isso maximiza alcance de busca/recomendação. Vale, ao gerar ideias novas (`GENERATE_IDEAS`), variar entre 3-4 "categorias-irmãs" dentro do seu nicho principal em vez de ficar só numa (isso já é possível hoje via o campo `niche`/`category` da ideia, é mais uma questão de curadoria na hora de escolher o que produzir do que de código).

## Resumo — o que fazer primeiro
1. (Feito agora) Thumbnail em manchete 2 tons.
2. Quando for implementar publicação: gerar descrição/tags/thumbnail-headline junto com a ideia, não deixar pro final.
3. Card de abertura com o gancho em texto grande no vídeo (pequeno, no `render`).
4. Avaliar a API de geração de imagem quando o volume de produção começar a esbarrar no gargalo manual do Flow.

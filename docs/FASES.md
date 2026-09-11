# Vincere Studio — Fases

Roteiro vivo. Cada fase tem um **critério de pronto** verificável: sem ele, "concluído"
vira opinião. Atualizar aqui conforme fecha, em vez de abrir documento novo.

Restrição em vigor: **produção roda em motor grátis**. Serviço pago entra só como apoio
pontual, nunca no caminho principal. Teto de orçamento: US$ 0.

---

## Fase 1 — Plano de edição · CONCLUÍDA

Modelo lê o roteiro alinhado e devolve inserções (lower third, dado, intertítulo,
inserção de arquivo, prova) ancoradas em frases-gatilho, resolvidas palavra a palavra
contra as legendas.

**Pronto porque:** 25 inserções no vídeo de referência, zero gatilhos não resolvidos.
Autocorreção de legibilidade mede a luminância real do frame e promove estilo
transparente para placa opaca quando o fundo é claro (provado com "Thomas Miller",
luma 196).

---

## Fase 2 — Aplicar a camada visual · CONCLUÍDA

Job `APPLY_VISUAL_LAYER`. Só os trechos com inserção passam pelo Remotion; o resto é
reencodado e tudo é costurado. 130s de 685s pelo Remotion — 19% do vídeo.

**Pronto porque:** execução `cmtvth2a4...` fechou em 685,0s contra 684,8s do master.
A verificação de duração agora vive dentro do job e derruba a execução se o desvio
passar de 2s (commit `451e335`).

**11/09 — o botão finalmente existe.** Até então a camada não tinha botão nenhum: a tela
gerava o PLANO (que é só uma proposta) e aplicá-lo só acontecia enfileirando o job na mão.
Na prática, 9 dos 10 projetos saíram sem uma única inserção, e nada na interface indicava
que faltava um passo. Corrigido em `f96448b`.

**11/09 — o vertical passou pela camada pela primeira vez**, e trouxe quatro defeitos que
existiam desde sempre sem nunca terem sido exercitados:

| Defeito | Causa | Commit |
|---|---|---|
| Saída com o dobro da duração | áudio 96 kHz nas lacunas contra 48 kHz nos trechos | `bf74828` |
| Trechos saindo deitados | composição travada em 1920×1080 | `9055c29` |
| Quadro de dado cortado | tudo dimensionado por `height` | `6ec5607` |
| Frase colada na seguinte | legenda cortava a cada 3 palavras fixas | `6ec5607` |

**Lição de método:** três tentativas erraram o alvo porque eu teorizei sobre a causa. Quando
abri os arquivos com `ffprobe`, ela apareceu em um comando. Medir antes de corrigir.

**Sobra desta fase:**
- Layout `split-evidencia` — o último dos 5 originais.

---

## Fase 3 — Publicar · PRIMEIRO VÍDEO NO AR

**11/09 — publicado:** "A cidade russa invadida por 50 ursos", privado, no Códex Perdido.
O upload funcionou; duas coisas falharam no caminho e estão registradas abaixo.

**Pendente com o Igor, nesta ordem:**
1. **Verificar o canal por telefone** (`youtube.com/verify_phone_number`). Sem isso a API
   recusa miniatura personalizada — e todo o trabalho de thumbnail fica inerte.
2. **Reconectar o YouTube** em Settings. O escopo `youtube.force-ssl` foi adicionado depois
   da primeira conexão (`92604a2`) e sem ele a legenda não sobe. O Settings avisa em amarelo.
3. **Criar as contas grátis** de Cloudflare e Hugging Face e colar as chaves no `.env`.
   Hoje só o Pollinations responde, e ele varia de 2,7s a 32,0s no mesmo prompt.

**Feito em 10/09:**
- YouTube Data API v3 ativada no projeto `Agente Criativo`
  (`gen-lang-client-0263902212`).
- Google Auth Platform configurada: app "Vincere Studio", público Externo,
  contato `igorcorinthians2019@gmail.com`.

**Falta:**
1. Escopos `youtube.upload` e `youtube.readonly` em **Acesso a dados**.
2. Adicionar a própria conta em **Público-alvo → usuários de teste**.
3. Criar o cliente OAuth (Aplicativo da Web) com o URI de redirecionamento
   `http://localhost:3210/api/auth/youtube/callback`.
4. Colar `YOUTUBE_CLIENT_ID` e `YOUTUBE_CLIENT_SECRET` no `.env` da raiz.
5. Settings → Canal do YouTube → Conectar.

**Armadilha conhecida:** com o app em "Testando", o Google expira o refresh token em
**7 dias** — reconexão semanal. Mudando para "Em produção" sem verificação, o token
para de expirar; em troca aparece a tela de "app não verificado" no login, que se
resolve em Avançado → prosseguir. Para uso na própria conta, é o caminho certo.

**Critério de pronto:** um vídeo publicado de verdade pelo Passo 5, aparecendo em
`/channels` marcado como feito na ferramenta.

---

## Fase 4 — AUTO_PRODUCE

Encadear as seis etapas sozinho, com agendamento. Aprovada em 09/09.

**Regra que não muda:** para no render. Publicação nunca é automática — quem aperta o
botão é você.

**Critério de pronto:** um projeto sai de "ideia" a "render pronto para revisão" sem
nenhuma intervenção manual no meio.

---

## Fase 5 — Aprender com dado real

Puxar retenção e desempenho reais do YouTube e comparar com a curva que o roteiro já
prevê, para calibrar os próximos. É o item 1 do backlog original.

**Depende da Fase 3.** Sem vídeo publicado não existe com o que comparar — é o que
separa "produzir muito" de "produzir melhor".

**Critério de pronto:** um roteiro novo escrito com ajuste vindo de número real, não
de palpite.

---

## Fase 6 — Operação por agente (MCP)

Expor o pipeline como ferramentas MCP, para operar por Claude/Gemini/ChatGPT.

**Deliberadamente por último.** Enquanto o pipeline muda toda semana, a superfície MCP
teria que ser reescrita junto. Vale quando estabilizar.

---

## Atravessa todas — testes automatizados

Não é fase, é dívida que cresce. Quatro defeitos passaram limpos por typecheck só
nesta semana:

| Defeito | Como apareceu |
|---|---|
| Tailwind sobrando na config do Remotion | bundle sem `bundle.js`, ENOENT enganoso |
| `translate` com unidades misturadas | Remotion recusou em runtime |
| `evidencePrompt` se contradizendo | 4 de 10 prompts pediam texto e proibiam texto |
| Costura com `time_base`/`pix_fmt` divergentes | vídeo de 64 min a partir de master de 11 |

O último teria sido entregue se ninguém conferisse. A verificação de duração dentro do
`APPLY_VISUAL_LAYER` é o primeiro pedaço dessa rede — falta o resto.

---

## Direção visual — em construção (11/09)

O objetivo declarado pelo Igor: edições em **ênfases**, não no vídeo todo, usando os assets
que já existem. O sistema já era seletivo (uma inserção a cada 20–35s, 19% dos frames no
vídeo de referência) — o que faltava era o botão e mais repertório de layout.

**Feito:**
- `cronologia` — linha do tempo animada sobre papel, **sem gerador de imagem**: o fundo é
  `props/fundos/fundo-papel-creme-01.jpg` e a linha é vetor no Remotion. Já é um layout que
  o plano sabe propor sozinho (`edit-plan.v5`, `7d78990`), quando a fala percorre um
  intervalo de datas. A posição de cada ponto vem da data real, não de espaçamento igual.
- Ritmo de corte afrouxado: Short de 1–2s para 2–4s, longo de 3–6s para 4–7s (`6ec5607`).
  81 segundos saíam com ~54 cenas.

**A separação que orienta o resto:** substrato fotográfico vem de gerador de imagem; texto,
número e linha vêm do Remotion. Pedir texto ao gerador devolve rabisco ilegível, e data
errada num documentário custa mais que imagem feia.

**Próximos layouts, todos usando asset parado no repositório:**
- mapa de rota (`mapa-topografico-01/02`)
- contador de número subindo no `overlay-dado`
- quadro de investigação (`quadro-investigacao` + `poeira-riscos`)

**Ponto em aberto:** a cronologia é horizontal por natureza e não cabe bem num quadro
vertical. Alguns layouts vão precisar de versão por formato, ou existir só em um.

---

## Acervo de imagem

- **Openverse** (Wikimedia) escrito e testado, ainda não ligado no `getStockProviders`.
  Busca real devolveu material histórico do Wikimedia com licença por item (BY 4.0,
  BY-SA 4.0). **Descoberta do teste:** "abandoned car highway night" voltou 0 resultados —
  o acervo é histórico e documental, não cena genérica. Ele **complementa** Pexels/Pixabay,
  não substitui. A licença viaja no `StockAsset` porque CC BY exige crédito.
- Motores de imagem: 4 grátis (Pollinations, Cloudflare, Hugging Face, Together) com
  cascata entre eles, e 3 pagos (Gemini, OpenAI, kie.ai) atrás do teto de US$ 0. **Só o
  Pollinations está de pé** — os outros três grátis esperam chave.

---

## Pendências soltas

- Paralelização de B-roll nunca testada num vídeo real.
- Narração paga não passa pelo `checkBudget` — o teto de US$ 0 não bloqueia TTS.
- Outras redes (TikTok, Instagram): nada construído. Repurposing só sugere trechos.
  Cada uma exige app próprio e aprovação de terceiro. Publicar manual por enquanto.
- Aba de conteúdos em alta no YouTube: viável pela Data API, mas cada busca custa 100 das
  10.000 unidades diárias — a mesma cota do upload. Precisa de cache antes de existir.
- Cortes de desenho/filme: **adiado por decisão do Igor** em 11/09, depois de eu apontar o
  risco de strike no canal recém-conectado. Caminho legítimo se voltar: domínio público
  (Internet Archive, Prelinger) e Wikimedia.

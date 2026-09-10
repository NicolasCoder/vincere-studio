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

**Sobra desta fase, não bloqueia as próximas:**
- Layout `split-evidencia` — o último dos 5.
- Etapa no Kanban: hoje o job só roda por fila, não tem botão na interface.

---

## Fase 3 — Publicar · EM ANDAMENTO

O código está pronto e testado desde antes: OAuth, upload, thumbnail, estatísticas.
Falta a credencial.

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

## Pendências soltas

- 3 das 9 evidências não geram no Pollinations grátis (limite de taxa do serviço).
- Paralelização de B-roll nunca testada num vídeo real.
- Narração paga não passa pelo `checkBudget` — o teto de US$ 0 não bloqueia TTS.
- Outras redes (TikTok, Instagram): nada construído. Repurposing só sugere trechos.
  Cada uma exige app próprio e aprovação de terceiro. Publicar manual por enquanto.

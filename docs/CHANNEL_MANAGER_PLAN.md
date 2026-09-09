# Channel Manager — Plano de Implementação

Sub-plano de `docs/PLANO_DE_DESENVOLVIMENTO.md`, cobrindo o que falta das Sprints 5 e 6 para o canal
Códex Perdido (e futuros canais) ficarem conectados de verdade: publicar pelo app e ver métricas reais
no painel, sem sair do DocuPulse Studio.

Contexto: o schema, as rotas (`/channels`, `/metrics`, `/projects/[id]/published`) e o `JobType`
`PUBLISH_YOUTUBE` já existem como placeholder ("Sprint 5") — este documento fecha essa lacuna com
algo concreto e implementável, seguindo os mesmos padrões já usados no resto do código (provider
adapters em `packages/providers`, jobs em `apps/worker/src/jobs`, fila via tabela `Job`).

---

## 1. Objetivo

1. Conectar o canal do YouTube ao app via OAuth (sem colar API key manual).
2. Publicar um episódio renderizado direto do Passo 5 (`/published`), com SEO gerado por IA e thumbnail.
3. Trazer métricas reais (inscritos, views, watch time, retenção por vídeo) para dentro do `/metrics` e
   de um `/channels` funcional — hoje ambos são só placeholder lendo um `stats` JSON que nunca é
   preenchido de verdade.
4. Preparar terreno para múltiplos canais (você já cogitou mais de um nicho).

---

## 2. Modelo de dados (aditivo — não quebra nada existente)

```prisma
/// Canal do YouTube conectado via OAuth. Um projeto pode ser publicado em qualquer canal conectado.
model Channel {
  id               String   @id @default(cuid())
  platform         String   @default("YOUTUBE")
  channelId        String   @unique   // "UC..." do YouTube
  title            String
  handle           String?             // "@CodexPerdido10"
  thumbnailUrl     String?
  accessToken      String              // criptografado (ver seção 6)
  refreshToken     String              // criptografado
  tokenExpiresAt   DateTime?
  scopes           String   @default("[]") // JSON string[]

  defaultVoiceProfileId String?
  defaultVoiceProfile   VoiceProfile? @relation(fields: [defaultVoiceProfileId], references: [id])
  defaultVisualStyle    String?       // reaproveita packages/core/visual-styles.ts

  uploadsToday     Int      @default(0)
  uploadsResetAt   DateTime?          // meia-noite UTC do dia da cota

  connectedAt      DateTime @default(now())
  updatedAt        DateTime @updatedAt

  publications     Publication[]
  metricSnapshots  ChannelMetricSnapshot[]
}

/// Série temporal de métricas do canal (para gráfico de tendência em /metrics).
model ChannelMetricSnapshot {
  id               String   @id @default(cuid())
  channelId        String
  channel          Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  capturedAt       DateTime @default(now())
  subscribers      Int?
  totalViews       Int?
  watchTimeMinutes Int?
  raw              String   @default("{}") // payload bruto da Analytics API, para depurar/expandir depois

  @@index([channelId, capturedAt])
}
```

E em `Publication`, adicionar a ligação com o canal usado (hoje ela existe solta, sem saber por qual
canal foi publicada):

```prisma
model Publication {
  ...
  channelId String?
  channel   Channel? @relation(fields: [channelId], references: [id])
  ...
}
```

Migração é aditiva (`prisma migrate dev`), não toca em dado existente.

---

## 3. Provider: `packages/providers/src/youtube/`

Seguindo o mesmo padrão de `voice/edge-tts.ts` e `stock/index.ts` (adapters simples com `fetch`, sem
SDK pesado — importante na sua máquina de 8GB/i7-7500U, `googleapis` sozinho tem ~30MB de deps):

```
packages/providers/src/youtube/
  auth.ts        buildAuthUrl(), exchangeCode(code), refreshAccessToken(channel)
  upload.ts      uploadVideo(channel, {filePath, title, description, tags, categoryId, privacyStatus})
                 → upload resumível (POST + PUT em chunks) na Data API v3
  thumbnail.ts   setThumbnail(channel, videoId, filePath)
  analytics.ts   fetchChannelSummary(channel) e fetchVideoStats(channel, videoIds[])
                 → YouTube Analytics API v2 (reports:query)
  types.ts
  index.ts
```

Usa `google-auth-library` só para o `OAuth2Client` (refresh de token é a parte chata de fazer na mão
com segurança); upload e analytics vão de `fetch` direto contra os endpoints REST, como o resto do
projeto já faz.

Escopos OAuth mínimos:
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

---

## 4. Fluxo OAuth (novo)

Novas rotas em `apps/web/app/api/oauth/youtube/`:

- `start/route.ts` — monta a `authUrl` (client id, redirect URI, escopos, `access_type=offline`,
  `prompt=consent` pra garantir refresh_token) e redireciona pro consent screen do Google.
- `callback/route.ts` — troca o `code` por tokens, chama `channels.list?mine=true` pra pegar
  `channelId`/`title`/`thumbnail`, faz upsert em `Channel`, redireciona pra `/channels`.

Requer no Google Cloud Console: um projeto OAuth "Desktop"/"Web" em modo **Testing** (não precisa
passar por revisão do Google pra uso pessoal, só cadastrar seu e-mail como test user), com o redirect
URI `http://localhost:3210/api/oauth/youtube/callback`.

Novas variáveis em `.env.example`:

```
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3210/api/oauth/youtube/callback"
TOKEN_ENCRYPTION_KEY=""   # 32 bytes hex, gerado uma vez (ver seção 6)
```

---

## 5. Jobs novos/completados (worker)

`packages/core/src/pipeline.ts` já tem `PUBLISH_YOUTUBE` no `JOB_TYPES`; falta só implementar de
verdade (hoje cai em `notImplemented("Sprint 5")`). Adicionar mais um tipo:

```ts
"PUBLISH_YOUTUBE",       // já existe — implementar
"SYNC_CHANNEL_STATS",    // novo
```

- **`apps/worker/src/jobs/publish-youtube.ts`**: lê o render mais recente do projeto (`RenderJob`),
  monta título/descrição/tags (reaproveita o mesmo prompt de SEO que já existe pro roteiro, ou um novo
  `packages/core/src/prompts/seo.ts`), sobe o vídeo via `youtube/upload.ts`, sobe a thumbnail se
  existir (`Project.thumbnailPath`), cria/atualiza a `Publication` com `channelId`, `videoId`, `url`,
  `publishedAt`. Progresso reportado em etapas (upload 0–90%, thumbnail 90–100%), igual ao render.

- **`apps/worker/src/jobs/sync-channel-stats.ts`**: para cada `Channel` conectado, busca resumo do
  canal (inscritos, views totais, watch time) e, para as `Publication`s dos últimos ~90 dias, busca
  views/CTR/duração média por vídeo via Analytics API; grava um `ChannelMetricSnapshot` e atualiza
  `Publication.stats`.

Registrar os dois em `apps/worker/src/jobs/index.ts` (troca a entrada `notImplemented("Sprint 5")` por
`publishYoutube`, adiciona `syncChannelStats`).

### Agendamento do sync (sem infra nova)

O worker hoje só faz polling da tabela `Job` (`apps/worker/src/index.ts`, loop de 1s). Para rodar o
sync periodicamente sem adicionar Redis/cron, uso o próprio `Setting` (chave/valor que já existe no
schema) como "última execução":

```ts
// dentro do loop principal, antes do tick() de jobs:
async function maybeScheduleStatsSync() {
  const key = "last_sync_channel_stats";
  const last = await prisma.setting.findUnique({ where: { key } });
  const dueAt = last ? new Date(last.value).getTime() + 4 * 60 * 60 * 1000 : 0; // a cada 4h
  if (Date.now() < dueAt) return;
  const channels = await prisma.channel.findMany({ select: { id: true } });
  for (const c of channels) {
    await prisma.job.create({ data: { type: "SYNC_CHANNEL_STATS", payload: JSON.stringify({ channelId: c.id }) } });
  }
  await prisma.setting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: { value: new Date().toISOString() } });
}
```

Simples, zero dependência nova, e dá pra chamar manualmente também (botão "Atualizar métricas" na UI
que só cria o `Job` direto).

---

## 6. Segurança dos tokens

`accessToken`/`refreshToken` são credenciais reais da sua conta do Google — diferente das chaves de
provider atuais (Gemini/Pexels), que são só chaves de uso próprio. Cripto simples com Node `crypto`
(AES-256-GCM) usando `TOKEN_ENCRYPTION_KEY` do `.env`, criptografando antes de gravar e descriptografando
só na hora de usar (`packages/providers/src/youtube/crypto.ts`). Chave gerada uma vez com
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e guardada só no seu `.env`
local (nunca commitada — já está fora do controle do Claude, você confirmou que cuida do `.env`
sozinho).

---

## 7. UI

- **`/channels`** (`apps/web/app/(studio)/channels/page.tsx`, hoje é só o placeholder "Nenhum canal
  conectado ainda"): botão "Conectar canal do YouTube" → `/api/oauth/youtube/start`; depois de
  conectado, um `Card` por canal com thumbnail, título, handle, inscritos (do último
  `ChannelMetricSnapshot`), cota de upload usada hoje, voz padrão e estilo visual padrão (editáveis
  inline), botão "Atualizar métricas agora" (cria o `Job` `SYNC_CHANNEL_STATS` na hora) e
  "Desconectar".

- **`/projects/[id]/published`**: hoje o botão "Publicado no YouTube" está `disabled`. Troca por um
  fluxo real: se não há canal conectado, CTA pra `/channels`; se há, um formulário pré-preenchido por
  IA (título, descrição, tags, capítulos a partir dos `ScriptBlock`) com seletor de canal (se houver
  mais de um) e visibilidade (público/não listado/privado) → cria o `Job` `PUBLISH_YOUTUBE` e mostra
  progresso como a tela de render já faz.

- **`/metrics`**: hoje só mostra consumo de API. Adicionar uma seção por canal (cards com inscritos/
  views/watch time do snapshot mais recente + um `Recharts` de tendência usando o histórico de
  `ChannelMetricSnapshot`) e uma tabela por vídeo publicado (view, CTR, duração média, comparando com a
  curva de retenção prevista que o roteiro já calcula — fecha o loop "a IA acertou a previsão?").

---

## 8. Cota da API

YouTube Data API v3: 10.000 unidades/dia no projeto padrão; um upload de vídeo custa ~1.600 unidades
→ dá pra uns 6 uploads/dia sem pedir aumento de cota (o mock original do Stitch já citava esse mesmo
número). Analytics API tem cota separada e bem mais folgada — o sync periódico não é problema. O
`Channel.uploadsToday`/`uploadsResetAt` do schema serve pra você ver isso no painel antes de estourar.

---

## 9. Ordem de implementação sugerida

1. **Schema**: `Channel`, `ChannelMetricSnapshot`, `Publication.channelId` — migração aditiva.
2. **OAuth**: rotas `start`/`callback` + `youtube/auth.ts` — testar conectando o canal Códex Perdido.
3. **`/channels`** com o card do canal conectado (sem métricas ainda, só a conexão funcionando).
4. **`PUBLISH_YOUTUBE`** de verdade + `/published` com o formulário real — primeiro vídeo publicado
   pelo app fecha a Sprint 5.
5. **`SYNC_CHANNEL_STATS`** + agendamento + `/channels` com métricas + `/metrics` com o painel por
   canal/vídeo — fecha a parte de métricas da Sprint 6.

Cada passo é testável isoladamente e não exige mexer em `packages/core`, `packages/render` ou nos jobs
já existentes (`RENDER_VIDEO`, `SYNTHESIZE_VOICE` etc.) — só adiciona por cima, sem risco pro que já
está funcionando.

---

*Rascunho gerado por Claude em 09/09/2026, a pedido do Igor, pra planejar o Channel Manager antes da
implementação. Nenhum código foi alterado ainda — este é só o plano.*

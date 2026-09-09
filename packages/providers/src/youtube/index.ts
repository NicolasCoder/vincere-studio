import { google } from "googleapis";
import { prisma } from "@docupulse/db";

/**
 * Publicação no YouTube via OAuth 2.0 (conta do próprio usuário, sem custo de API —
 * a YouTube Data API v3 tem cota diária gratuita generosa pra upload de vídeos).
 * Os tokens ficam guardados na tabela Setting (app local, um usuário só), como o
 * heartbeat do worker — sem tabela nova no schema.
 */

const SETTING_KEY = "youtube_oauth";
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

interface YoutubeTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope?: string;
  token_type?: string;
  channel_id: string;
  channel_title: string;
  channel_thumbnail?: string;
  connected_at: string;
}

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} não configurado no .env — veja as instruções em Settings pra conectar o YouTube.`);
  return v;
}

/** Cliente OAuth2 "cru", sem credenciais carregadas — usado pra gerar a URL de consentimento e trocar o code. */
export function youtubeOAuthClient() {
  return new google.auth.OAuth2(
    envOrThrow("YOUTUBE_CLIENT_ID"),
    envOrThrow("YOUTUBE_CLIENT_SECRET"),
    process.env.YOUTUBE_REDIRECT_URI || "http://localhost:3210/api/auth/youtube/callback",
  );
}

/** true só quando Client ID/Secret já foram colados no .env (não diz nada sobre estar conectado). */
export function youtubeCredentialsConfigured() {
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

/** URL de consentimento do Google — o usuário abre, loga com a própria conta e autoriza. */
export function getYoutubeAuthUrl() {
  const client = youtubeOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // pra garantir refresh_token
    prompt: "consent", // força reconsentimento (senão o Google só manda refresh_token na 1ª vez)
    scope: SCOPES,
  });
}

/** Troca o code do callback por tokens, busca o canal autenticado e salva tudo no Setting. */
export async function exchangeYoutubeCode(code: string) {
  const client = youtubeOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google não retornou refresh_token — revogue o acesso em myaccount.google.com/permissions e tente conectar de novo.");
  }
  client.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth: client });
  const res = await youtube.channels.list({ part: ["snippet"], mine: true });
  const channel = res.data.items?.[0];
  if (!channel) throw new Error("Não encontrei nenhum canal do YouTube nessa conta Google.");

  const record: YoutubeTokens = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600_000,
    scope: tokens.scope,
    token_type: tokens.token_type ?? undefined,
    channel_id: channel.id!,
    channel_title: channel.snippet?.title ?? "Canal do YouTube",
    channel_thumbnail: channel.snippet?.thumbnails?.default?.url ?? undefined,
    connected_at: new Date().toISOString(),
  };
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(record) },
    update: { value: JSON.stringify(record) },
  });
  return record;
}

/** Status pra UI: null se nunca conectou. Não faz chamada de rede. */
export async function getYoutubeConnection(): Promise<Pick<YoutubeTokens, "channel_id" | "channel_title" | "channel_thumbnail" | "connected_at"> | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  try {
    const t = JSON.parse(row.value) as YoutubeTokens;
    return { channel_id: t.channel_id, channel_title: t.channel_title, channel_thumbnail: t.channel_thumbnail, connected_at: t.connected_at };
  } catch {
    return null;
  }
}

export async function disconnectYoutube() {
  await prisma.setting.delete({ where: { key: SETTING_KEY } }).catch(() => {});
}

/** Cliente autenticado pronto pra usar nos jobs (upload, thumbnail). Persiste automaticamente
 * um access_token novo se o Google renovar durante o uso (refresh_token nunca muda). */
export async function getAuthenticatedYoutubeClient() {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) throw new Error("YouTube não conectado ainda — vá em Settings → Canal do YouTube e conecte sua conta.");
  const stored = JSON.parse(row.value) as YoutubeTokens;

  const client = youtubeOAuthClient();
  client.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: stored.expiry_date,
    scope: stored.scope,
    token_type: stored.token_type,
  });
  client.on("tokens", (tokens) => {
    const merged: YoutubeTokens = {
      ...stored,
      access_token: tokens.access_token ?? stored.access_token,
      refresh_token: tokens.refresh_token ?? stored.refresh_token,
      expiry_date: tokens.expiry_date ?? stored.expiry_date,
    };
    prisma.setting.update({ where: { key: SETTING_KEY }, data: { value: JSON.stringify(merged) } }).catch(() => {});
  });

  return { youtube: google.youtube({ version: "v3", auth: client }), channelId: stored.channel_id, channelTitle: stored.channel_title };
}

import type { z } from "zod";
import { toGeminiSchema } from "../schema";
import { prisma } from "@docupulse/db";
import { ProviderError, type GenerateOptions, type TextProvider, type UsageInfo } from "../types";

/** Preço por 1M tokens (US$). Atualize conforme ai.google.dev/gemini-api/docs/pricing. */
const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-3.8-flash": { in: 0.75, out: 3.75 },
  "gemini-3.7-flash": { in: 0.75, out: 3.75 },
  "gemini-3.6-flash": { in: 0.75, out: 3.75 },
  "gemini-3.1-pro-preview": { in: 2, out: 12 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "gemini-3.5-flash": { in: 1.5, out: 9 },
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5 },
};
const DEFAULT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
/** Modelos de reserva quando o principal está indisponível (429/503). Todos com nível gratuito. */
const FALLBACKS = (process.env.GEMINI_TEXT_FALLBACKS || "gemini-3.5-flash-lite,gemini-3.7-flash,gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest").split(",").map((m) => m.trim()).filter(Boolean);
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
/** Lembra por 10 min qual modelo respondeu bem, para não repetir retentativas em cada job. */
let healthy: { model: string; until: number } | null = null;
let healthyLoaded = false;
const STICKY_MS = 10 * 60_000;
const STICKY_KEY = "gemini.healthyModel";
async function loadHealthy() {
  if (healthyLoaded) return;
  healthyLoaded = true;
  try {
    const row = await prisma.setting.findUnique({ where: { key: STICKY_KEY } });
    if (row) healthy = JSON.parse(row.value);
  } catch {}
}
async function saveHealthy(model: string) {
  healthy = { model, until: Date.now() + STICKY_MS };
  try {
    await prisma.setting.upsert({ where: { key: STICKY_KEY }, create: { key: STICKY_KEY, value: JSON.stringify(healthy) }, update: { value: JSON.stringify(healthy) } });
  } catch {}
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string; status?: string };
}

export class GeminiTextProvider implements TextProvider {
  readonly name = "GEMINI";
  constructor(private readonly apiKey = process.env.GEMINI_API_KEY ?? "") {
    if (!this.apiKey) throw new ProviderError("GEMINI_API_KEY não configurada no .env");
  }

  /** Chama com retentativas (backoff) e, se persistir, cai para os modelos de reserva. */
  private async call(model: string, body: Record<string, unknown>): Promise<{ text: string; usage: UsageInfo }> {
    await loadHealthy();
    const preferred = healthy && healthy.until > Date.now() ? healthy.model : model;
    const chain = [preferred, model, ...FALLBACKS].filter((m, i, a) => a.indexOf(m) === i);
    let lastErr: unknown;
    for (const m of chain) {
      // 429 (cota): até 3 tentativas com backoff. 503/5xx (sobrecarga): 1 tentativa curta e pula de modelo.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const out = await this.callOnce(m, body);
          if (healthy?.model !== m || (healthy?.until ?? 0) < Date.now() + STICKY_MS / 2) await saveHealthy(m);
          return out;
        } catch (err) {
          lastErr = err;
          const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
          const status = err instanceof ProviderError ? err.status : isTimeout ? 504 : undefined;
          if (!status || !RETRYABLE.has(status)) throw err;
          if (status === 429) {
            if (attempt === 0) console.warn(`[gemini] ${m}: cota/limite (429), aguardando...`);
            await sleep(2000 * 2 ** attempt);
            continue;
          }
          if (attempt >= 1) break; // 5xx: uma retentativa curta e segue para o próximo modelo
          await sleep(1500);
        }
      }
      console.warn(`[gemini] ${m} indisponível; tentando modelo de reserva...`);
    }
    throw lastErr;
  }

  private async callOnce(model: string, body: Record<string, unknown>): Promise<{ text: string; usage: UsageInfo }> {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.GEMINI_TIMEOUT_MS ?? 120_000)),
    });
    const json = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) throw new ProviderError(`Gemini ${res.status}: ${json.error?.message ?? res.statusText}`, res.status, json);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new ProviderError(`Gemini não retornou texto (finishReason=${json.candidates?.[0]?.finishReason ?? "?"})`, 502, json);
    const tokensIn = json.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = (json.usageMetadata?.candidatesTokenCount ?? 0) + (json.usageMetadata?.thoughtsTokenCount ?? 0);
    const price = PRICING[model] ?? PRICING["gemini-3.8-flash"];
    const costUsd = (tokensIn * price.in + tokensOut * price.out) / 1_000_000;
    return { text, usage: { provider: this.name, model, tokensIn, tokensOut, costUsd } };
  }

  private body(prompt: string, opts: GenerateOptions, extra: Record<string, unknown> = {}) {
    return {
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: opts.temperature ?? 0.9, maxOutputTokens: opts.maxOutputTokens ?? 8192, ...extra },
    };
  }

  async generateText(prompt: string, opts: GenerateOptions = {}) {
    return this.call(opts.model ?? DEFAULT_MODEL, this.body(prompt, opts));
  }

  async generateJson<T extends z.ZodTypeAny>(prompt: string, schema: T, opts: GenerateOptions = {}) {
    const model = opts.model ?? DEFAULT_MODEL;
    const { text, usage } = await this.call(model, this.body(prompt, opts, { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) }));
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ProviderError("Gemini retornou JSON inválido", 502, text);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) throw new ProviderError(`Resposta fora do schema: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`, 502, parsed);
    return { data: result.data as z.infer<T>, usage, raw: text };
  }
}

import type { z } from "zod";
import { ProviderError, type GenerateOptions, type TextProvider, type UsageInfo } from "../types";
import { schemaInstruction } from "../schema";

/**
 * Limite do plano gratuito (429, ou 402 FREE_LIMIT no Pollinations): quanto esperar antes de tentar de novo.
 * Usa o Retry-After do servidor ou o "Retry after Ns" da mensagem; null = erro de verdade, não repetir.
 */
export function retryDelayMs(status: number, body: string, retryAfterHeader?: string | null): number | null {
  const limite = status === 429 || (status === 402 && /FREE_LIMIT|rate|limit/i.test(body));
  if (!limite) return null;
  const header = Number(retryAfterHeader);
  const msg = /retry after (\d+)\s*s/i.exec(body);
  const seconds = Number.isFinite(header) && header > 0 ? header : msg ? Number(msg[1]) : 5;
  // Teto de 60 s por espera, mais 1 s de folga para o relógio do servidor.
  return Math.min(60, Math.max(1, seconds)) * 1000 + 1000;
}

/** Extrai o primeiro valor JSON de uma resposta de modelo: aceita cercas ```json e texto antes/depois. */
export function extractJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const candidates: string[] = [raw.trim()];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const bloco = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (bloco) candidates.push(bloco[0]);
  for (const c of candidates) {
    if (!c) continue;
    try {
      return { ok: true, value: JSON.parse(c) };
    } catch {
      // tenta o próximo candidato
    }
  }
  return { ok: false };
}

/**
 * Qualquer servidor com a API de chat da OpenAI (/v1/chat/completions): NVIDIA NIM (grátis),
 * OpenRouter (modelos :free), Groq, LM Studio, Ollama (/v1) ou o gateway do Hermes.
 * Configuração: OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_API_KEY, OPENAI_COMPAT_MODEL e, quando o
 * servidor não usa o caminho padrão, OPENAI_COMPAT_CHAT_URL (URL completa do chat).
 */
export class OpenAICompatTextProvider implements TextProvider {
  readonly name = "OPENAI_COMPAT";
  private readonly baseUrl: string;
  private readonly chatUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(
    baseUrl = process.env.OPENAI_COMPAT_BASE_URL || "https://integrate.api.nvidia.com/v1",
    apiKey = process.env.OPENAI_COMPAT_API_KEY || "",
    defaultModel = process.env.OPENAI_COMPAT_MODEL || "nvidia/nemotron-3-super-120b-a12b",
    chatUrl = process.env.OPENAI_COMPAT_CHAT_URL || "",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.chatUrl = chatUrl || `${this.baseUrl}/chat/completions`;
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  private async chat(prompt: string, opts: GenerateOptions, json: boolean, jsonInstruction?: string) {
    const model = opts.model || this.defaultModel;
    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      {
        role: "user",
        content: json ? `${prompt}\n\n${jsonInstruction ?? "Responda APENAS com JSON válido, sem markdown."}` : prompt,
      },
    ];
    const requestBody = JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? (json ? 0.3 : 0.7),
      max_tokens: opts.maxOutputTokens ?? (Number(process.env.OPENAI_COMPAT_MAX_TOKENS) || 4096),
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });
    const maxRetries = Math.max(0, Number(process.env.OPENAI_COMPAT_RETRIES ?? 3));
    let res: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      let current: Response;
      try {
        current = await fetch(this.chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: requestBody,
          signal: AbortSignal.timeout(Number(process.env.OPENAI_COMPAT_TIMEOUT_MS ?? 120_000)),
        });
      } catch (err) {
        throw new ProviderError(`Sem conexão com ${this.baseUrl}: ${err instanceof Error ? err.message : err}`, 503, err);
      }
      res = current;
      if (current.ok) break;
      const errText = await current.text().catch(() => current.statusText);
      const waitMs = attempt < maxRetries ? retryDelayMs(current.status, errText, current.headers.get("retry-after")) : null;
      if (waitMs === null) throw new ProviderError(`${this.name} ${current.status}: ${errText.slice(0, 300)}`, current.status);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    if (!res) throw new ProviderError(`${this.name}: sem resposta`, 502);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const usage: UsageInfo = {
      provider: this.name,
      model,
      tokensIn: body.usage?.prompt_tokens ?? 0,
      tokensOut: body.usage?.completion_tokens ?? 0,
      costUsd: 0,
    };
    return { text, usage };
  }

  async generateText(prompt: string, opts: GenerateOptions = {}) {
    return this.chat(prompt, opts, false);
  }

  async generateJson<T extends z.ZodTypeAny>(prompt: string, schema: T, opts: GenerateOptions = {}) {
    const instruction = schemaInstruction(schema);
    const maxFixes = Math.max(0, Number(process.env.OPENAI_COMPAT_JSON_FIXES ?? 1));
    let currentPrompt = prompt;
    let tokensIn = 0;
    let tokensOut = 0;
    let lastError = "";
    for (let attempt = 0; attempt <= maxFixes; attempt++) {
      const { text: raw, usage } = await this.chat(currentPrompt, opts, true, instruction);
      tokensIn += usage.tokensIn;
      tokensOut += usage.tokensOut;
      const parsed = extractJson(raw);
      if (parsed.ok) {
        const result = schema.safeParse(parsed.value);
        if (result.success) {
          return { data: result.data as z.infer<T>, usage: { ...usage, tokensIn, tokensOut }, raw };
        }
        lastError = `Resposta fora do schema: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`;
      } else {
        lastError = raw.trim()
          ? `${this.name} não retornou JSON válido (início da resposta: ${raw.trim().slice(0, 160).replace(/\s+/g, " ")})`
          : `${this.name} devolveu resposta vazia (modelos de raciocínio podem gastar todos os tokens pensando; aumente OPENAI_COMPAT_MAX_TOKENS)`;
      }
      if (attempt < maxFixes) {
        // Uma correção guiada resolve a maioria dos modelos fracos/gratuitos sem repetir o prompt inteiro de novo.
        currentPrompt = `${prompt}

Sua resposta anterior foi rejeitada: ${lastError}
Responda de novo, só com o JSON correto.`;
      }
    }
    throw new ProviderError(lastError, 502);
  }
}

import type { z } from "zod";
import { ProviderError, type GenerateOptions, type TextProvider, type UsageInfo } from "../types";

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

  private async chat(prompt: string, opts: GenerateOptions, json: boolean) {
    const model = opts.model || this.defaultModel;
    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: json ? `${prompt}\n\nResponda APENAS com JSON válido, sem markdown.` : prompt },
    ];
    let res: Response;
    try {
      res = await fetch(this.chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? (json ? 0.3 : 0.7),
          max_tokens: opts.maxOutputTokens ?? 4096,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(Number(process.env.OPENAI_COMPAT_TIMEOUT_MS ?? 120_000)),
      });
    } catch (err) {
      throw new ProviderError(`Sem conexão com ${this.baseUrl}: ${err instanceof Error ? err.message : err}`, 503, err);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new ProviderError(`${this.name} ${res.status}: ${errText.slice(0, 300)}`, res.status);
    }
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
    const { text: raw, usage } = await this.chat(prompt, opts, true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!match) throw new ProviderError(`${this.name} não retornou JSON válido`, 502, raw);
      parsed = JSON.parse(match[0]);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderError(
        `Resposta fora do schema: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
        502,
        parsed,
      );
    }
    return { data: result.data as z.infer<T>, usage, raw };
  }
}

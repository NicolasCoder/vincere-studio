import type { z } from "zod";
import { schemaInstruction } from "../schema";
import { ProviderError, type GenerateOptions, type TextProvider, type UsageInfo } from "../types";

export class OllamaTextProvider implements TextProvider {
  readonly name = "OLLAMA";
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    defaultModel = process.env.OLLAMA_MODEL || "qwen2.5:7b"
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultModel = defaultModel;
  }

  async generateText(prompt: string, opts: GenerateOptions = {}): Promise<{ text: string; usage: UsageInfo }> {
    const model = opts.model || this.defaultModel;
    const body = {
      model,
      prompt,
      system: opts.system,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxOutputTokens ?? 4096,
      },
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000)),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new ProviderError(`Ollama ${res.status}: ${errText}`, res.status);
      }

      const json = (await res.json()) as any;
      const text = json.response || "";
      const tokensIn = json.prompt_eval_count || 0;
      const tokensOut = json.eval_count || 0;

      return {
        text,
        usage: {
          provider: this.name,
          model,
          tokensIn,
          tokensOut,
          costUsd: 0, // Open-source local execution is 100% free
        },
      };
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(`Erro de conexão com Ollama em ${this.baseUrl}: ${err.message}`, 503, err);
    }
  }

  async generateJson<T extends z.ZodTypeAny>(
    prompt: string,
    schema: T,
    opts: GenerateOptions = {}
  ): Promise<{ data: z.infer<T>; usage: UsageInfo; raw: string }> {
    const model = opts.model || this.defaultModel;
    const jsonPrompt = `${prompt}\n\n${schemaInstruction(schema)}`;

    const body = {
      model,
      prompt: jsonPrompt,
      system: opts.system ? `${opts.system}\nVocê DEVE responder exclusivamente em formato JSON válido.` : "Você DEVE responder exclusivamente em formato JSON válido.",
      stream: false,
      format: "json",
      options: {
        temperature: opts.temperature ?? 0.3,
        num_predict: opts.maxOutputTokens ?? 4096,
      },
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000)),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new ProviderError(`Ollama ${res.status}: ${errText}`, res.status);
      }

      const json = (await res.json()) as any;
      const raw = json.response || "{}";
      const tokensIn = json.prompt_eval_count || 0;
      const tokensOut = json.eval_count || 0;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Fallback for markdown blocks
        const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new ProviderError("Ollama não retornou um JSON válido", 502, raw);
        }
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new ProviderError(
          `Resposta fora do schema: ${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
          502,
          parsed
        );
      }

      return {
        data: result.data as z.infer<T>,
        usage: {
          provider: this.name,
          model,
          tokensIn,
          tokensOut,
          costUsd: 0,
        },
        raw,
      };
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(`Erro de conexão com Ollama em ${this.baseUrl}: ${err.message}`, 503, err);
    }
  }
}

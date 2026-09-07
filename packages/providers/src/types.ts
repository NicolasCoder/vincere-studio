import type { z } from "zod";

/** Resultado padrão de qualquer chamada: dados + consumo medido. */
export interface UsageInfo {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface GenerateOptions {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Modelo específico; senão usa o padrão do provedor. */
  model?: string;
}

/** Provedor de texto: gera JSON validado por um schema Zod (structured output). */
export interface TextProvider {
  readonly name: string;
  generateJson<T extends z.ZodTypeAny>(prompt: string, schema: T, opts?: GenerateOptions): Promise<{ data: z.infer<T>; usage: UsageInfo; raw: string }>;
  generateText(prompt: string, opts?: GenerateOptions): Promise<{ text: string; usage: UsageInfo }>;
}

export class ProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

import type { z } from "zod";
import { ProviderError, type GenerateOptions, type TextProvider } from "./types";

// Cada tarefa de texto pode usar um provedor diferente (roteiro num, ideias em outro) e, se ele falhar, uma reserva.
// Configuração por instância: TEXT_PROVIDER_<TAREFA> (ex.: TEXT_PROVIDER_ROTEIRO=OPENAI_COMPAT) e TEXT_PROVIDER_FALLBACK.
// Sem nada configurado, vale o TEXT_PROVIDER de sempre.

export const TAREFAS_TEXTO = ["ideias", "roteiro", "cenas", "edicao", "seo", "fluxo", "sharingan"] as const;
export type TarefaTexto = (typeof TAREFAS_TEXTO)[number];

type Ambiente = Record<string, string | undefined>;

export function nomeDoProvedorDaTarefa(tarefa: TarefaTexto, env: Ambiente = process.env): string {
  return env[`TEXT_PROVIDER_${tarefa.toUpperCase()}`]?.trim() || env.TEXT_PROVIDER?.trim() || "GEMINI";
}

export function nomeDaReserva(env: Ambiente = process.env): string | null {
  return env.TEXT_PROVIDER_FALLBACK?.trim() || null;
}

function motivo(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Tenta o provedor principal; se falhar, tenta a reserva (criada só se for preciso). */
export class ProvedorComReserva implements TextProvider {
  readonly name: string;

  constructor(
    private readonly principal: TextProvider,
    private readonly criarReserva: () => TextProvider,
    private readonly nomeReserva: string,
  ) {
    this.name = principal.name;
  }

  private async daReserva<T>(erroPrincipal: unknown, usar: (r: TextProvider) => Promise<T>): Promise<T> {
    console.warn(`[texto] ${this.principal.name} falhou (${motivo(erroPrincipal)}); tentando a reserva ${this.nomeReserva}.`);
    try {
      return await usar(this.criarReserva());
    } catch (erroReserva) {
      throw new ProviderError(
        `${this.principal.name} falhou (${motivo(erroPrincipal)}) e a reserva ${this.nomeReserva} também (${motivo(erroReserva)}).`,
        502,
      );
    }
  }

  // O modelo escolhido para o principal não existe na reserva: some com ele ao trocar.
  private semModelo(opts?: GenerateOptions): GenerateOptions {
    return { ...opts, model: undefined };
  }

  async generateJson<T extends z.ZodTypeAny>(prompt: string, schema: T, opts?: GenerateOptions) {
    try {
      return await this.principal.generateJson(prompt, schema, opts);
    } catch (err) {
      return this.daReserva(err, (r) => r.generateJson(prompt, schema, this.semModelo(opts)));
    }
  }

  async generateText(prompt: string, opts?: GenerateOptions) {
    try {
      return await this.principal.generateText(prompt, opts);
    } catch (err) {
      return this.daReserva(err, (r) => r.generateText(prompt, this.semModelo(opts)));
    }
  }
}

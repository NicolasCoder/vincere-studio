import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ProvedorComReserva, TAREFAS_TEXTO, nomeDaReserva, nomeDoProvedorDaTarefa } from "./texto-por-tarefa";
import type { TextProvider } from "./types";

const uso = { provider: "X", model: "m", tokensIn: 1, tokensOut: 1, costUsd: 0 };

function falso(nome: string, comportamento: { json?: () => unknown; texto?: () => string }): TextProvider & { chamadas: number; ultimoModelo?: string } {
  const p = {
    name: nome,
    chamadas: 0,
    ultimoModelo: undefined as string | undefined,
    async generateJson(_prompt: string, _schema: unknown, opts?: { model?: string }) {
      p.chamadas++;
      p.ultimoModelo = opts?.model;
      const data = comportamento.json?.();
      return { data, usage: uso, raw: JSON.stringify(data) };
    },
    async generateText(_prompt: string, opts?: { model?: string }) {
      p.chamadas++;
      p.ultimoModelo = opts?.model;
      return { text: comportamento.texto?.() ?? "", usage: uso };
    },
  };
  return p as unknown as TextProvider & { chamadas: number; ultimoModelo?: string };
}

const quebra = (msg: string) => () => {
  throw new Error(msg);
};

describe("nomeDoProvedorDaTarefa", () => {
  it("usa o da tarefa, depois o TEXT_PROVIDER, depois o GEMINI", () => {
    expect(nomeDoProvedorDaTarefa("roteiro", { TEXT_PROVIDER_ROTEIRO: "OPENAI_COMPAT", TEXT_PROVIDER: "OLLAMA" })).toBe("OPENAI_COMPAT");
    expect(nomeDoProvedorDaTarefa("ideias", { TEXT_PROVIDER_ROTEIRO: "OPENAI_COMPAT", TEXT_PROVIDER: "OLLAMA" })).toBe("OLLAMA");
    expect(nomeDoProvedorDaTarefa("seo", {})).toBe("GEMINI");
  });

  it("ignora valor vazio e espaços", () => {
    expect(nomeDoProvedorDaTarefa("cenas", { TEXT_PROVIDER_CENAS: "  ", TEXT_PROVIDER: "OLLAMA" })).toBe("OLLAMA");
  });

  it("a reserva só existe quando configurada", () => {
    expect(nomeDaReserva({})).toBeNull();
    expect(nomeDaReserva({ TEXT_PROVIDER_FALLBACK: "GEMINI" })).toBe("GEMINI");
  });

  it("lista as tarefas conhecidas", () => {
    expect(TAREFAS_TEXTO).toContain("roteiro");
    expect(TAREFAS_TEXTO).toContain("ideias");
  });
});

describe("ProvedorComReserva", () => {
  afterEach(() => vi.restoreAllMocks());
  const schema = z.object({ a: z.string() });

  it("não toca na reserva quando o principal funciona", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const principal = falso("HERMES", { json: () => ({ a: "ok" }) });
    const criarReserva = vi.fn();
    const r = await new ProvedorComReserva(principal, criarReserva, "GEMINI").generateJson("x", schema);
    expect(r.data).toEqual({ a: "ok" });
    expect(criarReserva).not.toHaveBeenCalled();
  });

  it("se o principal falhar, usa a reserva e tira o modelo do principal", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const principal = falso("HERMES", { json: quebra("fora do ar") });
    const reserva = falso("GEMINI", { json: () => ({ a: "da-reserva" }) });
    const r = await new ProvedorComReserva(principal, () => reserva, "GEMINI").generateJson("x", schema, { model: "modelo-do-hermes" });
    expect(r.data).toEqual({ a: "da-reserva" });
    expect(reserva.ultimoModelo).toBeUndefined();
  });

  it("funciona também para texto corrido", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const principal = falso("HERMES", { texto: quebra("fora do ar") });
    const reserva = falso("GEMINI", { texto: () => "resposta da reserva" });
    const r = await new ProvedorComReserva(principal, () => reserva, "GEMINI").generateText("x");
    expect(r.text).toBe("resposta da reserva");
  });

  it("se as duas falharem, o erro cita as duas", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const principal = falso("HERMES", { json: quebra("sem rede") });
    const reserva = falso("GEMINI", { json: quebra("sem chave") });
    await expect(new ProvedorComReserva(principal, () => reserva, "GEMINI").generateJson("x", schema)).rejects.toThrow(/sem rede.*sem chave/s);
  });

  it("se nem for possível criar a reserva (ex.: falta chave), o erro cita as duas", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const principal = falso("HERMES", { json: quebra("sem rede") });
    const criarReserva = () => {
      throw new Error("GEMINI_API_KEY não configurada");
    };
    await expect(new ProvedorComReserva(principal, criarReserva, "GEMINI").generateJson("x", schema)).rejects.toThrow(/sem rede.*GEMINI_API_KEY/s);
  });
});

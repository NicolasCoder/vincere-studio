import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { OpenAICompatTextProvider, extractJson, retryDelayMs } from "./text";

describe("retryDelayMs", () => {
  it("espera o tempo que o Pollinations pede (402 FREE_LIMIT) com folga de 1 s", () => {
    const body = '{"error":{"code":"FREE_LIMIT","message":"Free limit reached: 1 reply every 30 seconds per IP. Retry after 2s"}}';
    expect(retryDelayMs(402, body)).toBe(3000);
  });

  it("usa o Retry-After do 429", () => {
    expect(retryDelayMs(429, "too many requests", "12")).toBe(13000);
  });

  it("429 sem dica espera 5 s", () => {
    expect(retryDelayMs(429, "")).toBe(6000);
  });

  it("limita a espera a 60 s", () => {
    expect(retryDelayMs(429, "", "600")).toBe(61000);
  });

  it("não repete erro de verdade (402 de pagamento, 401, 500)", () => {
    expect(retryDelayMs(402, "payment required: add credits")).toBeNull();
    expect(retryDelayMs(401, "bad key")).toBeNull();
    expect(retryDelayMs(500, "boom")).toBeNull();
  });
});

describe("OpenAICompatTextProvider.generateJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  const ok = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });

  it("envia o schema ao modelo (modelos que não são o Gemini inventavam os campos)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok('{"title":"a","tags":["x"]}'));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatTextProvider("http://modelo.local/v1", "", "m");
    const out = await provider.generateJson("Dê um título", z.object({ title: z.string(), tags: z.array(z.string()) }));
    expect(out.data).toEqual({ title: "a", tags: ["x"] });
    const enviado = JSON.parse(fetchMock.mock.calls[0]![1].body as string).messages.at(-1).content as string;
    expect(enviado).toContain("Schema:");
    expect(enviado).toContain('"required":["title","tags"]');
  });

  it("espera e repete quando o plano gratuito limita (402 FREE_LIMIT) em vez de falhar o job", async () => {
    vi.useFakeTimers();
    const limite = new Response('{"error":{"code":"FREE_LIMIT","message":"Retry after 2s"}}', { status: 402 });
    const fetchMock = vi.fn().mockResolvedValueOnce(limite).mockResolvedValueOnce(ok('{"title":"b"}'));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatTextProvider("http://modelo.local/v1", "", "m");
    const promessa = provider.generateJson("x", z.object({ title: z.string() }));
    await vi.advanceTimersByTimeAsync(3000);
    expect((await promessa).data).toEqual({ title: "b" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("não repete erro de autenticação", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatTextProvider("http://modelo.local/v1", "", "m");
    await expect(provider.generateJson("x", z.object({ a: z.string() }))).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("extractJson", () => {
  it("aceita JSON puro, cerca de markdown e texto em volta", () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(extractJson("```json\n{\"a\":2}\n```")).toEqual({ ok: true, value: { a: 2 } });
    expect(extractJson('Claro! Aqui está: {"a":3} Espero que ajude.')).toEqual({ ok: true, value: { a: 3 } });
  });

  it("recusa texto sem JSON e resposta vazia", () => {
    expect(extractJson("não sei").ok).toBe(false);
    expect(extractJson("").ok).toBe(false);
  });
});

describe("generateJson com correção guiada", () => {
  afterEach(() => vi.unstubAllGlobals());
  const ok = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 5, completion_tokens: 7 } }), { status: 200 });

  it("tenta de novo uma vez dizendo o que veio errado e soma os tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok('{"outro":"campo"}')).mockResolvedValueOnce(ok('{"title":"certo"}'));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatTextProvider("http://modelo.local/v1", "", "m");
    const out = await provider.generateJson("x", z.object({ title: z.string() }));
    expect(out.data).toEqual({ title: "certo" });
    expect(out.usage.tokensIn).toBe(10);
    const segundo = JSON.parse(fetchMock.mock.calls[1]![1].body as string).messages.at(-1).content as string;
    expect(segundo).toContain("rejeitada");
    expect(segundo).toContain("title");
  });

  it("desiste depois da correção e mostra o início da resposta no erro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok("desculpe, não consigo")));
    const provider = new OpenAICompatTextProvider("http://modelo.local/v1", "", "m");
    await expect(provider.generateJson("x", z.object({ a: z.string() }))).rejects.toThrow(/desculpe, não consigo/);
  });

  it("explica resposta vazia (modelo de raciocínio sem tokens)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok("")));
    const provider = new OpenAICompatTextProvider("http://modelo.local/v1", "", "m");
    await expect(provider.generateJson("x", z.object({ a: z.string() }))).rejects.toThrow(/vazia/);
  });
});

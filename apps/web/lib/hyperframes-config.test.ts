import { describe, expect, it, vi } from "vitest";

// Evita abrir o banco: só a lógica pura é testada aqui.
vi.mock("@vincere-studio/db", () => ({ prisma: {} }));

import { resolverAlvo, testarHyperframes, validarUrlRemota } from "./hyperframes-config";

describe("validarUrlRemota", () => {
  it("aceita http e https e devolve só a origem", () => {
    expect(validarUrlRemota("http://127.0.0.1:3010")).toBe("http://127.0.0.1:3010");
    expect(validarUrlRemota(" https://meu-servidor.com:8443/qualquer/coisa?x=1 ")).toBe("https://meu-servidor.com:8443");
  });

  it("recusa vazio, texto solto, outro protocolo e credenciais no endereço", () => {
    expect(() => validarUrlRemota("")).toThrow(/Informe/);
    expect(() => validarUrlRemota("meu-servidor:3010")).toThrow(/http/);
    expect(() => validarUrlRemota("ftp://servidor")).toThrow(/http/);
    expect(() => validarUrlRemota("http://usuario:senha@servidor:3010")).toThrow(/usuário e senha/);
    expect(() => validarUrlRemota("não é url")).toThrow(/inválido/);
  });
});

describe("resolverAlvo", () => {
  it("modo remoto salvo vence o .env e nunca inicia preview local", () => {
    const a = resolverAlvo({ modo: "remoto", url: "http://servidor:3010" }, { HYPERFRAMES_MODO: "local" });
    expect(a).toMatchObject({ modo: "remoto", url: "http://servidor:3010", port: 3010, modoVps: true, urls: ["http://servidor:3010"] });
  });

  it("modo local salvo ignora HYPERFRAMES_MODO=vps do .env", () => {
    const a = resolverAlvo({ modo: "local" }, { HYPERFRAMES_MODO: "vps", HYPERFRAMES_URL: "http://127.0.0.1:3010" });
    expect(a).toMatchObject({ modo: "local", url: null, modoVps: false, port: 3010 });
  });

  it("sem nada salvo, segue o .env como antes", () => {
    expect(resolverAlvo({}, {})).toMatchObject({ modo: "local", modoVps: false, port: 3010, urls: ["http://127.0.0.1:3010"] });
    expect(resolverAlvo({}, { HYPERFRAMES_MODO: "vps", HYPERFRAMES_URL: "http://127.0.0.1:3011" })).toMatchObject({
      modo: "remoto",
      modoVps: true,
      port: 3011,
    });
  });

  it("endereço salvo inválido cai no padrão em vez de quebrar", () => {
    expect(resolverAlvo({ modo: "remoto", url: "lixo" }, {})).toMatchObject({ modo: "local", modoVps: false });
  });
});

describe("testarHyperframes", () => {
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

  it("reconhece um preview do HyperFrames e devolve versão e projeto", async () => {
    const f = vi.fn().mockResolvedValue(resposta({ isHyperframes: true, version: "0.8.185", projectName: "nike" }));
    const r = await testarHyperframes("http://127.0.0.1:3010", f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, versao: "0.8.185", projeto: "nike" });
    expect(String(f.mock.calls[0]![0])).toBe("http://127.0.0.1:3010/__hyperframes_config");
  });

  it("explica quando não é o HyperFrames, quando dá erro e quando não conecta", async () => {
    const naoE = vi.fn().mockResolvedValue(resposta({ ola: 1 }));
    expect((await testarHyperframes("http://x:1", naoE as unknown as typeof fetch)).mensagem).toMatch(/não parece/);
    const erro = vi.fn().mockResolvedValue(resposta({}, 502));
    expect((await testarHyperframes("http://x:1", erro as unknown as typeof fetch)).mensagem).toMatch(/502/);
    const queda = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect((await testarHyperframes("http://x:1", queda as unknown as typeof fetch)).mensagem).toMatch(/túnel/);
  });

  it("endereço inválido não faz requisição", async () => {
    const f = vi.fn();
    const r = await testarHyperframes("ftp://x", f as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

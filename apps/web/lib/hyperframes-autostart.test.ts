import net from "node:net";
import { describe, expect, it } from "vitest";
import { deveIniciarPreviewLocal, portaAceitaConexao, timeoutConfigMs, urlsCandidatas } from "./hyperframes-autostart";

const base = { rodando: false, portaAberta: false, autoStart: true, modoVps: false, temProjetos: true };

describe("deveIniciarPreviewLocal", () => {
  it("sobe o preview só quando nada responde e a porta está fechada", () => {
    expect(deveIniciarPreviewLocal(base)).toBe(true);
  });

  it("NÃO reinicia um preview que está vivo mas lento (porta aceita conexão)", () => {
    expect(deveIniciarPreviewLocal({ ...base, portaAberta: true })).toBe(false);
  });

  it("não sobe se já está rodando, se autoStart=false, no modo vps ou sem projetos", () => {
    expect(deveIniciarPreviewLocal({ ...base, rodando: true })).toBe(false);
    expect(deveIniciarPreviewLocal({ ...base, autoStart: false })).toBe(false);
    expect(deveIniciarPreviewLocal({ ...base, modoVps: true })).toBe(false);
    expect(deveIniciarPreviewLocal({ ...base, temProjetos: false })).toBe(false);
  });
});

describe("portaAceitaConexao", () => {
  it("true para uma porta com servidor e false para uma fechada", async () => {
    const servidor = net.createServer();
    await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
    const { port } = servidor.address() as net.AddressInfo;
    expect(await portaAceitaConexao(port, ["127.0.0.1"])).toBe(true);
    await new Promise<void>((r) => servidor.close(() => r()));
    expect(await portaAceitaConexao(port, ["127.0.0.1"])).toBe(false);
  });
});

describe("urlsCandidatas", () => {
  it("não repete localhost e 127.0.0.1 (mesmo servidor)", () => {
    expect(urlsCandidatas("http://localhost:3010", 3010)).toEqual(["http://localhost:3010"]);
    expect(urlsCandidatas(undefined, 3010)).toEqual(["http://127.0.0.1:3010"]);
  });

  it("mantém um endereço realmente diferente (ex.: o da VPS por IPv6)", () => {
    expect(urlsCandidatas("http://[::1]:3010", 3010)).toEqual(["http://[::1]:3010", "http://127.0.0.1:3010"]);
  });
});

describe("timeoutConfigMs", () => {
  it("padrão de 4 s, configurável e com limites", () => {
    expect(timeoutConfigMs({})).toBe(4000);
    expect(timeoutConfigMs({ HYPERFRAMES_CONFIG_TIMEOUT_MS: "8000" })).toBe(8000);
    expect(timeoutConfigMs({ HYPERFRAMES_CONFIG_TIMEOUT_MS: "10" })).toBe(4000);
    expect(timeoutConfigMs({ HYPERFRAMES_CONFIG_TIMEOUT_MS: "999999" })).toBe(30000);
  });
});

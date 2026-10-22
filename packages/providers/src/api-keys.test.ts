import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@vincere-studio/db";
import {
  carregarChavesNoAmbiente,
  mascarar,
  nomePermitido,
  removerChave,
  salvarChave,
  statusDasChaves,
  testarChaveGemini,
  validarValor,
} from "./api-keys";

describe("mascarar", () => {
  it("mostra só o final e nunca a chave inteira", () => {
    const chave = "FALSA-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    const m = mascarar(chave);
    expect(m.endsWith("3456")).toBe(true);
    expect(m).not.toContain("FALSA-");
    expect(m.length).toBeLessThan(chave.length);
  });

  it("esconde tudo em valores curtos", () => {
    expect(mascarar("abc")).toBe("••••••••");
  });
});

describe("validarValor", () => {
  it("só aceita nomes da lista (impede gravar variáveis arbitrárias)", () => {
    expect(nomePermitido("GEMINI_API_KEY")).toBe(true);
    expect(nomePermitido("DATABASE_URL")).toBe(false);
    expect(nomePermitido("PATH")).toBe(false);
    expect(() => validarValor("DATABASE_URL", "file:x.db")).toThrow(/desconhecida/);
  });

  it("recusa vazio, espaço dentro da chave e quebra de linha", () => {
    expect(() => validarValor("GEMINI_API_KEY", "   ")).toThrow(/Cole/);
    expect(() => validarValor("GEMINI_API_KEY", "abc def")).toThrow(/espaços/);
    expect(() => validarValor("GEMINI_API_KEY", "abc\ndef")).toThrow(/quebra/);
  });

  it("apara espaços nas pontas e recusa valor gigante", () => {
    expect(validarValor("GEMINI_API_KEY", "  abc123  ")).toBe("abc123");
    expect(() => validarValor("GEMINI_API_KEY", "x".repeat(513))).toThrow(/longo/);
  });

  it("não repete o valor recebido na mensagem de erro", () => {
    try {
      validarValor("GEMINI_API_KEY", "SEGREDO COM ESPACO");
    } catch (e) {
      expect(String(e)).not.toContain("SEGREDO");
    }
  });

  it("valida provedor de texto e endereço", () => {
    expect(validarValor("TEXT_PROVIDER", "openai_compat")).toBe("OPENAI_COMPAT");
    expect(() => validarValor("TEXT_PROVIDER", "CHATGPT")).toThrow(/inválido/);
    expect(() => validarValor("OPENAI_COMPAT_BASE_URL", "ftp://x")).toThrow(/http/);
    expect(validarValor("OPENAI_COMPAT_BASE_URL", "https://api.exemplo.com/v1")).toBe("https://api.exemplo.com/v1");
  });
});

// Roda contra o SQLite de teste (DATABASE_URL do .env.test), como o teste de orçamento.
describe("salvar, carregar e remover (banco de teste)", () => {
  const limpar = () => prisma.setting.deleteMany({ where: { key: { startsWith: "apikey:" } } });
  beforeEach(limpar);
  afterEach(limpar);

  it("a chave salva passa a valer no ambiente e vence a do .env", async () => {
    const env: Record<string, string | undefined> = { GEMINI_API_KEY: "da-env-1234" };
    await salvarChave("GEMINI_API_KEY", "da-tela-9999", env);
    expect(env.GEMINI_API_KEY).toBe("da-tela-9999");
  });

  it("remover volta ao valor original do .env", async () => {
    const env: Record<string, string | undefined> = { GEMINI_API_KEY: "da-env-1234" };
    await salvarChave("GEMINI_API_KEY", "da-tela-9999", env);
    await removerChave("GEMINI_API_KEY", env);
    expect(env.GEMINI_API_KEY).toBe("da-env-1234");
  });

  it("remover sem .env deixa a variável ausente", async () => {
    const env: Record<string, string | undefined> = {};
    await salvarChave("PEXELS_API_KEY", "abc123456789", env);
    await removerChave("PEXELS_API_KEY", env);
    expect("PEXELS_API_KEY" in env).toBe(false);
  });

  it("outro processo (worker) carrega o que foi salvo e solta o que foi removido", async () => {
    const web: Record<string, string | undefined> = {};
    await salvarChave("PIXABAY_API_KEY", "pixabay-1234567", web);

    const worker: Record<string, string | undefined> = { PIXABAY_API_KEY: "antiga-env" };
    const carregadas = await carregarChavesNoAmbiente(worker);
    expect(carregadas).toContain("PIXABAY_API_KEY");
    expect(worker.PIXABAY_API_KEY).toBe("pixabay-1234567");

    await removerChave("PIXABAY_API_KEY", web);
    await carregarChavesNoAmbiente(worker);
    expect(worker.PIXABAY_API_KEY).toBe("antiga-env");
  });

  it("o status nunca devolve o segredo inteiro e indica a origem", async () => {
    const env: Record<string, string | undefined> = { PEXELS_API_KEY: "pexels-do-env-0000" };
    await salvarChave("GEMINI_API_KEY", "FALSA-ABCDEFGHIJKLMNOP1234", env);
    const status = await statusDasChaves(env);
    const gemini = status.find((s) => s.name === "GEMINI_API_KEY")!;
    const pexels = status.find((s) => s.name === "PEXELS_API_KEY")!;
    const pixabay = status.find((s) => s.name === "PIXABAY_API_KEY")!;
    expect(gemini).toMatchObject({ configurada: true, origem: "app" });
    expect(gemini.exibicao).not.toContain("FALSA-");
    expect(pexels).toMatchObject({ configurada: true, origem: "env" });
    expect(pixabay).toMatchObject({ configurada: false, origem: null, exibicao: "" });
  });
});

describe("testarChaveGemini", () => {
  it("manda a chave no cabeçalho (não na URL) e interpreta as respostas", async () => {
    const ok = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect((await testarChaveGemini("minha-chave", ok as unknown as typeof fetch)).ok).toBe(true);
    const [url, init] = ok.mock.calls[0]!;
    expect(String(url)).not.toContain("minha-chave");
    expect((init as RequestInit).headers).toMatchObject({ "x-goog-api-key": "minha-chave" });

    const recusa = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    const r = await testarChaveGemini("x", recusa as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/recusou/);

    const queda = vi.fn().mockRejectedValue(new Error("sem rede"));
    expect((await testarChaveGemini("x", queda as unknown as typeof fetch)).mensagem).toMatch(/sem rede/);
  });
});

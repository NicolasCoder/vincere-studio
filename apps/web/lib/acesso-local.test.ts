import { describe, expect, it } from "vitest";
import { ORIGEM_HEADER, requisicaoLocal } from "./acesso-local";

const h = (obj: Record<string, string>) => new Headers(obj);

describe("requisicaoLocal", () => {
  it("aceita loopback sem marca de rede", () => {
    expect(requisicaoLocal(h({ host: "localhost:3210" }))).toBe(true);
    expect(requisicaoLocal(h({ host: "127.0.0.1:3210" }))).toBe(true);
    expect(requisicaoLocal(h({ host: "[::1]:3210" }))).toBe(true);
    expect(requisicaoLocal(h({ host: "LOCALHOST" }))).toBe(true);
  });

  it("recusa host de rede", () => {
    expect(requisicaoLocal(h({ host: "192.168.15.11:3210" }))).toBe(false);
    expect(requisicaoLocal(h({ host: "vincere.exemplo.com" }))).toBe(false);
  });

  it("recusa quando o host some", () => {
    expect(requisicaoLocal(h({}))).toBe(false);
  });

  it("recusa Host: localhost vindo pela rede (marcado pelo lan-proxy)", () => {
    expect(requisicaoLocal(h({ host: "localhost:3210", [ORIGEM_HEADER]: "rede" }))).toBe(false);
  });

  it("recusa a marca mesmo com valor vazio ou diferente", () => {
    expect(requisicaoLocal(h({ host: "localhost", [ORIGEM_HEADER]: "" }))).toBe(false);
    expect(requisicaoLocal(h({ host: "localhost", [ORIGEM_HEADER]: "local" }))).toBe(false);
  });
});

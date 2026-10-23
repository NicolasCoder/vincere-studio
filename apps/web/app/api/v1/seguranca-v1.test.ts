import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco e serviços simulados: aqui só se verifica o que as rotas /api/v1 decidem antes de tocar neles
// (autenticação, trava de publicação, confirmação de exclusão, validação de entrada).
const prismaFalso = vi.hoisted(() => ({
  project: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  idea: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}));
vi.mock("@vincere-studio/db", () => ({ prisma: prismaFalso }));

const servicos = vi.hoisted(() => ({
  computeProjectAgentState: vi.fn(),
  enqueueProjectJob: vi.fn(),
  exportProjectToHyperFrames: vi.fn(),
}));
vi.mock("@/lib/agent-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent-api")>()),
  ...servicos,
}));

import { checkAgentAuth } from "@/lib/agent-api";
import { POST as acao } from "./projects/[id]/actions/route";
import { DELETE as excluir } from "./projects/[id]/route";

const ctx = { params: Promise.resolve({ id: "p1" }) };

function req(url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new Request(`http://servidor${url}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const estado = (renderApproved: boolean) => ({ etapasConcluidas: { renderApproved, ideation: true } });
const PUBLICAR = { action: "publicar_youtube" };
const REDE = { host: "192.168.15.11:3210" };
const LOCAL = { host: "localhost:3210" };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VINCERE_AGENT_TOKEN;
  delete process.env.ADMIN_TOKEN;
  delete process.env.LAN_PIN;
});

describe("checkAgentAuth", () => {
  it("libera a própria máquina", () => {
    expect(checkAgentAuth(req("/api/v1/capabilities", { headers: LOCAL }))).toBeNull();
  });

  it("bloqueia a rede sem token", async () => {
    const r = checkAgentAuth(req("/api/v1/capabilities", { headers: REDE }));
    expect(r?.status).toBe(401);
    expect((await r!.json()).error.codigo).toBe("NAO_AUTORIZADO");
  });

  it("bloqueia Host: localhost forjado quando a requisição veio pela rede (marca do lan-proxy)", () => {
    const r = checkAgentAuth(req("/x", { headers: { ...LOCAL, "x-vincere-origem": "rede" } }));
    expect(r?.status).toBe(401);
  });

  it("aceita token válido pela rede (Bearer ou x-vincere-token) e recusa o errado", () => {
    process.env.VINCERE_AGENT_TOKEN = "token-de-agente-123456";
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, authorization: "Bearer token-de-agente-123456" } }))).toBeNull();
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, "x-vincere-token": "token-de-agente-123456" } }))).toBeNull();
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, authorization: "Bearer token-de-agente-12345X" } }))?.status).toBe(401);
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, authorization: "Bearer curto" } }))?.status).toBe(401);
  });

  it("não aceita token vazio", () => {
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, authorization: "Bearer " } }))?.status).toBe(401);
  });

  it("ADMIN_TOKEN e LAN_PIN também valem pela rede", () => {
    process.env.ADMIN_TOKEN = "admin-token-123456";
    process.env.LAN_PIN = "48271936";
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, authorization: "Bearer admin-token-123456" } }))).toBeNull();
    expect(checkAgentAuth(req("/x", { headers: { ...REDE, authorization: "Bearer 48271936" } }))).toBeNull();
  });
});

describe("POST /api/v1/projects/[id]/actions", () => {
  it("pela rede sem token: 401 e nada é consultado nem enfileirado", async () => {
    const r = await acao(req("/api/v1/projects/p1/actions", { method: "POST", headers: REDE, body: PUBLICAR }), ctx);
    expect(r.status).toBe(401);
    expect(servicos.computeProjectAgentState).not.toHaveBeenCalled();
    expect(servicos.enqueueProjectJob).not.toHaveBeenCalled();
  });

  it("projeto inexistente: 404", async () => {
    servicos.computeProjectAgentState.mockResolvedValue(null);
    const r = await acao(req("/x", { method: "POST", headers: LOCAL, body: PUBLICAR }), ctx);
    expect(r.status).toBe(404);
  });

  it("ação desconhecida ou parâmetros inválidos: 400", async () => {
    servicos.computeProjectAgentState.mockResolvedValue(estado(true));
    expect((await acao(req("/x", { method: "POST", headers: LOCAL, body: { action: "apagar_tudo" } }), ctx)).status).toBe(400);
    expect((await acao(req("/x", { method: "POST", headers: LOCAL, body: { action: "publicar_youtube", privacyStatus: "todos" } }), ctx)).status).toBe(400);
    expect(servicos.enqueueProjectJob).not.toHaveBeenCalled();
  });

  it("publicar_youtube sem render aprovado: 403 GATE_APROVACAO_OBRIGATORIO e não enfileira", async () => {
    servicos.computeProjectAgentState.mockResolvedValue(estado(false));
    const r = await acao(req("/x", { method: "POST", headers: LOCAL, body: PUBLICAR }), ctx);
    expect(r.status).toBe(403);
    expect((await r.json()).error.codigo).toBe("GATE_APROVACAO_OBRIGATORIO");
    expect(servicos.enqueueProjectJob).not.toHaveBeenCalled();
  });

  it("a trava vale também com token de agente e com force:true", async () => {
    process.env.VINCERE_AGENT_TOKEN = "token-de-agente-123456";
    servicos.computeProjectAgentState.mockResolvedValue(estado(false));
    const r = await acao(
      req("/x", { method: "POST", headers: { ...REDE, authorization: "Bearer token-de-agente-123456" }, body: { ...PUBLICAR, force: true } }),
      ctx,
    );
    expect(r.status).toBe(403);
    expect(servicos.enqueueProjectJob).not.toHaveBeenCalled();
  });

  it("publicar_youtube com render aprovado: enfileira o job (privado por padrão)", async () => {
    servicos.computeProjectAgentState.mockResolvedValue(estado(true));
    servicos.enqueueProjectJob.mockResolvedValue({ job: { id: "job-1" }, reused: false });
    const r = await acao(req("/x", { method: "POST", headers: LOCAL, body: PUBLICAR }), ctx);
    expect(r.status).toBe(200);
    expect(servicos.enqueueProjectJob).toHaveBeenCalledWith("p1", "PUBLISH_YOUTUBE", { privacyStatus: "private" }, { force: false });
  });
});

describe("DELETE /api/v1/projects/[id]", () => {
  it("pela rede sem token: 401 e não toca no banco", async () => {
    const r = await excluir(req("/x?confirm=true", { method: "DELETE", headers: REDE }), ctx);
    expect(r.status).toBe(401);
    expect(prismaFalso.project.delete).not.toHaveBeenCalled();
  });

  it("sem confirmação: 400 e não exclui", async () => {
    const r = await excluir(req("/x", { method: "DELETE", headers: LOCAL }), ctx);
    expect(r.status).toBe(400);
    expect((await r.json()).error.codigo).toBe("CONFIRMACAO_OBRIGATORIA");
    expect(prismaFalso.project.delete).not.toHaveBeenCalled();
  });

  it("projeto inexistente: 404", async () => {
    prismaFalso.project.findUnique.mockResolvedValue(null);
    const r = await excluir(req("/x?confirm=true", { method: "DELETE", headers: LOCAL }), ctx);
    expect(r.status).toBe(404);
    expect(prismaFalso.project.delete).not.toHaveBeenCalled();
  });

  it("com confirmação e projeto existente: exclui", async () => {
    prismaFalso.project.findUnique.mockResolvedValue({ id: "p1", title: "Teste" });
    prismaFalso.project.delete.mockResolvedValue({});
    const r = await excluir(req("/x?confirm=true", { method: "DELETE", headers: LOCAL }), ctx);
    expect(r.status).toBe(200);
    expect(prismaFalso.project.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});

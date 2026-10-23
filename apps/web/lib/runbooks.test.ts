import { describe, expect, it } from "vitest";
import { RUNBOOKS, evaluateRunbookAgainstState, getRunbookById } from "./runbooks";
import type { ProjectAgentState } from "./agent-api";

function makeMockState(overrides: Partial<ProjectAgentState["etapasConcluidas"]> = {}): ProjectAgentState {
  return {
    projectId: "proj_test_123",
    title: "O Mistério do Ponto Nemo",
    format: "SHORT_9_16",
    niche: "curiosidades",
    stage: "MEDIA",
    status: "IN_PROGRESS",
    etapasConcluidas: {
      ideation: true,
      script: true,
      voice: false,
      captions: false,
      scenes: false,
      broll: false,
      editPlan: false,
      render: false,
      renderApproved: false,
      hyperframesExported: false,
      published: false,
      ...overrides,
    },
    metricas: {
      totalIdeias: 2,
      ideiaSelecionadaId: "idea_1",
      ideiaSelecionadaTitulo: "O Mistério do Ponto Nemo",
      scriptId: "scr_1",
      scriptVersion: 1,
      totalAtos: 3,
      totalPalavrasRoteiro: 95,
      duracaoEstimadaSeg: 42,
      atosComVoz: overrides.voice ? 3 : 0,
      duracaoVozTotalMs: overrides.voice ? 41500 : 0,
      atosComLegendaAlinhada: overrides.captions ? 3 : 0,
      totalCenas: overrides.scenes ? 4 : 0,
      cenasComMidiaPronta: overrides.broll ? 4 : 0,
      cenasComArquivoExistente: overrides.broll ? 4 : 0,
      insercoesPlanoEdicao: overrides.editPlan ? 3 : 0,
      totalRenders: overrides.render ? 1 : 0,
      ultimoRenderPath: overrides.render ? "projects/proj_test_123/renders/master.mp4" : null,
      ultimoRenderRevisao: overrides.renderApproved ? "APPROVED" : "PENDING",
      hyperframesSlug: "o-misterio-do-ponto-nemo",
      hyperframesDir: "/tmp/Videos-HF/o-misterio-do-ponto-nemo",
      jobsAtivos: [],
    },
    pendencias: [],
    proximasAcoes: [],
  };
}

describe("Runbooks & Verificadores do Agente", () => {
  it("expõe os 6 runbooks canônicos com HyperFrames como motor visual principal", () => {
    expect(RUNBOOKS.length).toBeGreaterThanOrEqual(6);
    const shortRb = getRunbookById("curiosidades-short-9x16");
    expect(shortRb).toBeDefined();
    expect(shortRb?.passos.length).toBe(6);
  });

  it("identifica exatamente o próximo passo pendente quando ideia e roteiro já estão prontos", () => {
    const rb = getRunbookById("curiosidades-short-9x16")!;
    const state = makeMockState({ ideation: true, script: true, voice: false });
    const evalRes = evaluateRunbookAgainstState(rb, state);

    expect(evalRes.concluido).toBe(false);
    expect(evalRes.passosConcluidos).toBe(2);
    expect(evalRes.proximoPasso?.id).toBe("voz");
    expect(evalRes.proximoPasso?.comoExecutar.endpoint).toBe("/api/v1/projects/proj_test_123/actions");
  });

  it("marca o runbook como 100% concluído quando todas as etapas e a exportação HyperFrames passam", () => {
    const rb = getRunbookById("curiosidades-short-9x16")!;
    const state = makeMockState({
      ideation: true,
      script: true,
      voice: true,
      captions: true,
      scenes: true,
      hyperframesExported: true,
    });
    const evalRes = evaluateRunbookAgainstState(rb, state);

    expect(evalRes.concluido).toBe(true);
    expect(evalRes.progressoPercent).toBe(100);
    expect(evalRes.proximoPasso).toBeNull();
  });
});

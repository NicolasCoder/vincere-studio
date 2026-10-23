import { buildHermesInvocation, type AgentInvocation, type HermesConfig } from "./agent-adapters";

// Comandos para CONVERSAR com a IA da pessoa (o "cérebro" do Vince). Diferente de editar arquivos, aqui a IA só
// responde: cada agente roda em modo somente leitura, numa pasta temporária vazia (sem acesso aos projetos), e o
// prompt vai por entrada padrão sempre que o agente aceita (evita limite de tamanho da linha de comando).

export type AgenteChat = "claude" | "agy" | "codex" | "hermes";

/** Limite do prompt passado como argumento (a linha de comando do Windows aceita ~32 mil caracteres). */
export const LIMITE_PROMPT_ARGUMENTO = 24_000;

export interface OpcoesChat {
  prompt: string;
  /** Caminho do executável (claude, agy, codex). */
  bin?: string;
  /** Pasta onde o agente roda: uma pasta temporária vazia. */
  cwd: string;
  hermes?: HermesConfig | null;
  /** Codex grava a resposta final aqui; a saída padrão só traz o andamento. */
  arquivoSaida?: string;
}

export function montarComandoChat(agente: AgenteChat, o: OpcoesChat): AgentInvocation {
  if (agente === "hermes") {
    if (!o.hermes) throw new Error("Hermes não está configurado (HERMES_SSH_HOST ou HERMES_BIN).");
    return buildHermesInvocation(o.hermes, { prompt: o.prompt, cwd: o.cwd });
  }
  if (!o.bin) throw new Error("Executável não encontrado.");

  if (agente === "claude") {
    // permission-mode plan: só planeja e responde, não executa ferramentas que alterem arquivos.
    return { command: o.bin, args: ["-p", "--permission-mode", "plan"], cwd: o.cwd, stdin: o.prompt, label: "Claude Code" };
  }
  if (agente === "codex") {
    if (!o.arquivoSaida) throw new Error("Codex precisa de um arquivo para a resposta final.");
    return {
      command: o.bin,
      args: ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-rules", "-C", o.cwd, "-o", o.arquivoSaida, "-"],
      cwd: o.cwd,
      stdin: o.prompt,
      label: "Codex",
      arquivoSaida: o.arquivoSaida,
    };
  }
  // agy: modo plan (somente planejar/responder); o prompt precisa ir como argumento.
  if (o.prompt.length > LIMITE_PROMPT_ARGUMENTO) {
    throw new Error("A conversa ficou longa demais para o Antigravity. Limpe a conversa do Vince e tente de novo.");
  }
  return { command: o.bin, args: ["--mode", "plan", "-p", o.prompt], cwd: o.cwd, label: "Antigravity (agy)" };
}

export interface RespostaDoVince {
  resposta: string;
  irPara?: string | null;
  acaoClaude?: string | null;
  lembrar?: string | null;
  acaoStudio?: {
    action: string;
    label: string;
    payload?: Record<string, unknown>;
  } | null;
  skillSugerida?: {
    nome: string;
    comando: string;
    motivo: string;
  } | null;
}

/**
 * O Vince pede JSON, mas um agente pode responder em texto corrido ou com cercas de markdown. Aceita os dois:
 * se não houver JSON utilizável, o texto inteiro vira a resposta (nunca perde o que a IA disse).
 */
export function interpretarRespostaDoVince(bruto: string, extrairJson: (t: string) => { ok: true; value: unknown } | { ok: false }): RespostaDoVince {
  const texto = bruto.trim();
  const j = extrairJson(texto);
  if (j.ok && j.value && typeof j.value === "object") {
    const v = j.value as Record<string, unknown>;
    if (typeof v.resposta === "string" && v.resposta.trim()) {
      const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
      let acaoStudio: RespostaDoVince["acaoStudio"] = null;
      if (v.acaoStudio && typeof v.acaoStudio === "object") {
        const asObj = v.acaoStudio as Record<string, unknown>;
        if (typeof asObj.action === "string") {
          acaoStudio = {
            action: asObj.action,
            label: typeof asObj.label === "string" ? asObj.label : asObj.action,
            payload: asObj.payload && typeof asObj.payload === "object" ? (asObj.payload as Record<string, unknown>) : undefined,
          };
        }
      }
      let skillSugerida: RespostaDoVince["skillSugerida"] = null;
      if (v.skillSugerida && typeof v.skillSugerida === "object") {
        const skObj = v.skillSugerida as Record<string, unknown>;
        if (typeof skObj.comando === "string" || typeof skObj.nome === "string") {
          skillSugerida = {
            nome: typeof skObj.nome === "string" ? skObj.nome : String(skObj.comando),
            comando: typeof skObj.comando === "string" ? skObj.comando : `/${skObj.nome}`,
            motivo: typeof skObj.motivo === "string" ? skObj.motivo : "",
          };
        }
      }
      return {
        resposta: v.resposta.trim(),
        irPara: s(v.irPara),
        acaoClaude: s(v.acaoClaude),
        lembrar: s(v.lembrar),
        acaoStudio,
        skillSugerida,
      };
    }
  }
  return {
    resposta: texto || "(a IA não devolveu texto)",
    irPara: null,
    acaoClaude: null,
    lembrar: null,
    acaoStudio: null,
    skillSugerida: null,
  };
}

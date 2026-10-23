import { buildHermesInvocation, type AgentInvocation, type HermesConfig } from "./agent-adapters";

// Comandos para CONVERSAR com a IA da pessoa (o "cérebro" do Vince). Diferente de editar arquivos, aqui a IA só
// responde: cada agente roda em modo somente leitura, numa pasta temporária vazia (sem acesso aos projetos), e o
// prompt vai por entrada padrão sempre que o agente aceita (evita limite de tamanho da linha de comando).

export type AgenteChat = "claude" | "agy" | "codex" | "hermes";
export type EsforcoModelo = "low" | "medium" | "high" | "xhigh" | "max";

export const NIVEIS_ESFORCO: readonly EsforcoModelo[] = ["low", "medium", "high", "xhigh", "max"] as const;

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
  /** Modelo escolhido pela pessoa (ex.: gemini-4-argon-high, claude-sonnet-5-5-medium, sonnet, o4-mini). */
  modelo?: string;
  /** Força / nível de raciocínio do modelo (low, medium, high, xhigh, max). */
  esforco?: EsforcoModelo;
  /** ID da conversa/sessão para manter o mesmo chat no agente (agy --conversation / claude --resume). */
  conversaId?: string;
  /** Quando verdadeiro, pede saída estruturada em JSON ao CLI para recuperar conversation_id e consumo de tokens. */
  formatoJson?: boolean;
}

export function montarComandoChat(agente: AgenteChat, o: OpcoesChat): AgentInvocation {
  if (agente === "hermes") {
    if (!o.hermes) throw new Error("Hermes não está configurado (HERMES_SSH_HOST ou HERMES_BIN).");
    return buildHermesInvocation(o.hermes, { prompt: o.prompt, cwd: o.cwd });
  }
  if (!o.bin) throw new Error("Executável não encontrado.");

  if (agente === "claude") {
    // permission-mode plan: só planeja e responde, não executa ferramentas que alterem arquivos.
    const args = ["-p", "--permission-mode", "plan"];
    if (o.formatoJson) args.push("--output-format", "json");
    if (o.modelo) args.push("--model", o.modelo);
    if (o.esforco) args.push("--effort", o.esforco === "xhigh" ? "high" : o.esforco);
    if (o.conversaId) args.push("--resume", o.conversaId);
    return { command: o.bin, args, cwd: o.cwd, stdin: o.prompt, label: "Claude Code" };
  }
  if (agente === "codex") {
    if (!o.arquivoSaida) throw new Error("Codex precisa de um arquivo para a resposta final.");
    const args = ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-rules"];
    if (o.modelo) args.push("-m", o.modelo);
    if (o.esforco) {
      const nivelCodex = o.esforco === "xhigh" || o.esforco === "max" ? "high" : o.esforco;
      args.push("-c", `model_reasoning_effort="${nivelCodex}"`);
    }
    args.push("-C", o.cwd, "-o", o.arquivoSaida, "-");
    return {
      command: o.bin,
      args,
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
  const args = ["--mode", "plan"];
  if (o.formatoJson) args.push("--output-format", "json");
  if (o.modelo) args.push("--model", o.modelo);
  if (o.esforco) args.push("--effort", o.esforco);
  if (o.conversaId) args.push("--conversation", o.conversaId);
  args.push("-p", o.prompt);
  return { command: o.bin, args, cwd: o.cwd, label: "Antigravity (agy)" };
}

export interface UsoCliExtraido {
  tokensIn: number;
  tokensOut: number;
  tokensPensamento: number;
  tokensCache: number;
  totalTokens: number;
  costUsd?: number;
}

export interface EnvelopeCliExtraido {
  texto: string;
  conversaId?: string;
  uso?: UsoCliExtraido;
}

/**
 * Extrai resposta, ID da conversa e uso de tokens quando o CLI (agy ou claude) roda com --output-format json.
 * Se a saída for texto simples, devolve o texto intacto.
 */
export function extrairEnvelopeCliJson(bruto: string): EnvelopeCliExtraido {
  const limpo = bruto.trim();
  if (!limpo) return { texto: "" };
  const linhas = limpo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidatos = [limpo, ...linhas.slice().reverse()];
  for (const c of candidatos) {
    if (!c.startsWith("{") || !c.endsWith("}")) continue;
    try {
      const obj = JSON.parse(c) as Record<string, unknown>;
      // Formato do Antigravity (agy --output-format json)
      if (typeof obj.response === "string") {
        const u = (obj.usage && typeof obj.usage === "object" ? obj.usage : null) as Record<string, unknown> | null;
        const tokensIn = Number(u?.input_tokens ?? 0) || 0;
        const outBase = Number(u?.output_tokens ?? 0) || 0;
        const tokensPensamento = Number(u?.thinking_tokens ?? 0) || 0;
        const tokensCache = Number(u?.cache_read_tokens ?? 0) || 0;
        const tokensOut = outBase + tokensPensamento;
        const totalTokens = Number(u?.total_tokens ?? tokensIn + tokensOut) || tokensIn + tokensOut;
        return {
          texto: obj.response.trim(),
          conversaId: typeof obj.conversation_id === "string" && obj.conversation_id.trim() ? obj.conversation_id.trim() : undefined,
          uso: u ? { tokensIn, tokensOut, tokensPensamento, tokensCache, totalTokens } : undefined,
        };
      }
      // Formato do Claude Code (claude --output-format json)
      if (typeof obj.result === "string") {
        const u = (obj.usage && typeof obj.usage === "object" ? obj.usage : null) as Record<string, unknown> | null;
        const inBase = Number(u?.input_tokens ?? 0) || 0;
        const tokensCache = Number(u?.cache_read_input_tokens ?? 0) || 0;
        const tokensIn = inBase + tokensCache;
        const tokensOut = Number(u?.output_tokens ?? 0) || 0;
        const costUsd = typeof obj.total_cost_usd === "number" && Number.isFinite(obj.total_cost_usd) ? obj.total_cost_usd : undefined;
        return {
          texto: obj.result.trim(),
          conversaId: typeof obj.session_id === "string" && obj.session_id.trim() ? obj.session_id.trim() : undefined,
          uso: u ? { tokensIn, tokensOut, tokensPensamento: 0, tokensCache, totalTokens: tokensIn + tokensOut, costUsd } : undefined,
        };
      }
    } catch {
      // Não é um envelope JSON válido; continua tentando ou devolve bruto.
    }
  }
  return { texto: limpo };
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

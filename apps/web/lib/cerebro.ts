import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@vincere-studio/db";
import { OpenAICompatTextProvider, getTextProvider, type UsageInfo } from "@vincere-studio/providers";
import { readHermesConfig, type AgentInvocation } from "./agent-adapters";
import { prepararExecutavel } from "./agente-executavel";
import {
  extrairEnvelopeCliJson,
  montarComandoChat,
  NIVEIS_ESFORCO,
  type AgenteChat,
  type EsforcoModelo,
  type UsoCliExtraido,
} from "./cerebro-comandos";
import { detectLocalAgents } from "./local-agent-runner";
import { pastaTemporaria } from "./pastas";

// O "cérebro" do Vince é a IA que a própria pessoa vinculou: um agente instalado na máquina dela (Claude Code,
// Antigravity, Codex, Hermes) ou uma LLM por chave/endereço (Gemini, compatível com OpenAI, Ollama). A escolha
// fica só nesta instância.

export type CerebroTipo = "agente" | "llm";
export type { EsforcoModelo } from "./cerebro-comandos";

export interface Cerebro {
  tipo: CerebroTipo;
  id: string;
  modelo?: string;
  esforco?: EsforcoModelo;
}

export interface OpcaoCerebro extends Cerebro {
  nome: string;
  disponivel: boolean;
  detalhe: string;
}

const CHAVE = "vince:cerebro";
export const IDS_AGENTE = ["claude", "agy", "codex", "hermes"] as const;
export const IDS_LLM = ["gemini", "openai_compat", "ollama"] as const;
export const NOMES_CEREBRO: Record<string, string> = {
  claude: "Claude Code",
  agy: "Antigravity (agy)",
  codex: "Codex",
  hermes: "Hermes",
  gemini: "Gemini (chave de API)",
  openai_compat: "LLM compatível com OpenAI",
  ollama: "Ollama (modelo local)",
};
const NOMES = NOMES_CEREBRO;

const MODELO_SEGURO_RE = /^[a-zA-Z0-9._:/ ()-]{1,100}$/;

export function validarCerebro(
  tipo: string,
  id: string,
  extra?: { modelo?: unknown; esforco?: unknown },
): Cerebro {
  const ehAgente = tipo === "agente" && (IDS_AGENTE as readonly string[]).includes(id);
  const ehLlm = tipo === "llm" && (IDS_LLM as readonly string[]).includes(id);
  if (!ehAgente && !ehLlm) throw new Error("Opção de IA desconhecida.");

  const base: Cerebro = { tipo: tipo as CerebroTipo, id };
  if (typeof extra?.modelo === "string" && extra.modelo.trim()) {
    const m = extra.modelo.trim();
    if (!MODELO_SEGURO_RE.test(m)) throw new Error("Identificador de modelo inválido.");
    base.modelo = m;
  }
  if (typeof extra?.esforco === "string" && extra.esforco.trim()) {
    const e = extra.esforco.trim() as EsforcoModelo;
    if (!NIVEIS_ESFORCO.includes(e)) throw new Error("Nível de força inválido.");
    base.esforco = e;
  }
  return base;
}

export async function lerCerebro(): Promise<Cerebro | null> {
  try {
    const linha = await prisma.setting.findUnique({ where: { key: CHAVE } });
    if (!linha) return null;
    const j = JSON.parse(linha.value) as { tipo?: string; id?: string; modelo?: unknown; esforco?: unknown };
    return validarCerebro(String(j.tipo), String(j.id), { modelo: j.modelo, esforco: j.esforco });
  } catch {
    return null;
  }
}

export async function salvarCerebro(c: Cerebro): Promise<void> {
  const valido = validarCerebro(c.tipo, c.id, { modelo: c.modelo, esforco: c.esforco });
  const value = JSON.stringify(valido);
  await prisma.setting.upsert({ where: { key: CHAVE }, update: { value }, create: { key: CHAVE, value } });
}

export async function limparCerebro(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: CHAVE } });
}

/** O que existe nesta máquina/instância que pode ser o cérebro do Vince. */
export function detectarOpcoes(env: Record<string, string | undefined> = process.env): OpcaoCerebro[] {
  const d = detectLocalAgents();
  const opc = (tipo: CerebroTipo, id: string, disponivel: boolean, detalhe: string): OpcaoCerebro => ({ tipo, id, nome: NOMES[id] ?? id, disponivel, detalhe });
  return [
    opc("agente", "claude", Boolean(d.claudePath), d.claudePath ?? "Não encontrei o Claude Code (defina CLAUDE_BIN se estiver em outro lugar)"),
    opc("agente", "agy", Boolean(d.agyPath), d.agyPath ?? "Não encontrei o Antigravity (defina AGY_BIN se estiver em outro lugar)"),
    opc("agente", "codex", Boolean(d.codexPath), d.codexPath ?? "Não encontrei o Codex (defina CODEX_BIN se estiver em outro lugar)"),
    opc("agente", "hermes", d.hermes.available, d.hermes.detail),
    opc("llm", "gemini", Boolean(env.GEMINI_API_KEY), env.GEMINI_API_KEY ? "Chave do Gemini configurada" : "Salve a chave em Configurações → Chaves de API"),
    opc(
      "llm",
      "openai_compat",
      Boolean(env.OPENAI_COMPAT_API_KEY || env.OPENAI_COMPAT_BASE_URL),
      env.OPENAI_COMPAT_API_KEY || env.OPENAI_COMPAT_BASE_URL ? "Endereço/chave configurados" : "Informe o endereço e a chave em Configurações → Chaves de API",
    ),
    opc("llm", "ollama", Boolean(env.OLLAMA_BASE_URL || env.TEXT_PROVIDER?.toUpperCase() === "OLLAMA"), env.OLLAMA_BASE_URL || env.TEXT_PROVIDER?.toUpperCase() === "OLLAMA" ? "Ollama configurado" : "Defina OLLAMA_BASE_URL (ex.: http://127.0.0.1:11434)"),
  ];
}

/**
 * Quem responde pelo Vince agora: a IA vinculada; se não houver vínculo mas existir uma LLM já configurada
 * (ex.: chave do Gemini), ela; senão ninguém. Nunca cai em serviço público sem a pessoa pedir
 * (VINCE_RESERVA_PUBLICA=1).
 */
export async function resolverCerebroAtivo(env: Record<string, string | undefined> = process.env): Promise<Cerebro | null> {
  const vinculado = await lerCerebro();
  if (vinculado) return vinculado;
  const llm = detectarOpcoes(env).find((o) => o.tipo === "llm" && o.disponivel);
  if (llm) return { tipo: "llm", id: llm.id };
  if (env.VINCE_RESERVA_PUBLICA === "1") return { tipo: "llm", id: "publico" };
  return null;
}

interface Execucao {
  stdout: string;
  stderr: string;
  codigo: number | null;
}

const LIMITE_SAIDA = 400_000;

/** Executa o comando com prompt por stdin e tempo limite; nunca usa shell. */
export function executarComando(inv: AgentInvocation, timeoutMs: number): Promise<Execucao> {
  return new Promise((resolve, reject) => {
    const filho = spawn(inv.command, inv.args, { cwd: inv.cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      filho.kill();
      reject(new Error(`A IA demorou mais de ${Math.round(timeoutMs / 1000)} s para responder.`));
    }, timeoutMs);
    filho.stdout.on("data", (b: Buffer) => {
      if (stdout.length < LIMITE_SAIDA) stdout += b.toString("utf8");
    });
    filho.stderr.on("data", (b: Buffer) => {
      if (stderr.length < LIMITE_SAIDA) stderr += b.toString("utf8");
    });
    filho.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Não foi possível iniciar ${inv.label}: ${err.message}`));
    });
    filho.on("close", (codigo) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, codigo });
    });
    filho.stdin.on("error", () => {});
    filho.stdin.end(inv.stdin ?? "", "utf8");
  });
}

export interface RespostaBruta {
  texto: string;
  motor: string;
  usage?: UsageInfo;
  conversaId?: string;
  usoDetalhado?: UsoCliExtraido;
}

/** Pasta vazia onde os agentes rodam ao conversar: eles não enxergam os projetos nem o .env. */
async function pastaDeConversa(): Promise<string> {
  const dir = path.join(pastaTemporaria(), "vincere-vince");
  await mkdir(dir, { recursive: true });
  return dir;
}

function nomeProvedorAgente(agente: AgenteChat): string {
  if (agente === "agy") return "AGY";
  if (agente === "claude") return "CLAUDE_CODE";
  if (agente === "codex") return "CODEX";
  return "HERMES";
}

function descreverMotorAtivo(c: Cerebro): string {
  const base = NOMES[c.id] ?? (c.id === "publico" ? "IA pública gratuita" : c.id);
  const partes = [base];
  if (c.modelo) partes.push(c.modelo);
  if (c.esforco) partes.push(`força ${c.esforco}`);
  return partes.join(" · ");
}

export async function perguntarAoCerebro(
  c: Cerebro,
  {
    system,
    prompt,
    conversaId,
    timeoutMs = 150_000,
  }: { system: string; prompt: string; conversaId?: string; timeoutMs?: number },
): Promise<RespostaBruta> {
  if (c.tipo === "llm") {
    const provedor =
      c.id === "publico"
        ? new OpenAICompatTextProvider("https://text.pollinations.ai", "", "openai", "https://text.pollinations.ai/openai")
        : getTextProvider(c.id.toUpperCase());
    const { text, usage } = await provedor.generateText(prompt, {
      system,
      temperature: 0.4,
      maxOutputTokens: 1500,
      ...(c.modelo ? { model: c.modelo } : {}),
    });
    return { texto: text, motor: descreverMotorAtivo(c), usage };
  }

  const agente = c.id as AgenteChat;
  const d = detectLocalAgents();
  const bin = agente === "claude" ? d.claudePath : agente === "agy" ? d.agyPath : agente === "codex" ? d.codexPath : null;
  if (agente !== "hermes" && !bin) throw new Error(`${NOMES[agente]} não foi encontrado nesta máquina. Escolha outra IA ou informe o caminho no .env.`);

  const cwd = await pastaDeConversa();
  const suportaJsonEnvelope = agente === "agy" || agente === "claude";
  const promptCompleto = `${system}\n\n---\n${prompt}`;

  const rodarUmaVez = async (idConversaAtual?: string) => {
    const arquivoSaida = agente === "codex" ? path.join(cwd, `saida-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`) : undefined;
    let inv = montarComandoChat(agente, {
      prompt: promptCompleto,
      bin: bin ?? undefined,
      cwd,
      hermes: agente === "hermes" ? readHermesConfig() : null,
      arquivoSaida,
      modelo: c.modelo,
      esforco: c.esforco,
      conversaId: idConversaAtual,
      formatoJson: suportaJsonEnvelope,
    });

    if (agente !== "hermes") {
      const pronto = prepararExecutavel(inv.command);
      if (!pronto) throw new Error(`Não consegui executar ${NOMES[agente]} (${path.basename(inv.command)}). Informe o caminho do .exe em ${agente.toUpperCase()}_BIN no .env.`);
      inv = { ...inv, command: pronto.command, args: [...pronto.prefixo, ...inv.args] };
    }

    const r = await executarComando(inv, timeoutMs);
    let textoBruto = r.stdout.trim();
    if (arquivoSaida) {
      try {
        textoBruto = (await readFile(arquivoSaida, "utf8")).trim() || textoBruto;
      } catch {
        // sem arquivo: usa a saída padrão
      } finally {
        await rm(arquivoSaida, { force: true }).catch(() => {});
      }
    }
    return { r, textoBruto };
  };

  let tentativa = await rodarUmaVez(conversaId);
  // Se tentamos continuar uma conversa anterior que não existe mais no CLI, cria uma nova conversa automaticamente.
  if (!tentativa.textoBruto && conversaId) {
    tentativa = await rodarUmaVez(undefined);
  }

  const { r, textoBruto } = tentativa;
  if (!textoBruto) {
    const dica = r.stderr.trim().split(/\r?\n/).slice(-2).join(" ").slice(0, 300);
    throw new Error(`${NOMES[agente]} não respondeu${r.codigo ? ` (código ${r.codigo})` : ""}${dica ? `: ${dica}` : ""}.`);
  }

  const envelope = suportaJsonEnvelope ? extrairEnvelopeCliJson(textoBruto) : { texto: textoBruto };
  const textoFinal = envelope.texto || textoBruto;
  const tokensIn = envelope.uso?.tokensIn ?? Math.max(1, Math.ceil(promptCompleto.length / 4));
  const tokensOut = envelope.uso?.tokensOut ?? Math.max(1, Math.ceil(textoFinal.length / 4));
  const usage: UsageInfo = {
    provider: nomeProvedorAgente(agente),
    model: c.modelo ?? agente,
    tokensIn,
    tokensOut,
    costUsd: envelope.uso?.costUsd ?? 0,
  };

  return {
    texto: textoFinal,
    motor: descreverMotorAtivo(c),
    usage,
    conversaId: envelope.conversaId ?? conversaId,
    usoDetalhado: envelope.uso,
  };
}

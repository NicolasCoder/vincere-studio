import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@vincere-studio/db";
import { OpenAICompatTextProvider, getTextProvider, type UsageInfo } from "@vincere-studio/providers";
import { readHermesConfig, type AgentInvocation } from "./agent-adapters";
import { prepararExecutavel } from "./agente-executavel";
import { montarComandoChat, type AgenteChat } from "./cerebro-comandos";
import { detectLocalAgents } from "./local-agent-runner";
import { pastaTemporaria } from "./pastas";

// O "cérebro" do Vince é a IA que a própria pessoa vinculou: um agente instalado na máquina dela (Claude Code,
// Antigravity, Codex, Hermes) ou uma LLM por chave/endereço (Gemini, compatível com OpenAI, Ollama). A escolha
// fica só nesta instância.

export type CerebroTipo = "agente" | "llm";

export interface Cerebro {
  tipo: CerebroTipo;
  id: string;
}

export interface OpcaoCerebro extends Cerebro {
  nome: string;
  disponivel: boolean;
  detalhe: string;
}

const CHAVE = "vince:cerebro";
export const IDS_AGENTE = ["claude", "agy", "codex", "hermes"] as const;
export const IDS_LLM = ["gemini", "openai_compat", "ollama"] as const;
const NOMES: Record<string, string> = {
  claude: "Claude Code",
  agy: "Antigravity (agy)",
  codex: "Codex",
  hermes: "Hermes",
  gemini: "Gemini (chave de API)",
  openai_compat: "LLM compatível com OpenAI",
  ollama: "Ollama (modelo local)",
};

export function validarCerebro(tipo: string, id: string): Cerebro {
  if (tipo === "agente" && (IDS_AGENTE as readonly string[]).includes(id)) return { tipo, id };
  if (tipo === "llm" && (IDS_LLM as readonly string[]).includes(id)) return { tipo, id };
  throw new Error("Opção de IA desconhecida.");
}

export async function lerCerebro(): Promise<Cerebro | null> {
  try {
    const linha = await prisma.setting.findUnique({ where: { key: CHAVE } });
    if (!linha) return null;
    const j = JSON.parse(linha.value) as { tipo?: string; id?: string };
    return validarCerebro(String(j.tipo), String(j.id));
  } catch {
    return null;
  }
}

export async function salvarCerebro(c: Cerebro): Promise<void> {
  const valido = validarCerebro(c.tipo, c.id);
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
}

/** Pasta vazia onde os agentes rodam ao conversar: eles não enxergam os projetos nem o .env. */
async function pastaDeConversa(): Promise<string> {
  const dir = path.join(pastaTemporaria(), "vincere-vince");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function perguntarAoCerebro(
  c: Cerebro,
  { system, prompt, timeoutMs = 150_000 }: { system: string; prompt: string; timeoutMs?: number },
): Promise<RespostaBruta> {
  if (c.tipo === "llm") {
    const provedor =
      c.id === "publico"
        ? new OpenAICompatTextProvider("https://text.pollinations.ai", "", "openai", "https://text.pollinations.ai/openai")
        : getTextProvider(c.id.toUpperCase());
    const { text, usage } = await provedor.generateText(prompt, { system, temperature: 0.4, maxOutputTokens: 1500 });
    return { texto: text, motor: NOMES[c.id] ?? "IA pública gratuita", usage };
  }

  const agente = c.id as AgenteChat;
  const d = detectLocalAgents();
  const bin = agente === "claude" ? d.claudePath : agente === "agy" ? d.agyPath : agente === "codex" ? d.codexPath : null;
  if (agente !== "hermes" && !bin) throw new Error(`${NOMES[agente]} não foi encontrado nesta máquina. Escolha outra IA ou informe o caminho no .env.`);

  const cwd = await pastaDeConversa();
  const arquivoSaida = agente === "codex" ? path.join(cwd, `saida-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`) : undefined;
  let inv = montarComandoChat(agente, {
    prompt: `${system}\n\n---\n${prompt}`,
    bin: bin ?? undefined,
    cwd,
    hermes: agente === "hermes" ? readHermesConfig() : null,
    arquivoSaida,
  });

  if (agente !== "hermes") {
    const pronto = prepararExecutavel(inv.command);
    if (!pronto) throw new Error(`Não consegui executar ${NOMES[agente]} (${path.basename(inv.command)}). Informe o caminho do .exe em ${agente.toUpperCase()}_BIN no .env.`);
    inv = { ...inv, command: pronto.command, args: [...pronto.prefixo, ...inv.args] };
  }

  const r = await executarComando(inv, timeoutMs);
  let texto = r.stdout.trim();
  if (arquivoSaida) {
    try {
      texto = (await readFile(arquivoSaida, "utf8")).trim() || texto;
    } catch {
      // sem arquivo: usa a saída padrão
    } finally {
      await rm(arquivoSaida, { force: true }).catch(() => {});
    }
  }
  if (!texto) {
    const dica = r.stderr.trim().split(/\r?\n/).slice(-2).join(" ").slice(0, 300);
    throw new Error(`${NOMES[agente]} não respondeu${r.codigo ? ` (código ${r.codigo})` : ""}${dica ? `: ${dica}` : ""}.`);
  }
  return { texto, motor: NOMES[agente] };
}

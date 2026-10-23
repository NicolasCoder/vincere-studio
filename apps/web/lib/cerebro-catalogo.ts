import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@vincere-studio/db";
import { getBudgetStatus } from "@vincere-studio/providers";
import { prepararExecutavel } from "./agente-executavel";
import { type EsforcoModelo } from "./cerebro-comandos";
import { detectLocalAgents } from "./local-agent-runner";
import { pastaPessoal } from "./pastas";
import { executarComando, NOMES_CEREBRO, type Cerebro } from "./cerebro";

export type FamiliaModelo = "Gemini" | "Claude" | "GPT" | "Local" | "Outro";

export interface ModeloDisponivel {
  id: string;
  nome: string;
  familia: FamiliaModelo;
  /** Nome base sem o sufixo de força (ex.: "Claude Sonnet 5.5" para "Claude Sonnet 5.5 (High)"). */
  grupoBase: string;
  /** Quando o próprio ID do modelo no CLI já carrega a força (ex.: gemini-4-argon-high). */
  forcaEmbutida?: "low" | "medium" | "high";
}

export interface OpcaoEsforco {
  id: EsforcoModelo;
  rotulo: string;
  curto: string;
  descricao: string;
}

export interface CatalogoCerebro {
  motorId: string;
  motorNome: string;
  suportaConversaContinua: boolean;
  suportaEsforco: boolean;
  esforcosDisponiveis: OpcaoEsforco[];
  modeloPadrao: string | null;
  esforcoPadrao: EsforcoModelo | null;
  familias: FamiliaModelo[];
  modelos: ModeloDisponivel[];
  origemCatalogo: string;
}

export interface TelemetriaLocalMotor {
  contaConectada: string | null;
  planoOuModo: string | null;
  modeloConfiguradoCli: string | null;
  promptsJanela5h: number;
  promptsHoje: number;
  conversasAtivas: number;
  statusCota: "ok" | "atencao" | "limite";
  mensagemCota: string;
}

export interface BlocoConsumoTokens {
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  chamadas: number;
  custoEstimadoUsd: number;
}

export interface ResumoLimitesCerebro {
  motorId: string;
  motorNome: string;
  atualizadoEm: string;
  telemetriaLocal: TelemetriaLocalLocalOuApi;
  consumoMotor: {
    janela5h: BlocoConsumoTokens;
    hoje: BlocoConsumoTokens;
    mes: BlocoConsumoTokens;
  };
  orcamentoVincere: {
    capUsd: number;
    spentUsd: number;
    remainingUsd: number;
    estimatedUsd: number;
  };
}

export type TelemetriaLocalLocalOuApi = TelemetriaLocalMotor;

const TODOS_ESFORCOS: Record<EsforcoModelo, OpcaoEsforco> = {
  low: { id: "low", rotulo: "Leve (Low)", curto: "Low", descricao: "Mais rápido e econômico na cota" },
  medium: { id: "medium", rotulo: "Médio (Medium)", curto: "Med", descricao: "Equilíbrio entre velocidade e raciocínio" },
  high: { id: "high", rotulo: "Alto (High)", curto: "High", descricao: "Raciocínio profundo para tarefas complexas" },
  xhigh: { id: "xhigh", rotulo: "Extra Alto (X-High)", curto: "XHigh", descricao: "Raciocínio estendido reforçado" },
  max: { id: "max", rotulo: "Máximo (Max)", curto: "Max", descricao: "Força máxima de pensamento do modelo" },
};

const MODELOS_PADRAO_AGY: Array<{ id: string; nome: string }> = [
  { id: "gemini-4-argon-high", nome: "Gemini 4 Argon (High)" },
  { id: "gemini-4-argon-medium", nome: "Gemini 4 Argon (Medium)" },
  { id: "gemini-4-argon-low", nome: "Gemini 4 Argon (Low)" },
  { id: "gemini-3.8-flash-high", nome: "Gemini 3.8 Flash (High)" },
  { id: "gemini-3.8-flash-medium", nome: "Gemini 3.8 Flash (Medium)" },
  { id: "gemini-3.8-flash-low", nome: "Gemini 3.8 Flash (Low)" },
  { id: "claude-opus-5-5-high", nome: "Claude Opus 5.5 (High)" },
  { id: "claude-opus-5-5-medium", nome: "Claude Opus 5.5 (Medium)" },
  { id: "claude-opus-5-5-low", nome: "Claude Opus 5.5 (Low)" },
  { id: "claude-sonnet-5-5-high", nome: "Claude Sonnet 5.5 (High)" },
  { id: "claude-sonnet-5-5-medium", nome: "Claude Sonnet 5.5 (Medium)" },
  { id: "claude-sonnet-5-5-low", nome: "Claude Sonnet 5.5 (Low)" },
  { id: "gpt-oss-120b-medium", nome: "GPT-OSS 120B (Medium)" },
];

const MODELOS_PADRAO_CLAUDE: Array<{ id: string; nome: string }> = [
  { id: "sonnet", nome: "Claude Sonnet (Padrão equilibrado)" },
  { id: "opus", nome: "Claude Opus (Máximo raciocínio)" },
  { id: "haiku", nome: "Claude Haiku (Ultra rápido)" },
  { id: "claude-sonnet-4-6", nome: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", nome: "Claude Opus 4.6" },
  { id: "claude-haiku-4-5", nome: "Claude Haiku 4.5" },
];

const MODELOS_PADRAO_CODEX: Array<{ id: string; nome: string }> = [
  { id: "o4-mini", nome: "OpenAI o4-mini (Rápido)" },
  { id: "o3", nome: "OpenAI o3 (Raciocínio profundo)" },
  { id: "gpt-4.1", nome: "GPT-4.1 (Edição e código)" },
  { id: "gpt-4.1-mini", nome: "GPT-4.1 Mini" },
  { id: "codex-mini-latest", nome: "Codex Mini Latest" },
];

const MODELOS_PADRAO_GEMINI: Array<{ id: string; nome: string }> = [
  { id: "gemini-3.8-flash", nome: "Gemini 3.8 Flash" },
  { id: "gemini-3.7-flash", nome: "Gemini 3.7 Flash" },
  { id: "gemini-3.6-flash", nome: "Gemini 3.6 Flash" },
  { id: "gemini-3.1-pro-preview", nome: "Gemini 3.1 Pro Preview" },
  { id: "gemini-2.5-pro", nome: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", nome: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", nome: "Gemini 2.5 Flash Lite" },
];

export function classificarFamiliaModelo(id: string, nome = ""): FamiliaModelo {
  const s = `${id} ${nome}`.toLowerCase();
  if (s.includes("gemini") || s.includes("gemma")) return "Gemini";
  if (s.includes("claude") || s.includes("sonnet") || s.includes("opus") || s.includes("haiku")) return "Claude";
  if (s.includes("gpt") || /\bo[134](-|\b)/.test(s) || s.includes("codex") || s.includes("openai")) return "GPT";
  if (s.includes("llama") || s.includes("qwen") || s.includes("mistral") || s.includes("deepseek") || s.includes("ollama")) return "Local";
  return "Outro";
}

export function criarModeloDisponivel(id: string, nome?: string, familiaForcada?: FamiliaModelo): ModeloDisponivel {
  const rotulo = (nome || id).trim();
  const idLower = id.toLowerCase();
  let forcaEmbutida: "low" | "medium" | "high" | undefined;
  if (idLower.endsWith("-low") || /\(low\)$/i.test(rotulo)) forcaEmbutida = "low";
  else if (idLower.endsWith("-medium") || /\(medium\)$/i.test(rotulo)) forcaEmbutida = "medium";
  else if (idLower.endsWith("-high") || /\(high\)$/i.test(rotulo)) forcaEmbutida = "high";

  const grupoBase = rotulo.replace(/\s*\((low|medium|high)\)\s*$/i, "").trim() || rotulo;
  return {
    id: id.trim(),
    nome: rotulo,
    familia: familiaForcada ?? classificarFamiliaModelo(id, rotulo),
    grupoBase,
    ...(forcaEmbutida ? { forcaEmbutida } : {}),
  };
}

let cacheAgyModels: { expiraEm: number; modelos: ModeloDisponivel[] } | null = null;

async function listarModelosAgy(forcar = false): Promise<{ modelos: ModeloDisponivel[]; origem: string }> {
  if (!forcar && cacheAgyModels && cacheAgyModels.expiraEm > Date.now()) {
    return { modelos: cacheAgyModels.modelos, origem: "Antigravity CLI (agy models)" };
  }
  const d = detectLocalAgents();
  if (d.agyPath) {
    const pronto = prepararExecutavel(d.agyPath);
    if (pronto) {
      try {
        const res = await executarComando(
          { command: pronto.command, args: [...pronto.prefixo, "models"], cwd: pastaPessoal(), label: "agy models" },
          8_000,
        );
        const linhas = res.stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.includes("\t") && !l.startsWith("Fetching"));
        if (linhas.length > 0) {
          const modelos = linhas.map((l) => {
            const [id, ...resto] = l.split("\t");
            return criarModeloDisponivel(id, resto.join("\t") || id);
          });
          cacheAgyModels = { expiraEm: Date.now() + 60_000, modelos };
          return { modelos, origem: "Antigravity CLI (agy models da sua conta)" };
        }
      } catch {
        // Fallback para lista conhecida se o CLI estiver ocupado ou offline
      }
    }
  }
  const modelos = MODELOS_PADRAO_AGY.map((m) => criarModeloDisponivel(m.id, m.nome));
  return { modelos, origem: "Catálogo Antigravity (padrão)" };
}

async function lerJsonSeguro<T = Record<string, unknown>>(caminho: string): Promise<T | null> {
  try {
    if (!existsSync(caminho)) return null;
    const raw = await readFile(caminho, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function lerConfigAgy(): Promise<{ modeloPadraoId: string | null; modeloPadraoLabel: string | null; modo: string | null }> {
  const cfgPath = path.join(pastaPessoal(), ".gemini", "antigravity-cli", "settings.json");
  const cfg = await lerJsonSeguro<{ model?: string; agentMode?: string }>(cfgPath);
  const labelOuId = typeof cfg?.model === "string" && cfg.model.trim() ? cfg.model.trim() : null;
  return {
    modeloPadraoId: labelOuId,
    modeloPadraoLabel: labelOuId,
    modo: typeof cfg?.agentMode === "string" ? cfg.agentMode : null,
  };
}

async function lerConfigClaude(): Promise<{ modeloPadrao: string | null; esforcoPadrao: EsforcoModelo | null; modelosExtras: ModeloDisponivel[] }> {
  const cfgPath = path.join(pastaPessoal(), ".claude", "settings.json");
  const cfg = await lerJsonSeguro<{ model?: string; effort?: string; env?: Record<string, string> }>(cfgPath);
  const extras: ModeloDisponivel[] = [];
  const candidatos = [
    cfg?.model,
    cfg?.env?.ANTHROPIC_MODEL,
    cfg?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL,
    cfg?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL,
    cfg?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  for (const id of candidatos) {
    if (!MODELOS_PADRAO_CLAUDE.some((m) => m.id === id) && !extras.some((m) => m.id === id)) {
      extras.push(criarModeloDisponivel(id, `${id} (Configurado no Claude Code)`, "Claude"));
    }
  }
  const esf = cfg?.effort && ["low", "medium", "high", "max"].includes(cfg.effort) ? (cfg.effort as EsforcoModelo) : null;
  return {
    modeloPadrao: typeof cfg?.model === "string" && cfg.model.trim() ? cfg.model.trim() : "sonnet",
    esforcoPadrao: esf ?? "high",
    modelosExtras: extras,
  };
}

async function lerConfigCodex(): Promise<{ modeloPadrao: string | null; esforcoPadrao: EsforcoModelo | null; modelosExtras: ModeloDisponivel[] }> {
  const tomlPath = path.join(pastaPessoal(), ".codex", "config.toml");
  const extras: ModeloDisponivel[] = [];
  let modeloPadrao: string | null = null;
  let esforcoPadrao: EsforcoModelo | null = null;
  try {
    if (existsSync(tomlPath)) {
      const raw = await readFile(tomlPath, "utf8");
      const mModel = /^\s*model\s*=\s*["']([^"']+)["']/m.exec(raw);
      const mEffort = /^\s*model_reasoning_effort\s*=\s*["']([^"']+)["']/m.exec(raw);
      if (mModel?.[1]) {
        modeloPadrao = mModel[1].trim();
        if (!MODELOS_PADRAO_CODEX.some((m) => m.id === modeloPadrao)) {
          extras.push(criarModeloDisponivel(modeloPadrao, `${modeloPadrao} (Configurado no Codex)`, "GPT"));
        }
      }
      if (mEffort?.[1] && ["low", "medium", "high"].includes(mEffort[1].trim())) {
        esforcoPadrao = mEffort[1].trim() as EsforcoModelo;
      }
    }
  } catch {}
  return {
    modeloPadrao: modeloPadrao ?? "o4-mini",
    esforcoPadrao: esforcoPadrao ?? "medium",
    modelosExtras: extras,
  };
}

async function listarModelosOllama(env: Record<string, string | undefined>): Promise<{ modelos: ModeloDisponivel[]; modeloPadrao: string; origem: string }> {
  const baseUrl = (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const padraoEnv = env.OLLAMA_MODEL || "qwen2.5:7b";
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2_500) });
    if (res.ok) {
      const json = (await res.json()) as { models?: Array<{ name?: string; details?: { parameter_size?: string } }> };
      const lista = (json.models ?? [])
        .filter((m): m is { name: string; details?: { parameter_size?: string } } => typeof m.name === "string" && m.name.trim().length > 0)
        .map((m) => {
          const tam = m.details?.parameter_size ? ` · ${m.details.parameter_size}` : "";
          return criarModeloDisponivel(m.name, `${m.name}${tam}`, "Local");
        });
      if (lista.length > 0) {
        const modeloPadrao = lista.some((m) => m.id === padraoEnv) ? padraoEnv : lista[0].id;
        return { modelos: lista, modeloPadrao, origem: `Ollama local (${baseUrl})` };
      }
    }
  } catch {}
  return {
    modelos: [criarModeloDisponivel(padraoEnv, `${padraoEnv} (Ollama)`, "Local")],
    modeloPadrao: padraoEnv,
    origem: "Configuração OLLAMA_MODEL (.env)",
  };
}

async function listarModelosOpenAICompat(env: Record<string, string | undefined>): Promise<{ modelos: ModeloDisponivel[]; modeloPadrao: string; origem: string }> {
  const baseUrl = (env.OPENAI_COMPAT_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const apiKey = env.OPENAI_COMPAT_API_KEY || "";
  const padraoEnv = env.OPENAI_COMPAT_MODEL || "nvidia/nemotron-3-super-120b-a12b";
  const modelos: ModeloDisponivel[] = [criarModeloDisponivel(padraoEnv, `${padraoEnv} (Padrão .env)`)];
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(2_500),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      for (const item of (json.data ?? []).slice(0, 30)) {
        if (typeof item.id === "string" && item.id.trim() && !modelos.some((m) => m.id === item.id)) {
          modelos.push(criarModeloDisponivel(item.id, item.id));
        }
      }
      return { modelos, modeloPadrao: padraoEnv, origem: `Servidor OpenAI-Compat (${baseUrl})` };
    }
  } catch {}
  return { modelos, modeloPadrao: padraoEnv, origem: "Configuração OPENAI_COMPAT_MODEL (.env)" };
}

export async function descobrirCatalogoDoCerebro(
  cerebro: Cerebro | null,
  opcoes: { forcarAtualizacao?: boolean; env?: Record<string, string | undefined> } = {},
): Promise<CatalogoCerebro> {
  const env = opcoes.env ?? process.env;
  if (!cerebro) {
    return {
      motorId: "nenhum",
      motorNome: "Nenhuma IA vinculada",
      suportaConversaContinua: false,
      suportaEsforco: false,
      esforcosDisponiveis: [],
      modeloPadrao: null,
      esforcoPadrao: null,
      familias: [],
      modelos: [],
      origemCatalogo: "Vincule uma IA para carregar os modelos",
    };
  }

  const motorNome = NOMES_CEREBRO[cerebro.id] ?? cerebro.id;

  if (cerebro.tipo === "agente" && cerebro.id === "agy") {
    const [{ modelos, origem }, cfg] = await Promise.all([listarModelosAgy(opcoes.forcarAtualizacao), lerConfigAgy()]);
    const padraoEncontrado =
      modelos.find((m) => m.id === cfg.modeloPadraoId || m.nome === cfg.modeloPadraoLabel) ??
      modelos.find((m) => m.id === "gemini-4-argon-high") ??
      modelos[0] ??
      null;
    const familias = Array.from(new Set(modelos.map((m) => m.familia)));
    return {
      motorId: "agy",
      motorNome,
      suportaConversaContinua: true,
      suportaEsforco: true,
      esforcosDisponiveis: [TODOS_ESFORCOS.low, TODOS_ESFORCOS.medium, TODOS_ESFORCOS.high, TODOS_ESFORCOS.xhigh, TODOS_ESFORCOS.max],
      modeloPadrao: padraoEncontrado?.id ?? null,
      esforcoPadrao: padraoEncontrado?.forcaEmbutida ?? "high",
      familias,
      modelos,
      origemCatalogo: origem,
    };
  }

  if (cerebro.tipo === "agente" && cerebro.id === "claude") {
    const cfg = await lerConfigClaude();
    const modelos = [...cfg.modelosExtras, ...MODELOS_PADRAO_CLAUDE.map((m) => criarModeloDisponivel(m.id, m.nome, "Claude"))];
    return {
      motorId: "claude",
      motorNome,
      suportaConversaContinua: true,
      suportaEsforco: true,
      esforcosDisponiveis: [TODOS_ESFORCOS.low, TODOS_ESFORCOS.medium, TODOS_ESFORCOS.high, TODOS_ESFORCOS.max],
      modeloPadrao: cfg.modeloPadrao,
      esforcoPadrao: cfg.esforcoPadrao,
      familias: ["Claude"],
      modelos,
      origemCatalogo: "Claude Code CLI (~/.claude/settings.json)",
    };
  }

  if (cerebro.tipo === "agente" && cerebro.id === "codex") {
    const cfg = await lerConfigCodex();
    const modelos = [...cfg.modelosExtras, ...MODELOS_PADRAO_CODEX.map((m) => criarModeloDisponivel(m.id, m.nome, "GPT"))];
    return {
      motorId: "codex",
      motorNome,
      suportaConversaContinua: false,
      suportaEsforco: true,
      esforcosDisponiveis: [TODOS_ESFORCOS.low, TODOS_ESFORCOS.medium, TODOS_ESFORCOS.high],
      modeloPadrao: cfg.modeloPadrao,
      esforcoPadrao: cfg.esforcoPadrao,
      familias: ["GPT"],
      modelos,
      origemCatalogo: "OpenAI Codex CLI (~/.codex/config.toml)",
    };
  }

  if (cerebro.tipo === "agente" && cerebro.id === "hermes") {
    const mHermes = env.HERMES_MODEL || "hermes-default";
    const modelos = [criarModeloDisponivel(mHermes, `${mHermes} (Hermes)`, "Outro")];
    return {
      motorId: "hermes",
      motorNome,
      suportaConversaContinua: false,
      suportaEsforco: false,
      esforcosDisponiveis: [],
      modeloPadrao: mHermes,
      esforcoPadrao: null,
      familias: ["Outro"],
      modelos,
      origemCatalogo: "Agente Hermes",
    };
  }

  if (cerebro.tipo === "llm" && cerebro.id === "gemini") {
    const padrao = env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
    const modelos = MODELOS_PADRAO_GEMINI.map((m) => criarModeloDisponivel(m.id, m.nome, "Gemini"));
    if (!modelos.some((m) => m.id === padrao)) {
      modelos.unshift(criarModeloDisponivel(padrao, `${padrao} (Padrão .env)`, "Gemini"));
    }
    return {
      motorId: "gemini",
      motorNome,
      suportaConversaContinua: false,
      suportaEsforco: false,
      esforcosDisponiveis: [],
      modeloPadrao: padrao,
      esforcoPadrao: null,
      familias: ["Gemini"],
      modelos,
      origemCatalogo: "Google Gemini API",
    };
  }

  if (cerebro.tipo === "llm" && cerebro.id === "ollama") {
    const { modelos, modeloPadrao, origem } = await listarModelosOllama(env);
    return {
      motorId: "ollama",
      motorNome,
      suportaConversaContinua: false,
      suportaEsforco: false,
      esforcosDisponiveis: [],
      modeloPadrao,
      esforcoPadrao: null,
      familias: ["Local"],
      modelos,
      origemCatalogo: origem,
    };
  }

  if (cerebro.tipo === "llm" && cerebro.id === "openai_compat") {
    const { modelos, modeloPadrao, origem } = await listarModelosOpenAICompat(env);
    const familias = Array.from(new Set(modelos.map((m) => m.familia)));
    return {
      motorId: "openai_compat",
      motorNome,
      suportaConversaContinua: false,
      suportaEsforco: false,
      esforcosDisponiveis: [],
      modeloPadrao,
      esforcoPadrao: null,
      familias,
      modelos,
      origemCatalogo: origem,
    };
  }

  return {
    motorId: cerebro.id,
    motorNome,
    suportaConversaContinua: false,
    suportaEsforco: false,
    esforcosDisponiveis: [],
    modeloPadrao: null,
    esforcoPadrao: null,
    familias: [],
    modelos: [],
    origemCatalogo: motorNome,
  };
}

async function contarHistoricoJsonl(caminho: string, corte5hMs: number, corteHojeMs: number): Promise<{ janela5h: number; hoje: number; conversas: Set<string> }> {
  const conversas = new Set<string>();
  let janela5h = 0;
  let hoje = 0;
  try {
    if (!existsSync(caminho)) return { janela5h, hoje, conversas };
    const raw = await readFile(caminho, "utf8");
    const linhas = raw.split(/\r?\n/);
    for (const l of linhas) {
      if (!l.trim()) continue;
      try {
        const item = JSON.parse(l) as { timestamp?: number | string; conversationId?: string; sessionId?: string; type?: string };
        if (item.type === "slash_command") continue;
        const ts = typeof item.timestamp === "number" ? item.timestamp : typeof item.timestamp === "string" ? Date.parse(item.timestamp) : NaN;
        if (Number.isFinite(ts)) {
          if (ts >= corte5hMs) janela5h++;
          if (ts >= corteHojeMs) hoje++;
        }
        const cid = item.conversationId ?? item.sessionId;
        if (typeof cid === "string" && cid.trim()) conversas.add(cid.trim());
      } catch {}
    }
  } catch {}
  return { janela5h, hoje, conversas };
}

async function inspecionarTelemetriaLocalAgy(corte5hMs: number, corteHojeMs: number): Promise<TelemetriaLocalMotor> {
  const baseDir = path.join(pastaPessoal(), ".gemini", "antigravity-cli");
  const [cfg, hist, lastConvs] = await Promise.all([
    lerConfigAgy(),
    contarHistoricoJsonl(path.join(baseDir, "history.jsonl"), corte5hMs, corteHojeMs),
    lerJsonSeguro<Record<string, string>>(path.join(baseDir, "cache", "last_conversations.json")),
  ]);

  let contaConectada: string | null = null;
  let planoOuModo: string | null = cfg.modo ? `Modo: ${cfg.modo}` : null;
  let statusCota: "ok" | "atencao" | "limite" = "ok";
  let mensagemCota = "Conta Antigravity ativa · sem bloqueio de cota recente";

  try {
    const logDir = path.join(baseDir, "log");
    if (existsSync(logDir)) {
      const arquivos = (await readdir(logDir)).filter((f) => f.startsWith("cli-") && f.endsWith(".log"));
      const comStats = await Promise.all(
        arquivos.map(async (f) => {
          const full = path.join(logDir, f);
          const s = await stat(full).catch(() => null);
          return { full, mtime: s?.mtimeMs ?? 0, size: s?.size ?? 0 };
        }),
      );
      const recentes = comStats.filter((x) => x.size > 0).sort((a, b) => b.mtime - a.mtime).slice(0, 3);
      for (const arq of recentes) {
        const conteudo = await readFile(arq.full, "utf8").catch(() => "");
        const mEmail = /applyAuthResult:\s*email=([^,\s]+),\s*authMethod=([^,\s]+)/.exec(conteudo);
        if (mEmail && !contaConectada) {
          contaConectada = mEmail[1];
          planoOuModo = `Plano ${mEmail[2]}${cfg.modo ? ` · modo ${cfg.modo}` : ""}`;
        }
        if (/QUOTA_EXHAUSTED|Out of credits|balance is too low/i.test(conteudo)) {
          statusCota = "limite";
          mensagemCota = "Aviso de limite/créditos detectado no último log do agy. Considere alternar entre Gemini, Claude e GPT.";
          break;
        }
      }
    }
  } catch {}

  if (statusCota === "ok" && hist.janela5h >= 45) {
    statusCota = "atencao";
    mensagemCota = `Uso intenso nas últimas 5h (${hist.janela5h} prompts no agy). Se um modelo desacelerar, troque a família ou reduza a força para Medium/Low.`;
  }

  const conversasAtivas = Math.max(hist.conversas.size, lastConvs ? Object.keys(lastConvs).length : 0);
  return {
    contaConectada,
    planoOuModo,
    modeloConfiguradoCli: cfg.modeloPadraoLabel,
    promptsJanela5h: hist.janela5h,
    promptsHoje: hist.hoje,
    conversasAtivas,
    statusCota,
    mensagemCota,
  };
}

async function inspecionarTelemetriaLocalClaude(corte5hMs: number, corteHojeMs: number): Promise<TelemetriaLocalMotor> {
  const baseDir = path.join(pastaPessoal(), ".claude");
  const [cfg, hist] = await Promise.all([
    lerConfigClaude(),
    contarHistoricoJsonl(path.join(baseDir, "history.jsonl"), corte5hMs, corteHojeMs),
  ]);
  const statusCota: "ok" | "atencao" | "limite" = hist.janela5h >= 40 ? "atencao" : "ok";
  return {
    contaConectada: existsSync(baseDir) ? "Claude Code local (~/.claude)" : null,
    planoOuModo: `Esforço padrão: ${cfg.esforcoPadrao ?? "high"}`,
    modeloConfiguradoCli: cfg.modeloPadrao,
    promptsJanela5h: hist.janela5h,
    promptsHoje: hist.hoje,
    conversasAtivas: hist.conversas.size,
    statusCota,
    mensagemCota:
      statusCota === "atencao"
        ? `${hist.janela5h} prompts enviados na janela de 5h do Claude Code. Use Sonnet/Haiku ou força Low para economizar cota.`
        : "Claude Code pronto · janela de 5h monitorada localmente.",
  };
}

async function inspecionarTelemetriaLocalCodex(corte5hMs: number, corteHojeMs: number): Promise<TelemetriaLocalMotor> {
  const baseDir = path.join(pastaPessoal(), ".codex");
  const [cfg, hist] = await Promise.all([
    lerConfigCodex(),
    contarHistoricoJsonl(path.join(baseDir, "history.jsonl"), corte5hMs, corteHojeMs),
  ]);
  return {
    contaConectada: existsSync(baseDir) ? "OpenAI Codex local (~/.codex)" : null,
    planoOuModo: `Esforço padrão: ${cfg.esforcoPadrao ?? "medium"}`,
    modeloConfiguradoCli: cfg.modeloPadrao,
    promptsJanela5h: hist.janela5h,
    promptsHoje: hist.hoje,
    conversasAtivas: hist.conversas.size,
    statusCota: hist.janela5h >= 50 ? "atencao" : "ok",
    mensagemCota: "Codex operando localmente em modo sandbox.",
  };
}

function provedoresDoCerebro(c: Cerebro | null): string[] {
  if (!c) return [];
  if (c.tipo === "agente") {
    if (c.id === "agy") return ["AGY"];
    if (c.id === "claude") return ["CLAUDE_CODE", "CLAUDE"];
    if (c.id === "codex") return ["CODEX"];
    if (c.id === "hermes") return ["HERMES"];
  }
  if (c.id === "gemini") return ["GEMINI"];
  if (c.id === "ollama") return ["OLLAMA"];
  if (c.id === "openai_compat") return ["OPENAI_COMPAT"];
  return [c.id.toUpperCase()];
}

function somarBloco(
  linhas: Array<{ unit: string; quantity: number; costUsd: number; createdAt: Date }>,
   desdeMs: number,
): BlocoConsumoTokens {
  let tokensIn = 0;
  let tokensOut = 0;
  let custoEstimadoUsd = 0;
  let linhasIn = 0;
  for (const r of linhas) {
    if (r.createdAt.getTime() < desdeMs) continue;
    custoEstimadoUsd += r.costUsd || 0;
    if (r.unit === "TOKENS_IN") {
      tokensIn += r.quantity || 0;
      linhasIn++;
    } else if (r.unit === "TOKENS_OUT") {
      tokensOut += r.quantity || 0;
    }
  }
  return {
    tokensIn,
    tokensOut,
    totalTokens: tokensIn + tokensOut,
    chamadas: linhasIn,
    custoEstimadoUsd,
  };
}

export async function inspecionarLimitesDoCerebro(
  cerebro: Cerebro | null,
  env: Record<string, string | undefined> = process.env,
): Promise<ResumoLimitesCerebro> {
  const agora = Date.now();
  const corte5hMs = agora - 5 * 3600_000;
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const motorId = cerebro?.id ?? "nenhum";
  const motorNome = cerebro ? (NOMES_CEREBRO[cerebro.id] ?? cerebro.id) : "Nenhuma IA vinculada";
  const provedores = provedoresDoCerebro(cerebro);

  const [linhasMes, orcamento] = await Promise.all([
    provedores.length > 0
      ? prisma.usage
          .findMany({
            where: { createdAt: { gte: inicioMes }, provider: { in: provedores } },
            select: { unit: true, quantity: true, costUsd: true, createdAt: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    getBudgetStatus().catch(() => ({ capUsd: 0, spentUsd: 0, remainingUsd: 0, estimatedUsd: 0 })),
  ]);

  const consumoMotor = {
    janela5h: somarBloco(linhasMes, corte5hMs),
    hoje: somarBloco(linhasMes, inicioHoje.getTime()),
    mes: somarBloco(linhasMes, inicioMes.getTime()),
  };

  let telemetriaLocal: TelemetriaLocalMotor;
  if (cerebro?.tipo === "agente" && cerebro.id === "agy") {
    telemetriaLocal = await inspecionarTelemetriaLocalAgy(corte5hMs, inicioHoje.getTime());
  } else if (cerebro?.tipo === "agente" && cerebro.id === "claude") {
    telemetriaLocal = await inspecionarTelemetriaLocalClaude(corte5hMs, inicioHoje.getTime());
  } else if (cerebro?.tipo === "agente" && cerebro.id === "codex") {
    telemetriaLocal = await inspecionarTelemetriaLocalCodex(corte5hMs, inicioHoje.getTime());
  } else if (cerebro?.tipo === "llm" && cerebro.id === "ollama") {
    telemetriaLocal = {
      contaConectada: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      planoOuModo: "Execução 100% local · sem limites de cota",
      modeloConfiguradoCli: env.OLLAMA_MODEL || "qwen2.5:7b",
      promptsJanela5h: consumoMotor.janela5h.chamadas,
      promptsHoje: consumoMotor.hoje.chamadas,
      conversasAtivas: 1,
      statusCota: "ok",
      mensagemCota: "Modelos locais no Ollama não têm limite de requisições nem custo por token.",
    };
  } else if (cerebro?.tipo === "llm" && cerebro.id === "gemini") {
    const sticky = await prisma.setting.findUnique({ where: { key: "gemini.healthyModel" } }).catch(() => null);
    let modeloSaudavel: string | null = null;
    if (sticky?.value) {
      try {
        const j = JSON.parse(sticky.value) as { model?: string; until?: number };
        if (j.model && (j.until ?? 0) > agora) modeloSaudavel = j.model;
      } catch {}
    }
    telemetriaLocal = {
      contaConectada: env.GEMINI_API_KEY ? "Chave GEMINI_API_KEY ativa" : "Sem chave configurada",
      planoOuModo: modeloSaudavel ? `Modelo ativo: ${modeloSaudavel}` : "Rotação automática anti-429 ativa",
      modeloConfiguradoCli: env.GEMINI_TEXT_MODEL || "gemini-3.6-flash",
      promptsJanela5h: consumoMotor.janela5h.chamadas,
      promptsHoje: consumoMotor.hoje.chamadas,
      conversasAtivas: 1,
      statusCota: "ok",
      mensagemCota: "Em caso de limite 429, o Vincere alterna automaticamente entre os modelos Flash de reserva.",
    };
  } else {
    telemetriaLocal = {
      contaConectada: cerebro ? motorNome : null,
      planoOuModo: cerebro ? `Tipo: ${cerebro.tipo.toUpperCase()}` : null,
      modeloConfiguradoCli: cerebro?.modelo ?? null,
      promptsJanela5h: consumoMotor.janela5h.chamadas,
      promptsHoje: consumoMotor.hoje.chamadas,
      conversasAtivas: cerebro ? 1 : 0,
      statusCota: "ok",
      mensagemCota: cerebro ? `Monitorando consumo de ${motorNome} nesta instância.` : "Vincule uma IA para visualizar os limites.",
    };
  }

  // Garante que os contadores locais nunca fiquem menores que as chamadas já registradas no banco do Vincere
  telemetriaLocal.promptsJanela5h = Math.max(telemetriaLocal.promptsJanela5h, consumoMotor.janela5h.chamadas);
  telemetriaLocal.promptsHoje = Math.max(telemetriaLocal.promptsHoje, consumoMotor.hoje.chamadas);

  return {
    motorId,
    motorNome,
    atualizadoEm: new Date(agora).toISOString(),
    telemetriaLocal,
    consumoMotor,
    orcamentoVincere: orcamento,
  };
}

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { acharExecutavel, prepararExecutavel } from "./agente-executavel";
import { pastaPessoal } from "./pastas";
import { updateRequest } from "./claude-inbox";
import {
  buildHermesInvocation,
  describeHermes,
  readHermesConfig,
  remoteProjectDir,
  type AgentEngineId,
  type AgentInvocation,
  type DetectedHermes,
} from "./agent-adapters";

export type { AgentEngineId } from "./agent-adapters";

export interface DetectedAgents {
  agyPath: string | null;
  claudePath: string | null;
  codexPath: string | null;
  preferred: "agy" | "claude" | "inbox";
  /** Só presente quando o Hermes foi configurado no .env; não entra na escolha "preferred". */
  hermes: DetectedHermes;
}

// Procura primeiro os caminhos que o usuário informou (AGY_BIN, CLAUDE_BIN, CODEX_BIN) e os locais de
// instalação conhecidos; depois o PATH do sistema (funciona em Windows, Mac e Linux).
export function detectLocalAgents(): DetectedAgents {
  const local = process.env.LOCALAPPDATA;
  const roaming = process.env.APPDATA;
  const win = process.platform === "win32";
  const agyPath = acharExecutavel(["agy"], [process.env.AGY_BIN, local && path.join(local, "agy", "bin", "agy.exe")]);
  const claudePath = acharExecutavel(
    ["claude"],
    [process.env.CLAUDE_BIN, roaming && path.join(roaming, "npm", "claude.cmd"), path.join(pastaPessoal(), ".local", "bin", win ? "claude.exe" : "claude")],
  );
  const codexPath = acharExecutavel(["codex"], [process.env.CODEX_BIN, local && path.join(local, "Programs", "OpenAI", "Codex", "bin", "codex.exe")]);
  const preferred = agyPath ? "agy" : claudePath ? "claude" : "inbox";
  return { agyPath, claudePath, codexPath, preferred, hermes: describeHermes(readHermesConfig()) };
}

export interface AgentSelectionContext {
  label?: string;
  tagName?: string;
  selector?: string;
  hfId?: string;
  currentTime?: number;
  textContent?: string | null;
  sourceFile?: string;
  inlineStyles?: Record<string, string>;
  faixaAudio?: { trilha?: string; inicio?: number; fim?: number };
}

export interface RunLocalAgentInput {
  requestId: string;
  pedido: string;
  engine?: AgentEngineId;
  modelo?: string;
  esforco?: "low" | "medium" | "high" | "xhigh" | "max";
  projectHf?: string;
  projectDir?: string;
  pagina?: string;
  anexo?: string;
  selection?: AgentSelectionContext | null;
}

// dirOverride: caminho do projeto como o agente o enxerga (num agente remoto, é o caminho do servidor).
function buildAgentPrompt(input: RunLocalAgentInput, dirOverride?: string): string {
  const lines: string[] = [
    "Você está operando integrado ao Vincere Studio (HyperFrames Studio Local).",
    "Execute a alteração solicitada diretamente nos arquivos do projeto sem fazer perguntas.",
  ];

  const projectDir = dirOverride ?? input.projectDir;
  if (projectDir) {
    lines.push(`Diretório do projeto HyperFrames ativo: ${projectDir}`);
    lines.push(`Arquivo principal da composição: ${(dirOverride ? path.posix : path).join(projectDir, "index.html")}`);
  } else if (input.projectHf) {
    lines.push(`Projeto HyperFrames ativo: ${input.projectHf}`);
  }

  if (input.selection) {
    lines.push(
      "",
      "=== ELEMENTO SELECIONADO PELO USUÁRIO NO HYPERFRAMES STUDIO ===",
      `- Label / Tag: ${input.selection.label || input.selection.tagName || "elemento"}`,
      input.selection.selector ? `- Seletor CSS: ${input.selection.selector}` : "",
      input.selection.hfId ? `- Atributo data-hf-id: "${input.selection.hfId}"` : "",
      input.selection.currentTime !== undefined
        ? `- Tempo atual na timeline: ${Number(input.selection.currentTime).toFixed(2)}s`
        : "",
      input.selection.sourceFile ? `- Arquivo fonte: ${input.selection.sourceFile}` : "",
      input.selection.faixaAudio
        ? `- Faixa de áudio selecionada: ${input.selection.faixaAudio.trilha ?? "trilha"} de ${Number(input.selection.faixaAudio.inicio ?? 0).toFixed(2)}s até ${Number(input.selection.faixaAudio.fim ?? 0).toFixed(2)}s`
        : "",
      input.selection.textContent ? `- Texto atual: "${input.selection.textContent}"` : "",
      input.selection.inlineStyles && Object.keys(input.selection.inlineStyles).length > 0
        ? `- Estilos inline: ${JSON.stringify(input.selection.inlineStyles)}`
        : "",
      "===============================================================",
    );
  }

  if (input.anexo) {
    lines.push("", "=== CONTEXTO ADICIONAL ===", input.anexo);
  }

  lines.push(
    "",
    "=== REGRAS TÉCNICAS HYPERFRAMES ===",
    "1. Anime preferencialmente transform (x, y, scale, rotation) e opacity no GSAP (evite animar left/top/margin diretamente para não gerar stutter no render).",
    "2. Mantenha window.__timelines[\"main\"] sincronizado com data-composition-id=\"main\".",
    "3. Responda de forma curta e objetiva em português descrevendo o que você alterou.",
    "",
    "=== PEDIDO DO USUÁRIO ===",
    input.pedido,
  );

  return lines.filter((l) => l !== undefined).join("\n");
}

// Pasta do Node 22 (nvm no Windows) que o agy pode precisar; só entra no PATH se existir, com o separador do
// sistema. Em outros casos, use VINCERE_AGENT_PATH no .env.
const LEGACY_NODE_DIR = path.join(pastaPessoal(), "AppData", "Local", "nvm", "v22.11.0");

function agentEnv(): NodeJS.ProcessEnv {
  const extra = [process.env.VINCERE_AGENT_PATH, existsSync(LEGACY_NODE_DIR) ? LEGACY_NODE_DIR : undefined].filter(
    Boolean,
  ) as string[];
  if (extra.length === 0) return process.env;
  return { ...process.env, PATH: [...extra, process.env.PATH || ""].join(path.delimiter) };
}

type EngineUsed = "agy" | "claude" | "codex" | "hermes" | "inbox";

const ENGINE_LABEL: Record<EngineUsed, string> = {
  agy: "Antigravity (agy)",
  claude: "Claude Code",
  codex: "Codex",
  hermes: "Hermes",
  inbox: "fila",
};

export async function dispatchLocalAgent(input: RunLocalAgentInput): Promise<{
  dispatched: boolean;
  engineUsed: EngineUsed;
}> {
  const detected = detectLocalAgents();
  const hermesCfg = detected.hermes.available ? readHermesConfig() : null;
  const requested: AgentEngineId = input.engine || "auto";

  let engineUsed: EngineUsed = "inbox";
  let binPath: string | null = null;

  if (requested === "agy" && detected.agyPath) {
    engineUsed = "agy";
    binPath = detected.agyPath;
  } else if (requested === "claude" && detected.claudePath) {
    engineUsed = "claude";
    binPath = detected.claudePath;
  } else if (requested === "codex" && detected.codexPath) {
    engineUsed = "codex";
    binPath = detected.codexPath;
  } else if (requested === "hermes" && hermesCfg) {
    engineUsed = "hermes";
  } else if (requested === "auto") {
    if (detected.agyPath) {
      engineUsed = "agy";
      binPath = detected.agyPath;
    } else if (detected.claudePath) {
      engineUsed = "claude";
      binPath = detected.claudePath;
    } else if (detected.codexPath) {
      engineUsed = "codex";
      binPath = detected.codexPath;
    } else if (hermesCfg) {
      // Último recurso: só existe se alguém configurou o Hermes de propósito.
      engineUsed = "hermes";
    }
  }

  if (engineUsed === "inbox" || (engineUsed !== "hermes" && !binPath)) {
    return { dispatched: false, engineUsed: "inbox" };
  }

  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const cwd = input.projectDir && existsSync(input.projectDir) ? input.projectDir : repoRoot;

  let invocation: AgentInvocation;
  if (engineUsed === "hermes" && hermesCfg) {
    // Com agente remoto, o projeto é o do servidor (ou nenhum), nunca o caminho do PC.
    const remoteDir = hermesCfg.mode === "ssh" ? remoteProjectDir(hermesCfg, input.projectDir, input.projectHf) : undefined;
    const prompt = hermesCfg.mode === "ssh" ? buildAgentPrompt({ ...input, projectDir: undefined }, remoteDir) : buildAgentPrompt(input);
    invocation = buildHermesInvocation(hermesCfg, {
      prompt,
      cwd,
      projectDir: input.projectDir,
      projectHf: input.projectHf,
    });
  } else {
    const fullPrompt = buildAgentPrompt(input);
    // No Windows o claude costuma ser um atalho .cmd; o Node não o executa sem shell, então usamos o alvo real.
    const pronto = prepararExecutavel(binPath as string);
    if (!pronto) {
      await updateRequest(input.requestId, {
        status: "erro",
        resposta: `Não consegui executar ${ENGINE_LABEL[engineUsed]} (${path.basename(binPath as string)}). Defina ${engineUsed.toUpperCase()}_BIN no .env com o caminho do executável (.exe).`,
      });
      return { dispatched: false, engineUsed };
    }
    let args: string[];
    let stdin: string | undefined;
    if (engineUsed === "agy") {
      args = [
        "--mode",
        "auto",
        "--dangerously-skip-permissions",
        ...(input.modelo ? ["--model", input.modelo] : []),
        ...(input.esforco ? ["--effort", input.esforco] : []),
        "--add-dir",
        cwd,
        "-p",
        fullPrompt,
      ];
    } else if (engineUsed === "codex") {
      // workspace-write: pode editar só dentro da pasta do projeto; o prompt vai por stdin.
      const nivelCodex = input.esforco === "xhigh" || input.esforco === "max" ? "high" : input.esforco;
      args = [
        "exec",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "--ephemeral",
        ...(input.modelo ? ["-m", input.modelo] : []),
        ...(nivelCodex ? ["-c", `model_reasoning_effort="${nivelCodex}"`] : []),
        "-C",
        cwd,
        "-",
      ];
      stdin = fullPrompt;
    } else {
      const nivelClaude = input.esforco === "xhigh" ? "high" : input.esforco;
      args = [
        "--dangerously-skip-permissions",
        ...(input.modelo ? ["--model", input.modelo] : []),
        ...(nivelClaude ? ["--effort", nivelClaude] : []),
        "-p",
        fullPrompt,
      ];
    }
    const sufixoModelo = [input.modelo, input.esforco ? `força ${input.esforco}` : undefined].filter(Boolean).join(" · ");
    const rotuloMotor = sufixoModelo ? `${ENGINE_LABEL[engineUsed]} (${sufixoModelo})` : ENGINE_LABEL[engineUsed];
    invocation = { command: pronto.command, args: [...pronto.prefixo, ...args], cwd, stdin, label: rotuloMotor };
  }

  await updateRequest(input.requestId, {
    status: "fazendo",
    resposta: `Operando ${engineUsed === "hermes" ? "com" : "localmente com"} ${invocation.label} em ${path.basename(cwd)}...`,
  });

  const child = spawn(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: agentEnv(),
    windowsHide: true,
  });

  if (invocation.stdin !== undefined) {
    child.stdin?.on("error", () => {});
    child.stdin?.end(invocation.stdin, "utf8");
  }

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  child.on("error", async (err) => {
    await updateRequest(input.requestId, {
      status: "erro",
      resposta: `Falha ao iniciar ${engineUsed}: ${err.message}`,
    });
  });

  child.on("close", async (code) => {
    const cleanOut = stdout.trim() || stderr.trim();
    if (code === 0 || stdout.trim().length > 0) {
      await updateRequest(input.requestId, {
        status: "feito",
        resposta:
          cleanOut.slice(-4000) ||
          `Alteração concluída pelo ${ENGINE_LABEL[engineUsed]}.`,
      });
    } else {
      await updateRequest(input.requestId, {
        status: "erro",
        resposta:
          cleanOut.slice(-3000) ||
          `O agente (${engineUsed}) encerrou com código ${code}.`,
      });
    }
  });

  return { dispatched: true, engineUsed };
}

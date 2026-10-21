import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { updateRequest } from "./claude-inbox";

export type AgentEngineId = "auto" | "agy" | "claude" | "inbox";

export interface DetectedAgents {
  agyPath: string | null;
  claudePath: string | null;
  preferred: "agy" | "claude" | "inbox";
}

const AGY_CANDIDATES = [
  process.env.AGY_BIN,
  "C:\\Users\\Nicolas\\AppData\\Local\\agy\\bin\\agy.exe",
  path.join(process.env.LOCALAPPDATA || "", "agy", "bin", "agy.exe"),
].filter(Boolean) as string[];

const CLAUDE_CANDIDATES = [
  process.env.CLAUDE_BIN,
  path.join(process.env.APPDATA || "", "npm", "claude.cmd"),
  path.join(process.env.USERPROFILE || "", ".local", "bin", "claude.exe"),
].filter(Boolean) as string[];

export function detectLocalAgents(): DetectedAgents {
  const agyPath = AGY_CANDIDATES.find((p) => existsSync(p)) ?? null;
  const claudePath = CLAUDE_CANDIDATES.find((p) => existsSync(p)) ?? null;
  const preferred = agyPath ? "agy" : claudePath ? "claude" : "inbox";
  return { agyPath, claudePath, preferred };
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
}

export interface RunLocalAgentInput {
  requestId: string;
  pedido: string;
  engine?: AgentEngineId;
  projectHf?: string;
  projectDir?: string;
  pagina?: string;
  anexo?: string;
  selection?: AgentSelectionContext | null;
}

function buildAgentPrompt(input: RunLocalAgentInput): string {
  const lines: string[] = [
    "Você está operando integrado ao Vincere Studio (HyperFrames Studio Local).",
    "Execute a alteração solicitada diretamente nos arquivos do projeto sem fazer perguntas.",
  ];

  if (input.projectDir) {
    lines.push(`Diretório do projeto HyperFrames ativo: ${input.projectDir}`);
    lines.push(`Arquivo principal da composição: ${path.join(input.projectDir, "index.html")}`);
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

export async function dispatchLocalAgent(input: RunLocalAgentInput): Promise<{
  dispatched: boolean;
  engineUsed: "agy" | "claude" | "inbox";
}> {
  const detected = detectLocalAgents();
  const requested = input.engine || "auto";

  let engineUsed: "agy" | "claude" | "inbox" = "inbox";
  let binPath: string | null = null;

  if (requested === "agy" && detected.agyPath) {
    engineUsed = "agy";
    binPath = detected.agyPath;
  } else if (requested === "claude" && detected.claudePath) {
    engineUsed = "claude";
    binPath = detected.claudePath;
  } else if (requested === "auto") {
    if (detected.agyPath) {
      engineUsed = "agy";
      binPath = detected.agyPath;
    } else if (detected.claudePath) {
      engineUsed = "claude";
      binPath = detected.claudePath;
    }
  }

  if (!binPath || engineUsed === "inbox") {
    return { dispatched: false, engineUsed: "inbox" };
  }

  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const cwd = input.projectDir && existsSync(input.projectDir) ? input.projectDir : repoRoot;
  const fullPrompt = buildAgentPrompt(input);

  await updateRequest(input.requestId, {
    status: "fazendo",
    resposta: `Operando localmente com ${engineUsed === "agy" ? "Antigravity (agy)" : "Claude Code"} em ${path.basename(cwd)}...`,
  });

  const args: string[] =
    engineUsed === "agy"
      ? [
          "--mode",
          "auto",
          "--dangerously-skip-permissions",
          "--add-dir",
          cwd,
          "-p",
          fullPrompt,
        ]
      : ["--dangerously-skip-permissions", "-p", fullPrompt];

  const child = spawn(binPath, args, {
    cwd,
    env: {
      ...process.env,
      PATH: `C:\\Users\\Nicolas\\AppData\\Local\\nvm\\v22.11.0;${process.env.PATH || ""}`,
    },
    windowsHide: true,
  });

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
          `Alteração concluída pelo ${engineUsed === "agy" ? "Antigravity (agy)" : "Claude Code"}.`,
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

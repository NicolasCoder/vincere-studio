#!/usr/bin/env node
/**
 * Servidor MCP (Model Context Protocol) nativo do Vincere Studio.
 * Transporte: JSON-RPC 2.0 sobre stdio (compatível com Antigravity agy, Claude Code, Cursor e Codex).
 *
 * Uso:
 *   node scripts/vincere-mcp-server.mjs
 *   ou: pnpm mcp:server
 */

import readline from "node:readline";

const BASE_URL = (process.env.VINCERE_URL || "http://127.0.0.1:3210").replace(/\/+$/, "");
const AGENT_TOKEN = process.env.VINCERE_AGENT_TOKEN || process.env.ADMIN_TOKEN || "";

async function callApi(pathname, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (AGENT_TOKEN) {
    headers["Authorization"] = `Bearer ${AGENT_TOKEN}`;
  }
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(async () => ({ raw: await res.text().catch(() => "") }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} em ${method} ${pathname}: ${JSON.stringify(data)}`);
  }
  return data;
}

const TOOLS = [
  {
    name: "vincere_capabilities",
    description:
      "Descobre o estado completo da instância Vincere Studio: motores online (Worker, HyperFrames, GPU RTX 3060), agentes CLI, chaves configuradas e Runbooks disponíveis.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vincere_list_runbooks",
    description: "Lista os 6 Runbooks executáveis do Vincere Studio com seus passos e critérios de verificação.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vincere_evaluate_runbook",
    description: "Avalia o progresso real de um projeto contra um Runbook e devolve o próximo passo exato a executar.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string", description: "ID do projeto no Vincere Studio" },
        runbookId: {
          type: "string",
          description: "ID do runbook (ex.: curiosidades-short-9x16, dossie-documentario-16x9, hyperframes-motion-pure)",
          default: "curiosidades-short-9x16",
        },
      },
    },
  },
  {
    name: "vincere_list_projects",
    description: "Lista os projetos de vídeo existentes com estágio, formato e contagens.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 25 },
        stage: { type: "string", description: "Filtro opcional: IDEATION | SCRIPT | MEDIA | RENDER | PUBLISH" },
      },
    },
  },
  {
    name: "vincere_create_project",
    description: "Cria um novo projeto de vídeo no Vincere Studio e retorna seu estado inicial e próximas ações.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "Título ou tema do vídeo" },
        niche: { type: "string", default: "curiosidades" },
        format: { type: "string", enum: ["SHORT_9_16", "LONG_16_9"], default: "SHORT_9_16" },
        targetDuration: { type: "number", default: 60 },
        tone: { type: "string" },
        intensidade: { type: "string", enum: ["calmo", "equilibrado", "dinamico", "muito-dinamico"], default: "equilibrado" },
      },
    },
  },
  {
    name: "vincere_get_project_state",
    description: "Inspeciona o estado completo de um projeto, etapas concluídas, pendências e próximas ações liberadas.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string" },
      },
    },
  },
  {
    name: "vincere_submit_content",
    description:
      "Envia conteúdo criado diretamente pelo agente (ideias, roteiro em atos, cenas visuais, plano de edição ou SEO) sem depender de LLM interno.",
    inputSchema: {
      type: "object",
      required: ["projectId", "payload"],
      properties: {
        projectId: { type: "string" },
        payload: {
          type: "object",
          description: "Objeto com kind ('ideas' | 'script' | 'scenes' | 'edit_plan' | 'seo') e os dados correspondentes.",
        },
      },
    },
  },
  {
    name: "vincere_run_action",
    description:
      "Dispara uma ação do pipeline no projeto (sintetizar_voz, alinhar_legendas, planejar_cenas, buscar_broll, exportar_hyperframes, renderizar_video, aprovar_render, publicar_youtube, etc.).",
    inputSchema: {
      type: "object",
      required: ["projectId", "action"],
      properties: {
        projectId: { type: "string" },
        action: { type: "string" },
        params: { type: "object", description: "Parâmetros adicionais da ação (ex.: force, density, captions, note)" },
      },
    },
  },
  {
    name: "vincere_wait_job",
    description: "Aguarda um job do worker terminar via long-polling e retorna o resultado final.",
    inputSchema: {
      type: "object",
      required: ["jobId"],
      properties: {
        jobId: { type: "string" },
        timeoutMs: { type: "number", default: 25000 },
      },
    },
  },
  {
    name: "vincere_dispatch_terminal_agent",
    description: "Envia um pedido de edição ou comando para a fila/agente local do Vincere Studio (/api/claude).",
    inputSchema: {
      type: "object",
      required: ["pedido"],
      properties: {
        pedido: { type: "string" },
        projetoId: { type: "string" },
        projetoHf: { type: "string" },
        engine: { type: "string", enum: ["auto", "agy", "claude", "codex", "hermes", "inbox"], default: "auto" },
      },
    },
  },
];

async function executeTool(name, args = {}) {
  switch (name) {
    case "vincere_capabilities":
      return callApi("/api/v1/capabilities");
    case "vincere_list_runbooks":
      return callApi("/api/v1/runbooks");
    case "vincere_evaluate_runbook":
      return callApi("/api/v1/runbooks", {
        method: "POST",
        body: { projectId: args.projectId, runbookId: args.runbookId || "curiosidades-short-9x16" },
      });
    case "vincere_list_projects": {
      const qs = new URLSearchParams();
      if (args.limit) qs.set("limit", String(args.limit));
      if (args.stage) qs.set("stage", String(args.stage));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return callApi(`/api/v1/projects${suffix}`);
    }
    case "vincere_create_project":
      return callApi("/api/v1/projects", { method: "POST", body: args });
    case "vincere_get_project_state":
      return callApi(`/api/v1/projects/${encodeURIComponent(args.projectId)}/state`);
    case "vincere_submit_content":
      return callApi(`/api/v1/projects/${encodeURIComponent(args.projectId)}/content`, {
        method: "POST",
        body: args.payload,
      });
    case "vincere_run_action":
      return callApi(`/api/v1/projects/${encodeURIComponent(args.projectId)}/actions`, {
        method: "POST",
        body: { action: args.action, ...(args.params || {}) },
      });
    case "vincere_wait_job":
      return callApi(
        `/api/v1/jobs/${encodeURIComponent(args.jobId)}/wait?timeoutMs=${Number(args.timeoutMs ?? 25000)}`,
      );
    case "vincere_dispatch_terminal_agent":
      return callApi("/api/claude", { method: "POST", body: args });
    default:
      throw new Error(`Ferramenta MCP desconhecida: ${name}`);
  }
}

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  const { id, method, params } = msg;
  if (id === undefined) return; // Notificação (ex.: notifications/initialized)

  try {
    if (method === "initialize") {
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "vincere-studio-mcp", version: "2.1.0" },
      });
      return;
    }

    if (method === "tools/list") {
      sendResponse(id, { tools: TOOLS });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      const output = await executeTool(toolName, toolArgs);
      sendResponse(id, {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      });
      return;
    }

    if (method === "ping") {
      sendResponse(id, {});
      return;
    }

    sendError(id, -32601, `Método não suportado: ${method}`);
  } catch (err) {
    sendResponse(id, {
      isError: true,
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
    });
  }
});

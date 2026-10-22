import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { storageRoot } from "@vincere-studio/providers";

// Caixa de pedidos para o Claude Code que roda no PC do Igor. A web só guarda os pedidos;
// quem executa é o Claude (skill `vincere-pedidos`), que lê pelo túnel e devolve a resposta.
// Arquivo JSON simples: poucos pedidos por dia, sem precisar de migração no banco.

export type ClaudeRequestStatus = "pendente" | "fazendo" | "feito" | "erro";

export interface ClaudeRequest {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ClaudeRequestStatus;
  pedido: string;
  /** Tela de onde o pedido saiu (ex.: /studio). */
  pagina?: string;
  /** Projeto HyperFrames na pasta de projetos, quando houver. */
  projetoHf?: string;
  /** Projeto do banco (id), quando houver. */
  projetoId?: string;
  /** Contexto extra estruturado (ex.: beats do Copiloto). */
  anexo?: string;
  resposta?: string;
}

const FILE = () => path.join(storageRoot(), "claude-inbox.json");
const MAX_ITEMS = 200;

async function readAll(): Promise<ClaudeRequest[]> {
  let raw: string;
  try {
    raw = await fs.readFile(FILE(), "utf8");
  } catch {
    return []; // arquivo ainda não existe
  }
  try {
    return JSON.parse(raw) as ClaudeRequest[];
  } catch {
    // Corrompido: guarda uma cópia em vez de deixar a próxima gravação apagar a caixa inteira.
    await fs.copyFile(FILE(), `${FILE()}.corrompido-${Date.now()}`).catch(() => {});
    return [];
  }
}

async function writeAll(items: ClaudeRequest[]) {
  await fs.mkdir(path.dirname(FILE()), { recursive: true });
  const tmp = `${FILE()}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items.slice(0, MAX_ITEMS), null, 2), "utf8");
  await fs.rename(tmp, FILE());
}

// Uma web só (pm2 fork) atende a caixa: uma fila em memória basta para serializar
// ler-modificar-gravar e evitar que um POST e um PATCH simultâneos se sobrescrevam.
let fila: Promise<unknown> = Promise.resolve();
function emSerie<T>(fn: () => Promise<T>): Promise<T> {
  const run = fila.then(fn, fn);
  fila = run.catch(() => {});
  return run;
}

export async function listRequests(status?: ClaudeRequestStatus) {
  const items = await readAll();
  return status ? items.filter((i) => i.status === status) : items;
}

export async function createRequest(
  input: Pick<ClaudeRequest, "pedido" | "pagina" | "projetoHf" | "projetoId" | "anexo">,
) {
  return emSerie(async () => {
    const now = new Date().toISOString();
    const item: ClaudeRequest = { id: crypto.randomUUID().slice(0, 8), createdAt: now, updatedAt: now, status: "pendente", ...input };
    const items = await readAll();
    await writeAll([item, ...items]);
    return item;
  });
}

export async function updateRequest(id: string, patch: Partial<Pick<ClaudeRequest, "status" | "resposta">>) {
  return emSerie(async () => {
    const items = await readAll();
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    await writeAll(items);
    return item;
  });
}

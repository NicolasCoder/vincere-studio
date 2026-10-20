import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { storageRoot } from "@vincere-studio/providers";

// Memória do Vince: o que o Igor prefere, decidiu ou ensinou, e as notas 👍/👎 das respostas.
// Entra no prompt de cada conversa, então o Vince "aprende" sem treinar modelo nenhum.

export interface ItemMemoria {
  id: string;
  texto: string;
  origem: "conversa" | "manual";
  criadoEm: string;
}

export interface Feedback {
  pergunta: string;
  resposta: string;
  nota: 1 | -1;
  comentario?: string;
  em: string;
}

interface Arquivo {
  itens: ItemMemoria[];
  feedback: Feedback[];
}

const FILE = () => path.join(storageRoot(), "vince", "memoria.json");
const MAX_ITENS = 80;
const MAX_FEEDBACK = 120;

async function ler(): Promise<Arquivo> {
  try {
    const d = JSON.parse(await fs.readFile(FILE(), "utf8")) as Partial<Arquivo>;
    return { itens: d.itens ?? [], feedback: d.feedback ?? [] };
  } catch {
    return { itens: [], feedback: [] };
  }
}

async function gravar(d: Arquivo) {
  await fs.mkdir(path.dirname(FILE()), { recursive: true });
  const tmp = `${FILE()}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2), "utf8");
  await fs.rename(tmp, FILE());
}

// Uma web só (pm2 fork): fila em memória evita duas gravações se sobrescreverem.
let fila: Promise<unknown> = Promise.resolve();
function emSerie<T>(fn: () => Promise<T>): Promise<T> {
  const run = fila.then(fn, fn);
  fila = run.catch(() => {});
  return run;
}

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, " ").trim();

export async function listarMemoria() {
  return ler();
}

export function lembrar(texto: string, origem: ItemMemoria["origem"] = "conversa") {
  return emSerie(async () => {
    const limpo = texto.trim().slice(0, 300);
    if (limpo.length < 4) return null;
    const d = await ler();
    // Evita repetir a mesma lembrança dita de outro jeito parecido.
    if (d.itens.some((i) => normalizar(i.texto) === normalizar(limpo))) return null;
    const item: ItemMemoria = { id: crypto.randomUUID().slice(0, 8), texto: limpo, origem, criadoEm: new Date().toISOString() };
    d.itens = [item, ...d.itens].slice(0, MAX_ITENS);
    await gravar(d);
    return item;
  });
}

export function esquecer(id: string) {
  return emSerie(async () => {
    const d = await ler();
    d.itens = d.itens.filter((i) => i.id !== id);
    await gravar(d);
  });
}

export function registrarFeedback(f: Omit<Feedback, "em">) {
  return emSerie(async () => {
    const d = await ler();
    d.feedback = [{ ...f, pergunta: f.pergunta.slice(0, 500), resposta: f.resposta.slice(0, 800), em: new Date().toISOString() }, ...d.feedback].slice(0, MAX_FEEDBACK);
    await gravar(d);
  });
}

/** Trecho do system prompt com o que o Vince sabe do Igor e do que evitar. */
export async function contextoDaMemoria(): Promise<string> {
  const d = await ler();
  const partes: string[] = [];
  if (d.itens.length) {
    partes.push(`O QUE VOCÊ JÁ SABE DO IGOR (respeite sempre):\n${d.itens.slice(0, 40).map((i) => `- ${i.texto}`).join("\n")}`);
  }
  const ruins = d.feedback.filter((f) => f.nota === -1).slice(0, 6);
  if (ruins.length) {
    partes.push(
      `RESPOSTAS QUE O IGOR REPROVOU (não repita o padrão):\n${ruins
        .map((f) => `- Pergunta: "${f.pergunta.slice(0, 120)}" → resposta ruim: "${f.resposta.slice(0, 160)}"${f.comentario ? ` (motivo: ${f.comentario})` : ""}`)
        .join("\n")}`,
    );
  }
  const boas = d.feedback.filter((f) => f.nota === 1).slice(0, 3);
  if (boas.length) {
    partes.push(`RESPOSTAS QUE O IGOR APROVOU (siga o estilo):\n${boas.map((f) => `- "${f.resposta.slice(0, 160)}"`).join("\n")}`);
  }
  return partes.join("\n\n");
}

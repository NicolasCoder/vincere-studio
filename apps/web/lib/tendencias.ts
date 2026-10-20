import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { storageRoot } from "@vincere-studio/providers";

// Relatórios de tendências. A pesquisa roda no Claude do PC (vidIQ, busca, Reddit/X, notícias)
// e o resultado é gravado aqui pela skill vincere-tendencias. Regra: nenhuma sugestão sem
// evidência com fonte e data — é isso que separa pesquisa de palpite.

export const EvidenciaSchema = z.object({
  fonte: z.string().min(2).max(80), // ex.: vidIQ outliers, Google Trends, Reddit r/…, notícia
  url: z.string().url().max(500).optional(),
  dado: z.string().min(3).max(300), // o número/fato que sustenta (ex.: "outlier 38× a média do canal")
  data: z.string().max(40), // quando o dado foi observado/publicado
});

export const SugestaoSchema = z.object({
  titulo: z.string().min(3).max(160), // título de vídeo já pronto
  tema: z.string().min(3).max(200),
  nicho: z.string().max(60), // id de lib/nichos.ts ou nicho novo
  idioma: z.string().max(10), // id de lib/idiomas.ts
  mercados: z.array(z.string().max(5)).max(8),
  porque: z.string().min(10).max(600),
  foraDaCaixa: z.string().max(400).optional(), // por que não é o óbvio
  evidencias: z.array(EvidenciaSchema).min(1).max(8),
  formato: z.enum(["9:16", "16:9", "1:1"]),
  ganchos: z.array(z.string().max(200)).max(5),
  concorrencia: z.enum(["baixa", "media", "alta"]),
  confianca: z.number().min(0).max(100),
});

export const RelatorioSchema = z.object({
  resumo: z.string().max(1500),
  metodologia: z.string().max(1500),
  sugestoes: z.array(SugestaoSchema).min(1).max(20),
});

export type Sugestao = z.infer<typeof SugestaoSchema>;

export interface Relatorio {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  status: "pesquisando" | "pronto" | "erro";
  pedido: { idiomas: string[]; foco?: string; foraDaCaixa: boolean };
  resumo?: string;
  metodologia?: string;
  sugestoes?: Sugestao[];
  erro?: string;
}

const DIR = () => path.join(storageRoot(), "tendencias");
const arq = (id: string) => path.join(DIR(), `${id}.json`);

async function gravar(r: Relatorio) {
  r.atualizadoEm = new Date().toISOString();
  await fs.mkdir(DIR(), { recursive: true });
  const tmp = `${arq(r.id)}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(r, null, 2), "utf8");
  await fs.rename(tmp, arq(r.id));
}

export async function lerRelatorio(id: string): Promise<Relatorio | null> {
  if (!/^[a-f0-9]{8}$/.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(arq(id), "utf8")) as Relatorio;
  } catch {
    return null;
  }
}

export async function listarRelatorios(limite = 20): Promise<Relatorio[]> {
  const nomes = (await fs.readdir(DIR()).catch(() => [] as string[])).filter((n) => /^[a-f0-9]{8}\.json$/.test(n));
  const todos = await Promise.all(nomes.map((n) => lerRelatorio(n.slice(0, 8))));
  return todos
    .filter((r): r is Relatorio => !!r)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, limite);
}

export async function criarRelatorio(pedido: Relatorio["pedido"]): Promise<Relatorio> {
  const agora = new Date().toISOString();
  const r: Relatorio = { id: crypto.randomUUID().slice(0, 8), criadoEm: agora, atualizadoEm: agora, status: "pesquisando", pedido };
  await gravar(r);
  return r;
}

export async function concluirRelatorio(id: string, dados: z.infer<typeof RelatorioSchema>) {
  const r = await lerRelatorio(id);
  if (!r) return null;
  Object.assign(r, dados, { status: "pronto" as const, erro: undefined });
  await gravar(r);
  return r;
}

export async function falharRelatorio(id: string, erro: string) {
  const r = await lerRelatorio(id);
  if (!r) return null;
  r.status = "erro";
  r.erro = erro.slice(0, 500);
  await gravar(r);
  return r;
}

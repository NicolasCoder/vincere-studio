import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { storageRoot } from "@vincere-studio/providers";
import { createRequest } from "@/lib/claude-inbox";

// O HyperFrames roda no PC do Igor (C:\Users\Igor\Videos-HF) e chega à VPS pelo túnel
// reverso do SSH. A web nunca lê o disco do PC nem inicia processos: ela só consulta o
// preview por HTTP. Na VPS, HYPERFRAMES_URL deve apontar para a ponta do túnel.
// Prévias leves e metadados de templates chegam por scripts/hf.ps1 em storage/hyperframes.
const HYPERFRAMES_URL = process.env.HYPERFRAMES_URL || "http://localhost:3010";
const HYPERFRAMES_PORT = Number(new URL(HYPERFRAMES_URL).port || 3010);
const VIDEOS_HF_DIR = "C:\\Users\\Igor\\Videos-HF";
const HF_STORAGE = () => path.join(storageRoot(), "hyperframes");

type HfProject = { id: string; dir?: string; title?: string };

// Nome de projeto/template vira caminho no disco: só letras (com acento), números, - e _.
const NOME_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const ARQ_RE = /^previa-[\w-]+\.mp4$/;

async function listarPrevias(projeto: string) {
  const dir = path.join(HF_STORAGE(), projeto, "previas");
  const nomes = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => ARQ_RE.test(n));
  const previas = await Promise.all(
    nomes.map(async (arquivo) => {
      const st = await fs.stat(path.join(dir, arquivo));
      const decisao = await fs
        .readFile(path.join(dir, `${arquivo}.decisao.json`), "utf8")
        .then((t) => JSON.parse(t) as { decisao: string; nota?: string; em: string })
        .catch(() => null);
      return {
        arquivo,
        url: `/api/media/hyperframes/${encodeURIComponent(projeto)}/previas/${arquivo}`,
        criadaEm: st.mtime.toISOString(),
        tamanhoMB: Math.round((st.size / 1024 / 1024) * 10) / 10,
        decisao,
      };
    }),
  );
  return previas.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

async function listarTemplates() {
  const dir = path.join(HF_STORAGE(), "templates");
  const nomes = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json"));
  const itens = await Promise.all(
    nomes.map((n) =>
      fs
        .readFile(path.join(dir, n), "utf8")
        .then((t) => JSON.parse(t.replace(/^\uFEFF/, "")) as { nome: string; nicho?: string; origem?: string; criadoEm?: string; formato?: string })
        .catch(() => null),
    ),
  );
  return itens.filter((t): t is NonNullable<typeof t> => !!t?.nome);
}

// GET /api/hyperframes                          → status + projetos do PC
// GET /api/hyperframes?action=previas&projeto=   → prévias leves enviadas pelo hf.ps1
// GET /api/hyperframes?action=templates          → templates de nicho salvos
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const action = params.get("action");
  if (action === "previas") {
    const projeto = params.get("projeto") ?? "";
    if (!NOME_RE.test(projeto)) return NextResponse.json({ ok: false, error: "Projeto inválido" }, { status: 400 });
    return NextResponse.json({ ok: true, previas: await listarPrevias(projeto) });
  }
  if (action === "templates") return NextResponse.json({ ok: true, templates: await listarTemplates() });

  try {
    const res = await fetch(`${HYPERFRAMES_URL}/api/projects`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HyperFrames respondeu ${res.status}`);
    const data = (await res.json()) as { projects?: HfProject[] };
    const projects = (data.projects ?? []).map((p) => ({
      name: p.id,
      path: p.dir ?? `${VIDEOS_HF_DIR}\\${p.id}`,
      title: p.title ?? p.id,
    }));
    return NextResponse.json({
      ok: true,
      running: true,
      port: HYPERFRAMES_PORT,
      projects,
      baseDir: VIDEOS_HF_DIR,
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      running: false,
      port: HYPERFRAMES_PORT,
      projects: [],
      baseDir: VIDEOS_HF_DIR,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

const decisaoSchema = z.object({
  action: z.literal("decidir"),
  projeto: z.string().regex(NOME_RE),
  arquivo: z.string().regex(ARQ_RE),
  decisao: z.enum(["aprovado", "ajustes"]),
  nota: z.string().max(4000).optional(),
});

// POST { action: "decidir", projeto, arquivo, decisao, nota? } → registra e avisa o Claude
export async function POST(req: Request) {
  const parsed = decisaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const { projeto, arquivo, decisao, nota } = parsed.data;
  const alvo = path.join(HF_STORAGE(), projeto, "previas", arquivo);
  if (!(await fs.stat(alvo).catch(() => null))) return NextResponse.json({ ok: false, error: "Prévia não encontrada" }, { status: 404 });

  const registro = { decisao, nota: nota?.trim() || undefined, em: new Date().toISOString() };
  await fs.writeFile(`${alvo}.decisao.json`, JSON.stringify(registro, null, 2), "utf8");

  const pedido =
    decisao === "aprovado"
      ? `Prévia ${arquivo} do projeto ${projeto} APROVADA. Faça o render final (npx hyperframes render, qualidade padrão/delivery) em C:\\Users\\Igor\\Videos-HF\\${projeto}\\renders e me diga quando terminar.`
      : `Ajustes pedidos na prévia ${arquivo} do projeto ${projeto}: ${registro.nota ?? "(sem nota)"}. Aplique no HyperFrames e gere uma nova prévia com scripts/hf.ps1 previa -Projeto ${projeto}.`;
  const item = await createRequest({ pedido, pagina: "/studio", projetoHf: projeto });
  return NextResponse.json({ ok: true, registro, pedidoId: item.id });
}

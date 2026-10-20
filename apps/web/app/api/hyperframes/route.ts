import { NextResponse } from "next/server";

// O HyperFrames roda no PC do Igor (C:\Users\Igor\Videos-HF) e chega à VPS pelo túnel
// reverso do SSH. A web nunca lê o disco do PC nem inicia processos: ela só consulta o
// preview por HTTP. Na VPS, HYPERFRAMES_URL deve apontar para a ponta do túnel.
const HYPERFRAMES_URL = process.env.HYPERFRAMES_URL || "http://localhost:3010";
const HYPERFRAMES_PORT = Number(new URL(HYPERFRAMES_URL).port || 3010);
const VIDEOS_HF_DIR = "C:\\Users\\Igor\\Videos-HF";

type HfProject = { id: string; dir?: string; title?: string };

export async function GET() {
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

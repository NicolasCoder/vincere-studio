import { NextResponse } from "next/server";
import { prisma } from "@docupulse/db";

/** Vozes Edge TTS pt-BR reais (grátis, sem chave) que o node de Voz do Workflow Studio pode usar. */
const EDGE_VOICES = ["pt-BR-AntonioNeural", "pt-BR-FranciscaNeural", "pt-BR-ThalitaNeural", "pt-BR-MacerioMultilingualNeural"];

/**
 * Sintetiza o roteiro do node de Voz com Edge TTS pra um preview real (não simulado).
 * Roda via o worker (job PREVIEW_VOICE) — o pacote msedge-tts só resolve corretamente lá,
 * não no runtime do Next — e aqui só enfileira e espera o resultado (rápido: alguns segundos).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nodeId = String(body.nodeId ?? "node").replace(/[^a-zA-Z0-9_-]/g, "");
  const text = String(body.text ?? "").trim();
  const voiceId = EDGE_VOICES.includes(String(body.voiceId)) ? String(body.voiceId) : "pt-BR-FranciscaNeural";
  if (!text) return NextResponse.json({ error: "escreva o roteiro da locução antes de ouvir a prévia" }, { status: 400 });

  const job = await prisma.job.create({
    data: { type: "PREVIEW_VOICE", payload: JSON.stringify({ provider: "EDGE_TTS", voiceId, text, cacheKey: `wf-${id}-${nodeId}` }) },
  });

  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const j = await prisma.job.findUnique({ where: { id: job.id } });
    if (j?.status === "DONE") {
      const result = JSON.parse(j.result ?? "{}") as { file?: string; durationMs?: number };
      return NextResponse.json({ audioUrl: result.file, durationMs: result.durationMs, voiceId });
    }
    if (j?.status === "FAILED") return NextResponse.json({ error: j.error ?? "falha ao gerar prévia" }, { status: 500 });
    await new Promise((r) => setTimeout(r, 700));
  }
  return NextResponse.json({ error: "o worker demorou demais pra responder — confira se ele está rodando (pnpm dev)" }, { status: 504 });
}

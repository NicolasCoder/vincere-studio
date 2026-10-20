import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@vincere-studio/db";
import { EDGE_VOICES } from "@vincere-studio/providers";
import {
  QUALIDADES,
  chamarFerramenta,
  criarTarefaNarracao,
  lerResposta,
  lerTarefa,
  listarTarefas,
} from "@/lib/voicestudio";
import { prepararTextoParaFala } from "@/lib/texto-fala";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VOICESTUDIO_URL = process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900";

interface Voz {
  id: string;
  name: string;
  ref_text?: string;
  language?: string;
  kind?: string;
  type?: string;
  audio_url?: string;
}

function erro(err: unknown, status = 502) {
  return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status });
}

// GET  /api/voicestudio                       → vozes + estado (tela e dashboard)
// GET  /api/voicestudio?audio=/caminho         → amostra de voz (proxy; o navegador não alcança :3900)
// GET  /api/voicestudio?action=estilos         → personalidades (narrador, casual…)
// GET  /api/voicestudio?action=tarefa&id=…     → andamento de uma narração
// GET  /api/voicestudio?action=tarefas         → últimas narrações
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const audio = params.get("audio");
  if (audio) return proxyAudio(audio);
  const action = params.get("action");

  try {
    if (action === "tarefa") {
      const t = await lerTarefa(params.get("id") ?? "");
      return t ? NextResponse.json({ ok: true, tarefa: t }) : NextResponse.json({ ok: false, error: "Tarefa não encontrada" }, { status: 404 });
    }
    if (action === "tarefas") return NextResponse.json({ ok: true, tarefas: await listarTarefas() });
    if (action === "estilos") {
      return NextResponse.json({ ok: true, estilos: lerResposta(await chamarFerramenta("list_personalities", {})) });
    }

    const bruto = await chamarFerramenta("list_voices", {});
    let lista: Voz[];
    try {
      lista = lerResposta<Voz[]>(bruto);
    } catch {
      lista = extrairVozes(bruto); // plano B: repr Python com aspas que o conversor não cobre
    }
    const vozes = lista.map((v) => ({
      id: v.id,
      name: v.name,
      ref_text: v.ref_text ?? "",
      language: v.language ?? "pt",
      kind: v.kind ?? v.type ?? "clone",
      full_audio_url: v.audio_url ? `/api/voicestudio?audio=${encodeURIComponent(v.audio_url)}` : null,
    }));
    return NextResponse.json({ ok: true, tunnelOnline: true, voices: vozes, qualidades: QUALIDADES, edgeVoices: EDGE_VOICES });
  } catch (err) {
    return NextResponse.json({ ok: false, tunnelOnline: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

const gerarSchema = z.object({
  action: z.literal("gerar"),
  texto: z.string().trim().min(2).max(20_000),
  vozId: z.string().regex(/^[A-Za-z0-9_-]{4,40}$/),
  qualidade: z.enum(["rascunho", "equilibrado", "final"]).default("equilibrado"),
  velocidade: z.number().min(0.5).max(2).optional(),
  estilo: z.string().max(200).optional(),
  idioma: z.string().max(10).optional(),
});

const clonarSchema = z.object({
  action: z.literal("clonar"),
  nome: z.string().trim().min(2).max(60),
  audioBase64: z.string().min(1000).max(15_000_000),
  textoReferencia: z.string().max(2000).optional(),
  idioma: z.string().max(10).optional(),
});

const transcreverSchema = z.object({
  action: z.literal("transcrever"),
  audioBase64: z.string().min(1000).max(40_000_000),
  idioma: z.string().max(10).optional(),
});

const rascunhoSchema = z.object({
  action: z.literal("rascunho"),
  texto: z.string().trim().min(2).max(5000),
  vozEdge: z.string().regex(/^pt-BR-[A-Za-z]+Neural$/),
});

const prepararSchema = z.object({ action: z.literal("preparar"), texto: z.string().max(20_000) });

// POST { action: "preparar" | "gerar" | "clonar" | "transcrever" | "rascunho", … }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    switch (body?.action) {
      case "preparar": {
        const { texto } = prepararSchema.parse(body);
        return NextResponse.json({ ok: true, textoFalado: prepararTextoParaFala(texto) });
      }
      case "gerar": {
        const d = gerarSchema.parse(body);
        return NextResponse.json({ ok: true, tarefa: await criarTarefaNarracao(d) });
      }
      case "clonar": {
        const d = clonarSchema.parse(body);
        const resp = await chamarFerramenta(
          "clone_voice",
          { name: d.nome, ref_audio_base64: d.audioBase64, ref_text: d.textoReferencia ?? "", language: d.idioma || "pt" },
          5 * 60_000,
        );
        return NextResponse.json({ ok: true, voz: lerResposta(resp) });
      }
      case "transcrever": {
        const d = transcreverSchema.parse(body);
        const resp = await chamarFerramenta("transcribe", { audio_base64: d.audioBase64, ...(d.idioma ? { language: d.idioma } : {}) }, 5 * 60_000);
        return NextResponse.json({ ok: true, resultado: lerResposta(resp) });
      }
      case "rascunho": {
        // Edge TTS no worker (o pacote só resolve lá): segundos em vez de minutos, para testar ritmo.
        const d = rascunhoSchema.parse(body);
        const job = await prisma.job.create({
          data: {
            type: "PREVIEW_VOICE",
            payload: JSON.stringify({
              provider: "EDGE_TTS",
              voiceId: d.vozEdge,
              text: prepararTextoParaFala(d.texto),
              cacheKey: `rascunho-${Date.now()}`,
            }),
          },
        });
        return NextResponse.json({ ok: true, jobId: job.id });
      }
      default:
        return NextResponse.json({ ok: false, error: "Ação desconhecida" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return erro(new Error(`Dados inválidos: ${err.issues.map((i) => i.path.join(".")).join(", ")}`), 400);
    return erro(err);
  }
}

/** Extrai campos conhecidos de cada {'id': …} por regex, sem depender de JSON válido. */
function extrairVozes(raw: string): Voz[] {
  return raw
    .split(/(?=\{'id':)/)
    .map((c) => ({
      id: c.match(/'id':\s*'([^']+)'/)?.[1] ?? "",
      name: c.match(/'name':\s*'([^']+)'/)?.[1] ?? "Sem nome",
      ref_text: c.match(/'ref_text':\s*['"](.+?)['"],\s*'/s)?.[1] ?? "",
      language: c.match(/'language':\s*'([^']+)'/)?.[1] ?? "pt",
      kind: c.match(/'kind':\s*'([^']+)'/)?.[1] ?? "clone",
      audio_url: c.match(/'audio_url':\s*'([^']+)'/)?.[1],
    }))
    .filter((v) => v.id);
}

async function proxyAudio(audioPath: string) {
  // Só caminhos relativos do próprio VoiceStudio; nada de URL arbitrária.
  if (!audioPath.startsWith("/") || audioPath.startsWith("//") || audioPath.includes("..")) {
    return new NextResponse("Caminho de áudio inválido", { status: 400 });
  }
  const res = await fetch(`${VOICESTUDIO_URL}${audioPath}`, {
    headers: { authorization: `Bearer ${process.env.OMNIVOICE_API_KEY || ""}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok || !res.body) {
    return new NextResponse("Áudio indisponível no VoiceStudio", { status: res?.status ?? 502 });
  }
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "audio/wav",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

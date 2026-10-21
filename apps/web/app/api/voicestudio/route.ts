import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { prisma } from "@vincere-studio/db";
import { EDGE_VOICES, storageRoot } from "@vincere-studio/providers";
import {
  QUALIDADES,
  chamarFerramenta,
  criarTarefaNarracao,
  lerResposta,
  lerTarefa,
  listarTarefas,
} from "@/lib/voicestudio";
import { prepararTextoParaFala } from "@/lib/texto-fala";
import { callPcGpuBridge, getPcGpuStatus } from "@/lib/pc-gpu-engine";

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
  full_audio_url?: string | null;
  rvcModel?: string;
  acoustics?: Record<string, unknown>;
}

function erro(err: unknown, status = 502) {
  return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status });
}

// GET  /api/voicestudio                       → vozes (PC GPU + VPS) + estado (tela e dashboard)
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

    // 1. Carrega status e vozes do Computador Local (GPU RTX 3060: RVC V2 + F5-TTS + Faster-Whisper)
    const pcStatus = await getPcGpuStatus();
    const vozesPc: Voz[] = [];
    if (pcStatus?.ok) {
      for (const lv of pcStatus.localVoices ?? []) {
        vozesPc.push({
          id: lv.id,
          name: lv.name,
          ref_text: lv.ref_text ?? "",
          language: lv.language ?? "pt",
          kind: lv.kind ?? "local_gpu_clone",
          rvcModel: lv.rvcModel,
          acoustics: lv.acoustics,
          full_audio_url: lv.full_audio_url ?? null,
        });
      }
      for (const rm of pcStatus.rvcModels ?? []) {
        vozesPc.push({
          id: rm.id,
          name: rm.name,
          ref_text: `Modelo RVC V2 (${rm.sizeMb} MB) acelerado por GPU (${pcStatus.gpu.name})`,
          language: rm.language ?? "pt",
          kind: "rvc_gpu",
          rvcModel: rm.pthFile,
          full_audio_url: vozesPc[0]?.full_audio_url ?? null,
        });
      }
    }

    // 2. Tenta carregar também vozes da VPS (se túnel :3900 estiver ativo)
    let vpsOnline = false;
    const vozesVps: Voz[] = [];
    try {
      const bruto = await chamarFerramenta("list_voices", {}, 3500);
      let lista: Voz[];
      try {
        lista = lerResposta<Voz[]>(bruto);
      } catch {
        lista = extrairVozes(bruto);
      }
      for (const v of lista) {
        vozesVps.push({
          id: v.id,
          name: `${v.name} (VPS)`,
          ref_text: v.ref_text ?? "",
          language: v.language ?? "pt",
          kind: v.kind ?? v.type ?? "clone",
          full_audio_url: v.audio_url ? `/api/voicestudio?audio=${encodeURIComponent(v.audio_url)}` : null,
        });
      }
      vpsOnline = true;
    } catch {
      vpsOnline = false;
    }

    const vozes = [...vozesPc, ...vozesVps];
    const anyOnline = Boolean(pcStatus?.ok || vpsOnline);

    return NextResponse.json({
      ok: anyOnline,
      tunnelOnline: anyOnline,
      pcGpuOnline: Boolean(pcStatus?.gpu?.available),
      vpsOnline,
      pcGpu: pcStatus
        ? {
            gpu: pcStatus.gpu,
            engines: pcStatus.engines,
            rvcModelsCount: pcStatus.rvcModels.length,
            localVoicesCount: pcStatus.localVoices.length,
          }
        : null,
      voices: vozes,
      qualidades: QUALIDADES,
      edgeVoices: EDGE_VOICES,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, tunnelOnline: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

const gerarSchema = z.object({
  action: z.literal("gerar"),
  texto: z.string().trim().min(2).max(20_000),
  vozId: z.string().regex(/^[A-Za-z0-9_.:-]{3,80}$/),
  qualidade: z.enum(["rascunho", "equilibrado", "final"]).default("equilibrado"),
  velocidade: z.number().min(0.5).max(2).optional(),
  estilo: z.string().max(200).optional(),
  idioma: z.string().max(10).optional(),
  engine: z.enum(["PC_GPU", "VPS_CPU", "AUTO"]).optional().default("PC_GPU"),
  pitch: z.number().min(-12).max(12).optional().default(0),
});

const clonarSchema = z.object({
  action: z.literal("clonar"),
  nome: z.string().trim().min(2).max(60),
  audioBase64: z.string().min(1000).max(25_000_000),
  textoReferencia: z.string().max(2000).optional(),
  idioma: z.string().max(10).optional(),
  rvcModel: z.string().max(120).optional(),
  engine: z.enum(["PC_GPU", "VPS_CPU", "AUTO"]).optional().default("PC_GPU"),
});

const transcreverSchema = z.object({
  action: z.literal("transcrever"),
  audioBase64: z.string().min(1000).max(40_000_000),
  idioma: z.string().max(10).optional(),
  modelSize: z.enum(["base", "medium", "large-v3"]).optional().default("base"),
  engine: z.enum(["PC_GPU", "VPS_CPU", "AUTO"]).optional().default("PC_GPU"),
});

const rascunhoSchema = z.object({
  action: z.literal("rascunho"),
  texto: z.string().trim().min(2).max(5000),
  vozEdge: z.string().regex(/^[a-z]{2}-[A-Z0-9]{2,3}-[A-Za-z]+Neural$/),
});

const prepararSchema = z.object({ action: z.literal("preparar"), texto: z.string().max(20_000), idioma: z.string().max(10).optional() });

const ehPt = (idioma?: string) => !idioma || idioma.startsWith("pt");

// POST { action: "preparar" | "gerar" | "clonar" | "transcrever" | "rascunho", … }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    switch (body?.action) {
      case "preparar": {
        const { texto, idioma } = prepararSchema.parse(body);
        return NextResponse.json({ ok: true, textoFalado: ehPt(idioma) ? prepararTextoParaFala(texto) : texto });
      }
      case "gerar": {
        const d = gerarSchema.parse(body);
        return NextResponse.json({ ok: true, tarefa: await criarTarefaNarracao(d) });
      }
      case "clonar": {
        const d = clonarSchema.parse(body);
        if (d.engine !== "VPS_CPU") {
          try {
            const pcRes = await callPcGpuBridge<{
              ok: boolean;
              voice: Voz;
              acoustics: Record<string, unknown>;
              transcription?: { text?: string };
            }>(
              "analyze_voice_for_cloning",
              {
                name: d.nome,
                audioBase64: d.audioBase64,
                refText: d.textoReferencia ?? "",
                language: d.idioma || "pt",
                rvcModel: d.rvcModel ?? "",
              },
              300_000,
            );
            if (pcRes?.ok) {
              return NextResponse.json({
                ok: true,
                motor: "PC_GPU",
                voz: pcRes.voice,
                acoustics: pcRes.acoustics,
                transcription: pcRes.transcription,
              });
            }
          } catch (pcErr) {
            if (d.engine === "PC_GPU") throw pcErr;
          }
        }
        const resp = await chamarFerramenta(
          "clone_voice",
          { name: d.nome, ref_audio_base64: d.audioBase64, ref_text: d.textoReferencia ?? "", language: d.idioma || "pt" },
          5 * 60_000,
        );
        return NextResponse.json({ ok: true, motor: "VPS_CPU", voz: lerResposta(resp) });
      }
      case "transcrever": {
        const d = transcreverSchema.parse(body);
        if (d.engine !== "VPS_CPU") {
          const tmpDir = path.join(storageRoot(), "voicestudio", "tmp");
          await fs.mkdir(tmpDir, { recursive: true });
          const tmpFile = path.join(tmpDir, `trans-${crypto.randomUUID()}.wav`);
          try {
            await fs.writeFile(tmpFile, Buffer.from(d.audioBase64, "base64"));
            const pcRes = await callPcGpuBridge<{
              ok: boolean;
              text: string;
              words: { word: string; start: number; end: number; probability?: number }[];
              device: string;
              gpuName: string;
              duration_s: number;
              elapsed_s: number;
            }>(
              "transcribe",
              {
                audioPath: tmpFile,
                language: d.idioma || "pt",
                modelSize: d.modelSize || "base",
              },
              240_000,
            );
            await fs.rm(tmpFile).catch(() => {});
            if (pcRes?.ok) {
              return NextResponse.json({
                ok: true,
                motor: "PC_GPU",
                resultado: pcRes,
              });
            }
          } catch (pcErr) {
            await fs.rm(tmpFile).catch(() => {});
            if (d.engine === "PC_GPU") throw pcErr;
          }
        }
        const resp = await chamarFerramenta("transcribe", { audio_base64: d.audioBase64, ...(d.idioma ? { language: d.idioma } : {}) }, 5 * 60_000);
        return NextResponse.json({ ok: true, motor: "VPS_CPU", resultado: lerResposta(resp) });
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
              // Por extenso só em português; a voz Edge define o idioma.
              text: d.vozEdge.startsWith("pt-") ? prepararTextoParaFala(d.texto) : d.texto,
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

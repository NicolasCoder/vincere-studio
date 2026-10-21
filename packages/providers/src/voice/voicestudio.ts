import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { probeDurationMs } from "../media/ffmpeg";
import { storageRoot } from "../media/storage";
import { ProviderError } from "../types";
import type { VoiceProvider, VoiceRequest, VoiceResult } from "./types";

/**
 * VoiceStudio — vozes clonadas e RVC, no PC com GPU ou na nuvem (VPS), conforme o motor da Central
 * de Vozes. Em vez de reimplementar a fila, o worker pede a narração à API do próprio Vincere
 * (`/api/voicestudio`) e espera a tarefa ficar pronta; assim texto-fala, trechos e escolha de motor
 * seguem a mesma lógica da tela. voiceId = id da voz no VoiceStudio.
 */
const WEB = () => (process.env.VINCERE_WEB_URL || "http://127.0.0.1:3210").replace(/\/$/, "");
const QUALIDADE = () => process.env.VOICESTUDIO_QUALIDADE || "equilibrado";
const ESPERA_MAX_MS = () => Number(process.env.VOICESTUDIO_ESPERA_MAX_MS ?? 25 * 60_000);

interface Tarefa {
  status: "fila" | "gerando" | "pronto" | "erro";
  arquivo?: string;
  erro?: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || !json || json.ok === false) throw new ProviderError(`VoiceStudio: ${json?.error ?? `HTTP ${res.status}`}`);
  return json;
}

export class VoiceStudioVoiceProvider implements VoiceProvider {
  readonly name = "VOICESTUDIO";

  voices() {
    // As vozes vêm da Central de Vozes (GET /api/voicestudio); não há lista fixa aqui.
    return [];
  }

  async synthesize(req: VoiceRequest, outFile: string): Promise<VoiceResult> {
    const criada = await api<{ tarefa: { id: string } }>(`${WEB()}/api/voicestudio`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "gerar",
        texto: req.text,
        vozId: req.voiceId,
        qualidade: QUALIDADE(),
        velocidade: req.rate && req.rate !== 1 ? req.rate : undefined,
        idioma: req.language?.slice(0, 2),
      }),
    });

    const limite = Date.now() + ESPERA_MAX_MS();
    let t: Tarefa = { status: "fila" };
    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 4000));
      t = (await api<{ tarefa: Tarefa }>(`${WEB()}/api/voicestudio?action=tarefa&id=${criada.tarefa.id}`)).tarefa;
      if (t.status === "pronto" || t.status === "erro") break;
    }
    if (t.status === "erro") throw new ProviderError(`VoiceStudio: ${t.erro ?? "falha ao narrar"}`);
    if (t.status !== "pronto" || !t.arquivo) throw new ProviderError("VoiceStudio: tempo esgotado esperando a narração");

    await mkdir(path.dirname(outFile), { recursive: true });
    await copyFile(path.join(storageRoot(), t.arquivo), outFile);
    return {
      file: outFile,
      durationMs: await probeDurationMs(outFile),
      provider: this.name,
      voiceId: req.voiceId,
      costUsd: 0,
      units: req.text.length,
    };
  }
}

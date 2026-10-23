import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const BRIDGE_HTTP_URL = process.env.PC_GPU_BRIDGE_URL || "http://127.0.0.1:9335";

function findBridgeScript(): string {
  const candidates = [
    path.resolve(process.cwd(), "scripts", "pc-gpu-bridge.py"),
    path.resolve(process.cwd(), "..", "..", "scripts", "pc-gpu-bridge.py"),
      ];
  return candidates[0];
}

async function resolveBridgeScript(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), "scripts", "pc-gpu-bridge.py"),
    path.resolve(process.cwd(), "..", "..", "scripts", "pc-gpu-bridge.py"),
      ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {}
  }
  return null;
}

export interface PcGpuStatus {
  ok: boolean;
  pcOnline: boolean;
  gpu: {
    available: boolean;
    name: string;
    vramTotalMb: number;
    vramFreeMb: number;
    vramUsedMb: number;
    utilizationPct: number;
  };
  ollama: {
    online: boolean;
    models: string[];
  };
  engines: {
    sharinganCli: boolean;
    reelsToolsVenv: boolean;
    rvcV2Gpu: boolean;
    f5TtsGpu: boolean;
    fasterWhisperGpu: boolean;
    crisperWhisperGpu: boolean;
  };
  rvcModels: {
    id: string;
    name: string;
    pthFile: string;
    pthPath: string;
    indexPath: string | null;
    sizeMb: number;
    kind: string;
    language: string;
  }[];
  localVoices: {
    id: string;
    name: string;
    ref_text: string;
    language: string;
    kind: string;
    rvcModel?: string;
    audioPath?: string;
    relAudioPath?: string;
    full_audio_url: string | null;
    acoustics?: {
      duration_s?: number;
      sampleRate?: number;
      snrDb?: number;
      voicedPct?: number;
      medianF0Hz?: number;
      voiceType?: string;
      qualityVerdict?: string;
    };
  }[];
}

/**
 * Executa uma ação pesada no PC do usuário (GPU Local RTX 3060):
 * 1. Tenta o daemon HTTP local/túnel SSH (`http://127.0.0.1:9335`)
 * 2. Se não estiver rodando como daemon separado, invoca `scripts/pc-gpu-bridge.py` direto no PC.
 */
export async function callPcGpuBridge<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 180_000,
): Promise<T> {
  // 1. Tenta daemon HTTP (útil tanto no PC quanto via túnel reverso SSH na VPS)
  try {
    const res = await fetch(BRIDGE_HTTP_URL, {
      method: action === "status" && Object.keys(payload).length === 0 ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-bridge-token": process.env.PC_GPU_TOKEN ?? "" },
      body: action === "status" && Object.keys(payload).length === 0 ? undefined : JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, action === "status" ? 2000 : timeoutMs)),
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch {
    // Segue para execução local via processo Python se estivermos na máquina Windows/Local
  }

  // 2. Execução direta via CLI Python local no PC
  const scriptPath = (await resolveBridgeScript()) ?? findBridgeScript();
  return new Promise<T>((resolve, reject) => {
    const proc = spawn("python", [scriptPath, action, JSON.stringify({ action, ...payload })], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout (${Math.round(timeoutMs / 1000)}s) aguardando PC GPU Bridge em '${action}'`));
    }, timeoutMs);

    proc.stdout.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const lines = out.trim().split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] ?? "";
      try {
        const parsed = JSON.parse(lastLine) as T;
        resolve(parsed);
      } catch {
        reject(new Error(`PC GPU Bridge (${action}) falhou (code ${code}): ${(err || out).slice(-400)}`));
      }
    });
  });
}

export async function getPcGpuStatus(): Promise<PcGpuStatus | null> {
  try {
    return await callPcGpuBridge<PcGpuStatus>("status", {}, 6000);
  } catch {
    return null;
  }
}

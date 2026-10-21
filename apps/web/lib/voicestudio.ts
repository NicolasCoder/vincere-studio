import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { EdgeVoiceProvider, probeDurationMs, storageRoot } from "@vincere-studio/providers";
import { alinharPalavras, dividirEmTrechos, gerarSrt, limparMarcacoes, prepararTextoParaFala } from "@/lib/texto-fala";
import { callPcGpuBridge, getPcGpuStatus } from "@/lib/pc-gpu-engine";

// Cliente do VoiceStudio (container na VPS, MCP em :3900). Tudo de voz passa por aqui no
// servidor; o navegador nunca fala com a porta 3900 nem vê a chave.

const URL_BASE = process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900";
const KEY = () => process.env.OMNIVOICE_API_KEY || "";

export const QUALIDADES = {
  rascunho: { steps: 8, label: "Rascunho", dica: "Rápido, para testar ritmo e texto" },
  equilibrado: { steps: 16, label: "Equilibrado", dica: "Bom para a maioria dos vídeos" },
  final: { steps: 32, label: "Final", dica: "Máxima qualidade (cerca de 2× mais lento)" },
} as const;
export type Qualidade = keyof typeof QUALIDADES;

async function rpc(sessionId: string | null, body: Record<string, unknown>, timeoutMs = 30_000) {
  if (!KEY()) throw new Error("OMNIVOICE_API_KEY ausente no .env do servidor.");
  const res = await fetch(`${URL_BASE}/mcp/`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${KEY()}`,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`VoiceStudio ${res.status}: ${raw.slice(0, 200)}`);
  const line = raw.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const json = line ? JSON.parse(line.slice(5).trim()) : raw ? JSON.parse(raw) : {};
  if (json.error) throw new Error(`VoiceStudio: ${JSON.stringify(json.error).slice(0, 200)}`);
  return { json, session: res.headers.get("mcp-session-id") };
}

async function abrirSessao() {
  const init = await rpc(null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "vincere-studio-web", version: "2.0.0" } },
  });
  const sid = init.session;
  await rpc(sid, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  return sid;
}

/** Chama uma ferramenta do VoiceStudio e devolve o texto da resposta (JSON ou dict Python). */
export async function chamarFerramenta(nome: string, args: Record<string, unknown>, timeoutMs = 60_000): Promise<string> {
  const sid = await abrirSessao();
  const { json } = await rpc(sid, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: nome, arguments: args } }, timeoutMs);
  const r = json.result;
  if (r?.isError) throw new Error(String(r.content?.[0]?.text ?? "erro do VoiceStudio").slice(0, 300));
  return (r?.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");
}

/** O VoiceStudio às vezes responde com repr de dict Python; converte para JSON quando possível. */
export function lerResposta<T>(texto: string): T {
  try {
    return JSON.parse(texto) as T;
  } catch {
    const js = texto
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      // Strings em aspas simples OU duplas (o Python usa duplas quando o texto tem apóstrofo).
      .replace(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g, (_m, simples?: string, duplas?: string) =>
        JSON.stringify((simples ?? duplas ?? "").replace(/\\(['"\\])/g, "$1")),
      );
    return JSON.parse(js) as T;
  }
}

// ---------------------------------------------------------------------------------------------
// Geração em segundo plano. O VoiceStudio roda em CPU (~1 min por frase), então a requisição só
// cria a tarefa; o navegador acompanha por /api/voicestudio?action=tarefa&id=…

export interface TarefaVoz {
  id: string;
  status: "fila" | "gerando" | "pronto" | "erro";
  criadoEm: string;
  atualizadoEm: string;
  textoOriginal: string;
  textoFalado: string;
  trechos: number;
  feitos: number;
  vozId: string;
  qualidade: Qualidade;
  motor?: "PC_GPU" | "VPS_CPU";
  arquivo?: string; // relativo ao storage, servido por /api/media/…
  legendas?: { words: string; srt: string }; // words.json (subtitles-studio/HyperFrames) e .srt
  duracaoS?: number;
  erro?: string;
}

const DIR = () => path.join(storageRoot(), "voicestudio");
const TAREFA = (id: string) => path.join(DIR(), "tarefas", `${id}.json`);

async function salvarTarefa(t: TarefaVoz) {
  t.atualizadoEm = new Date().toISOString();
  await fs.mkdir(path.dirname(TAREFA(t.id)), { recursive: true });
  const tmp = `${TAREFA(t.id)}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(t, null, 2), "utf8");
  await fs.rename(tmp, TAREFA(t.id));
}

export async function lerTarefa(id: string): Promise<TarefaVoz | null> {
  if (!/^[a-f0-9-]{8,40}$/.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(TAREFA(id), "utf8")) as TarefaVoz;
  } catch {
    return null;
  }
}

export async function listarTarefas(limite = 12): Promise<TarefaVoz[]> {
  const dir = path.join(DIR(), "tarefas");
  const nomes = await fs.readdir(dir).catch(() => [] as string[]);
  const tarefas = await Promise.all(nomes.filter((n) => n.endsWith(".json")).map((n) => lerTarefa(n.replace(/\.json$/, ""))));
  return tarefas
    .filter((t): t is TarefaVoz => !!t)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, limite);
}

/** Junta WAVs PCM do mesmo formato (mesmo motor) com um pequeno silêncio entre trechos. */
/** Silêncio entre trechos; entra no áudio e no cálculo das legendas. */
const PAUSA_MS = 180;

export function juntarWavs(wavs: Buffer[], pausaMs = PAUSA_MS): Buffer {
  const lerChunks = (b: Buffer) => {
    let fmt: Buffer | null = null;
    let data: Buffer | null = null;
    for (let o = 12; o + 8 <= b.length; ) {
      const id = b.toString("ascii", o, o + 4);
      const size = b.readUInt32LE(o + 4);
      const corpo = b.subarray(o + 8, o + 8 + size);
      if (id === "fmt ") fmt = corpo;
      if (id === "data") data = corpo;
      o += 8 + size + (size % 2);
    }
    if (!fmt || !data) throw new Error("WAV inválido devolvido pelo VoiceStudio");
    return { fmt: fmt as Buffer, data: data as Buffer };
  };
  const partes = wavs.map(lerChunks);
  const fmt = partes[0].fmt;
  const byteRate = fmt.readUInt32LE(8);
  const blockAlign = fmt.readUInt16LE(12);
  const silencio = Buffer.alloc(Math.floor((byteRate * pausaMs) / 1000 / blockAlign) * blockAlign);
  const dados = Buffer.concat(partes.flatMap((p, i) => (i ? [silencio, p.data] : [p.data])));
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + 8 + fmt.length + 8 + dados.length, 4);
  header.write("WAVE", 8, "ascii");
  const fmtHeader = Buffer.alloc(8);
  fmtHeader.write("fmt ", 0, "ascii");
  fmtHeader.writeUInt32LE(fmt.length, 4);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(dados.length, 4);
  return Buffer.concat([header, fmtHeader, fmt, dataHeader, dados]);
}

// Uma geração por vez: o VoiceStudio usa todos os núcleos da CPU; duas em paralelo só ficam lentas.
let filaVoz: Promise<unknown> = Promise.resolve();

export async function criarTarefaNarracao(input: {
  texto: string;
  vozId: string;
  qualidade: Qualidade;
  velocidade?: number;
  estilo?: string;
  idioma?: string;
  engine?: "PC_GPU" | "VPS_CPU" | "AUTO";
  pitch?: number;
}): Promise<TarefaVoz> {
  // Divide o texto ORIGINAL (o que a legenda mostra) e prepara cada trecho para a fala: assim
  // trecho falado e trecho exibido se correspondem 1:1 e as legendas saem alinhadas.
  const trechosOriginais = dividirEmTrechos(limparMarcacoes(input.texto));
  // Números/moedas por extenso só em português; em outros idiomas o motor já lê bem.
  const ehPortugues = !input.idioma || input.idioma.startsWith("pt");
  const trechos = ehPortugues ? trechosOriginais.map(prepararTextoParaFala) : trechosOriginais;
  const textoFalado = trechos.join(" ");
  const agora = new Date().toISOString();

  const isLocalVoiceId = input.vozId.startsWith("rvc:") || input.vozId.startsWith("local_");
  const preferPcGpu = input.engine !== "VPS_CPU" && (input.engine === "PC_GPU" || isLocalVoiceId || !KEY());

  const tarefa: TarefaVoz = {
    id: crypto.randomUUID(),
    status: "fila",
    criadoEm: agora,
    atualizadoEm: agora,
    textoOriginal: input.texto,
    textoFalado,
    trechos: trechos.length,
    feitos: 0,
    vozId: input.vozId,
    qualidade: input.qualidade,
    motor: preferPcGpu ? "PC_GPU" : "VPS_CPU",
  };
  await salvarTarefa(tarefa);

  const executarNoPcGpu = async () => {
    tarefa.status = "gerando";
    tarefa.motor = "PC_GPU";
    await salvarTarefa(tarefa);

    const outDir = path.join(storageRoot(), "voicestudio", "narracoes");
    await fs.mkdir(outDir, { recursive: true });
    const baseWav = path.join(outDir, `${tarefa.id}_base.wav`);
    const finalWav = path.join(outDir, `${tarefa.id}.wav`);

    const edge = new EdgeVoiceProvider();
    const edgeVoiceId = ehPortugues ? "pt-BR-AntonioNeural" : "en-US-ChristopherNeural";
    const duracoes: number[] = [];
    const wavBuffers: Buffer[] = [];

    for (let i = 0; i < trechos.length; i++) {
      const segPath = path.join(outDir, `${tarefa.id}_seg_${i}.wav`);
      await edge.synthesize(
        {
          text: trechos[i]!,
          voiceId: edgeVoiceId,
          rate: input.velocidade ?? 1,
          language: input.idioma || "pt-BR",
        },
        segPath,
      );
      const buf = await fs.readFile(segPath);
      const durMs = await probeDurationMs(segPath).catch(() => Math.max(800, trechos[i]!.length * 65));
      wavBuffers.push(buf);
      duracoes.push(durMs / 1000);
      await fs.rm(segPath).catch(() => {});
      tarefa.feitos++;
      await salvarTarefa(tarefa);
    }

    const joined = juntarWavs(wavBuffers);
    await fs.writeFile(baseWav, joined);

    // Verifica se devemos aplicar conversão de timbre RVC V2 na GPU do PC (RTX 3060)
    let rvcModelPth = "";
    if (input.vozId.startsWith("rvc:")) {
      rvcModelPth = input.vozId.slice(4);
    } else {
      const pcStatus = await getPcGpuStatus();
      const localMatch = pcStatus?.localVoices.find((v) => v.id === input.vozId);
      if (localMatch?.rvcModel) {
        rvcModelPth = localMatch.rvcModel;
      } else if (pcStatus?.rvcModels?.[0]?.pthFile) {
        rvcModelPth = pcStatus.rvcModels[0].pthFile;
      }
    }

    if (rvcModelPth) {
      try {
        await callPcGpuBridge(
          "rvc_convert",
          {
            inputWav: baseWav,
            outputWav: finalWav,
            modelPth: rvcModelPth,
            pitch: input.pitch ?? 0,
          },
          300_000,
        );
        await fs.rm(baseWav).catch(() => {});
      } catch {
        // Se o RVC falhar por qualquer motivo, preserva o áudio neural base
        await fs.rename(baseWav, finalWav);
      }
    } else {
      await fs.rename(baseWav, finalWav);
    }

    const duracao = duracoes.reduce((a, b) => a + b, 0);
    const rel = `voicestudio/narracoes/${tarefa.id}.wav`;
    tarefa.arquivo = rel;
    tarefa.duracaoS = Math.round(duracao * 10) / 10;

    // Tenta alinhar palavra por palavra via Faster-Whisper na GPU do PC; fallback para alinhamento proporcional exato
    let palavras = alinharPalavras(trechosOriginais, duracoes, PAUSA_MS / 1000, ehPortugues);
    try {
      const whisperRes = await callPcGpuBridge<{
        ok?: boolean;
        words?: { word: string; start: number; end: number }[];
      }>("transcribe", { audioPath: finalWav, language: ehPortugues ? "pt" : input.idioma || "pt", modelSize: "base" }, 90_000);
      if (whisperRes?.ok && Array.isArray(whisperRes.words) && whisperRes.words.length > 0) {
        palavras = whisperRes.words.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        }));
      }
    } catch {}

    const total = duracao + (PAUSA_MS * Math.max(0, trechos.length - 1)) / 1000;
    const base = `voicestudio/narracoes/${tarefa.id}`;
    await fs.writeFile(
      path.join(storageRoot(), `${base}.words.json`),
      JSON.stringify({ clip: `${tarefa.id}.wav`, duration: Math.round(total * 1000) / 1000, text: trechosOriginais.join(" "), words: palavras }, null, 2),
    );
    await fs.writeFile(path.join(storageRoot(), `${base}.srt`), gerarSrt(palavras));
    tarefa.legendas = { words: `${base}.words.json`, srt: `${base}.srt` };
    tarefa.status = "pronto";
    await salvarTarefa(tarefa);
  };

  const executarNaVps = async () => {
    tarefa.status = "gerando";
    await salvarTarefa(tarefa);
    const wavs: Buffer[] = [];
    const duracoes: number[] = [];
    let duracao = 0;
    for (const trecho of trechos) {
      const resp = lerResposta<{ wav_base64?: string; audio_duration_s?: number }>(
        await chamarFerramenta(
          "generate_speech",
          {
            text: trecho,
            language: input.idioma || "pt",
            profile_id: input.vozId,
            steps: QUALIDADES[input.qualidade].steps,
            speed: input.velocidade ?? 1,
            ...(input.estilo ? { instruct: input.estilo } : {}),
          },
          15 * 60_000,
        ),
      );
      if (!resp.wav_base64) throw new Error("O VoiceStudio não devolveu o áudio (modo de saída diferente de 'resources').");
      wavs.push(Buffer.from(resp.wav_base64, "base64"));
      duracao += resp.audio_duration_s ?? 0;
      duracoes.push(resp.audio_duration_s ?? 0);
      tarefa.feitos++;
      await salvarTarefa(tarefa);
    }
    const rel = `voicestudio/narracoes/${tarefa.id}.wav`;
    await fs.mkdir(path.join(storageRoot(), "voicestudio", "narracoes"), { recursive: true });
    await fs.writeFile(path.join(storageRoot(), rel), juntarWavs(wavs));
    tarefa.arquivo = rel;
    tarefa.duracaoS = Math.round(duracao * 10) / 10;

    const palavras = alinharPalavras(trechosOriginais, duracoes, PAUSA_MS / 1000, ehPortugues);
    const total = duracao + PAUSA_MS * Math.max(0, trechos.length - 1) / 1000;
    const base = `voicestudio/narracoes/${tarefa.id}`;
    await fs.writeFile(
      path.join(storageRoot(), `${base}.words.json`),
      JSON.stringify({ clip: `${tarefa.id}.wav`, duration: Math.round(total * 1000) / 1000, text: trechosOriginais.join(" "), words: palavras }, null, 2),
    );
    await fs.writeFile(path.join(storageRoot(), `${base}.srt`), gerarSrt(palavras));
    tarefa.legendas = { words: `${base}.words.json`, srt: `${base}.srt` };
    tarefa.status = "pronto";
    await salvarTarefa(tarefa);
  };

  const executar = async () => {
    if (preferPcGpu) {
      return executarNoPcGpu();
    }
    try {
      return await executarNaVps();
    } catch {
      return executarNoPcGpu();
    }
  };

  filaVoz = filaVoz
    .then(executar)
    .catch(async (err) => {
      tarefa.status = "erro";
      tarefa.erro = err instanceof Error ? err.message : String(err);
      await salvarTarefa(tarefa).catch(() => {});
    });
  return tarefa;
}

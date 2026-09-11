import path from "node:path";
import { mkdir } from "node:fs/promises";
import { FFMPEG, run } from "@docupulse/providers";
import { fitScenesToVoice, type Timeline, type TimelineAct } from "./timeline";

/**
 * Recorta a timeline numa amostra curta, para render de prova.
 *
 * A ideia é responder "o vídeo vai sair bom?" sem pagar os 20 e poucos minutos do render inteiro.
 * Não é um trecho só: são janelas de atos diferentes, porque defeito costuma aparecer no meio e
 * no fim — a legenda que balançava, por exemplo, só se via quando o trecho quebrava em duas
 * linhas, o que não acontece nos primeiros segundos.
 *
 * Passa pelo MESMO renderTimeline do render final. Uma prévia por outro caminho provaria o outro
 * caminho, não o render.
 */

export interface OpcoesAmostra {
  /** Quanto tempo de cada ato entra na amostra. */
  janelaMs?: number;
  /** Quantos atos amostrar, espalhados do começo ao fim. */
  maxAtos?: number;
  /** Onde gravar os trechos de voz recortados. */
  workDir: string;
}

/**
 * Empurra o fim da janela para o silêncio entre palavras mais próximo do alvo.
 *
 * Cortar no milissegundo exato pega a narração no meio de uma palavra, e o resultado soa como
 * defeito em vez de amostra — foi o primeiro reparo de quem assistiu. Amostra corta frase pela
 * metade por natureza; o que ela não precisa fazer é cortar sílaba.
 *
 * Tolerância de 1,2s para os dois lados: se não houver pausa por perto, mantém o alvo em vez de
 * deformar a janela atrás de um silêncio distante.
 */
function fimNaPausa(words: { endMs: number }[], alvoMs: number, maxMs: number, toleranciaMs = 1200): number {
  if (!words.length) return alvoMs;
  let melhor = alvoMs;
  let menorDist = Infinity;
  for (const w of words) {
    if (w.endMs > maxMs) break;
    const dist = Math.abs(w.endMs - alvoMs);
    if (dist < menorDist) {
      menorDist = dist;
      melhor = w.endMs;
    }
  }
  if (menorDist > toleranciaMs) return alvoMs;
  // Um respiro depois da última palavra: cortar exatamente no fim dela ainda come o final do som.
  return Math.min(maxMs, melhor + 180);
}

/** Índices espalhados uniformemente de 0 a n-1 — começo, meio(s) e fim. */
function espalhados(n: number, quantos: number): number[] {
  if (n <= quantos) return Array.from({ length: n }, (_, i) => i);
  if (quantos === 1) return [0];
  return Array.from({ length: quantos }, (_, i) => Math.round((i * (n - 1)) / (quantos - 1)));
}

export async function amostrarTimeline(t: Timeline, o: OpcoesAmostra): Promise<Timeline> {
  const janelaMs = o.janelaMs ?? 7000;
  const maxAtos = o.maxAtos ?? 3;
  await mkdir(o.workDir, { recursive: true });

  const escolhidos = espalhados(t.acts.length, maxAtos);
  const acts: TimelineAct[] = [];

  for (const i of escolhidos) {
    const a = t.acts[i];
    const janela = fimNaPausa(a.words, Math.min(janelaMs, a.voiceDurationMs), a.voiceDurationMs);
    if (janela < 500) continue;

    const ext = path.extname(a.voiceFile) || ".wav";
    const voz = path.join(o.workDir, `amostra-ato${a.act}${ext}`);
    // Reencoda em vez de copiar: corte por cópia cai no pacote anterior e a janela sai com uma
    // duração ligeiramente diferente da pedida, que é o bastante para a legenda desencontrar.
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", a.voiceFile, "-t", (janela / 1000).toFixed(3), voz]);

    // Só as cenas que cabem na janela, e nunca menos de uma — senão o ato vira cartão de título.
    const cenas: typeof a.scenes = [];
    let acc = 0;
    for (const s of a.scenes) {
      cenas.push(s);
      acc += s.durationMs;
      if (acc >= janela) break;
    }

    acts.push({
      ...a,
      voiceFile: voz,
      voiceDurationMs: janela,
      scenes: fitScenesToVoice(cenas.length ? cenas : a.scenes.slice(0, 1), janela),
      // As palavras são relativas ao ato, então as da janela continuam válidas sem deslocamento.
      words: a.words.filter((w) => w.startMs < janela).map((w) => ({ ...w, endMs: Math.min(w.endMs, janela) })),
    });
  }

  return { ...t, acts };
}

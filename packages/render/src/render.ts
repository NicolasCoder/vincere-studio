import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FFMPEG, run } from "@docupulse/providers";
import type { RenderProfile } from "./profiles";
import type { Timeline, TimelineScene } from "./timeline";
import { buildAss } from "./captions";

export interface RenderOptions {
  profile: RenderProfile;
  captions: "subtle-bottom" | "bold-center-animated" | "none";
  transitionMs?: number;
  workDir: string; // pasta de temporários (absoluta)
  outFile: string; // mp4 final (absoluto)
  onProgress?: (p: { percent: number; message: string }) => void | Promise<void>;
  onLog?: (line: string) => void | Promise<void>;
  encoder?: "auto" | "libx264" | "h264_qsv" | "h264_nvenc";
  grading?: string; // rótulo apenas informativo por enquanto
  fontFile?: string;
}

/** Quebra texto em linhas de até N caracteres (drawtext não quebra sozinho). */
function wrapText(text: string, max: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4).join("\n");
}
const winFont = () => (process.platform === "win32" ? "C:/Windows/Fonts/segoeui.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf");
const ffPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

/** Filtro de "cobrir" o quadro mantendo proporção. */
const cover = (W: number, H: number) => `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;

function kenBurns(motion: TimelineScene["motion"], W: number, H: number, fps: number, durationMs: number) {
  const frames = Math.max(2, Math.round((durationMs / 1000) * fps));
  const z = "1.10";
  switch (motion) {
    case "slow-zoom-in":
      return `zoompan=z='1+0.10*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps}`;
    case "slow-pan":
      return `zoompan=z='${z}':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps}`;
    case "gentle-float":
      return `zoompan=z='1.06+0.03*sin(on/${Math.max(1, frames / 3)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+(ih*0.01)*sin(on/${Math.max(1, frames / 2)})':d=${frames}:s=${W}x${H}:fps=${fps}`;
    default:
      return `fps=${fps}`;
  }
}

/**
 * "Foto emoldurada": composição vintage com fundo desfocado/escurecido + a foto centralizada com
 * moldura creme, vinheta e grão sutil, e um leve zoom geral. Inspirado em cortes de documentário
 * que usam esse tratamento para dar destaque a uma foto de arquivo específica.
 */
function framedPhoto(W: number, H: number, fps: number, durationMs: number): string {
  const frames = Math.max(2, Math.round((durationMs / 1000) * fps));
  const boxW = Math.round(W * 0.78);
  const boxH = Math.round(H * 0.78);
  const border = Math.max(14, Math.round(W * 0.017));
  return (
    `split=2[bgsrc][fgsrc];` +
    `[bgsrc]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,boxblur=24:3,eq=brightness=-0.12:saturation=0.55[bg];` +
    `[fgsrc]scale=${boxW}:${boxH}:force_original_aspect_ratio=decrease,pad=iw+${border * 2}:ih+${border * 2}:${border}:${border}:color=0xF3ECDD,vignette=PI/3.4,eq=saturation=0.82:contrast=1.05,noise=alls=7:allf=t+u[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,zoompan=z='1.0+0.05*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps},format=yuv420p[vout]`
  );
}

// Seleção determinística de "algumas fotos apenas" para a moldura vintage — mesma cena sempre dá o
// mesmo resultado (não é aleatório a cada render), mas varia entre cenas para não ser repetitivo.
function shouldFrame(id: string): boolean {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 6 === 0; // ~1 em cada 6 fotos
}

async function detectEncoder(pref: RenderOptions["encoder"]): Promise<{ codec: string; args: string[] }> {
  if (pref && pref !== "auto") return encoderArgs(pref);
  const out = await run(FFMPEG, ["-hide_banner", "-encoders"]).catch(() => "");
  for (const c of ["h264_qsv", "h264_nvenc"]) {
    if (out.includes(c)) {
      // testa rapidamente se o hardware aceita
      const ok = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=256x144:d=0.2", "-c:v", c, "-f", "null", "-"]).then(() => true).catch(() => false);
      if (ok) return encoderArgs(c);
    }
  }
  return encoderArgs("libx264");
}
function encoderArgs(codec: string): { codec: string; args: string[] } {
  if (codec === "h264_qsv") return { codec, args: ["-c:v", "h264_qsv", "-global_quality", "22", "-look_ahead", "0", "-pix_fmt", "nv12"] };
  if (codec === "h264_nvenc") return { codec, args: ["-c:v", "h264_nvenc", "-cq", "22", "-preset", "p4", "-pix_fmt", "yuv420p"] };
  return { codec: "libx264", args: ["-c:v", "libx264", "-pix_fmt", "yuv420p"] };
}

/** Renderiza um clipe de cena (só vídeo) já no tamanho final. */
async function renderSceneClip(s: TimelineScene, extraMs: number, o: RenderOptions, out: string, fontFile: string) {
  const { width: W, height: H, fps } = o.profile;
  const dur = (s.durationMs + extraMs) / 1000;
  const common = ["-y", "-hide_banner", "-loglevel", "error"];
  const enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(fps), "-an"];
  if (s.file && existsSync(s.file) && s.mediaType === "video") {
    const seek = s.startOffsetSec && s.startOffsetSec > 0 ? ["-ss", s.startOffsetSec.toFixed(2)] : [];
    await run(FFMPEG, [...common, ...seek, "-stream_loop", "-1", "-i", s.file, "-t", dur.toFixed(3), "-vf", `${cover(W, H)},fps=${fps}`, ...enc, out]);
    return;
  }
  if (s.file && existsSync(s.file)) {
    if (s.mediaType === "image" && shouldFrame(s.id)) {
      const filter = framedPhoto(W, H, fps, s.durationMs + extraMs);
      await run(FFMPEG, [...common, "-loop", "1", "-framerate", String(fps), "-i", s.file, "-t", dur.toFixed(3), "-filter_complex", filter, "-map", "[vout]", ...enc, out]);
      return;
    }
    const pre = `${cover(Math.round(W * 1.25), Math.round(H * 1.25))}`;
    await run(FFMPEG, [...common, "-loop", "1", "-framerate", String(fps), "-i", s.file, "-t", dur.toFixed(3), "-vf", `${pre},${kenBurns(s.motion, W, H, fps, s.durationMs + extraMs)},format=yuv420p`, ...enc, out]);
    return;
  }
  // Cartão de título (cena sem mídia): fundo obsidian com grade sutil e texto centralizado
  const txt = out.replace(/\.mp4$/, ".txt");
  await writeFile(txt, wrapText(s.title || "…", H > W ? 22 : 34), "utf8");
  const fs = Math.round(H * (H > W ? 0.05 : 0.045));
  await run(FFMPEG, [
    ...common,
    "-f", "lavfi", "-i", `color=c=0x0b0f17:s=${W}x${H}:r=${fps}:d=${dur.toFixed(3)}`,
    "-vf", `drawbox=x=0:y=0:w=iw:h=ih:color=0x111827@0.6:t=fill,drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(txt)}':fontcolor=0xF8FAFC:fontsize=${fs}:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=12:box=1:boxcolor=0x0b0f17@0.0,fade=t=in:st=0:d=0.4`,
    ...enc, out,
  ]);
}

// Variedade leve nos cortes: a maioria continua um "fade" discreto, e só de vez em quando entra uma
// transição diferente — dá dinamismo sem virar carrossel de efeitos. Escolha determinística (mesmo
// projeto/render sempre produz o mesmo resultado) via um hash simples da posição do corte.
const LIGHT_TRANSITIONS = ["smoothleft", "smoothright", "wiperight", "wipeleft", "dissolve"];
function pickTransition(actNum: number, cutIndex: number): string {
  let h = 0;
  const key = `${actNum}:${cutIndex}`;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (h % 5 !== 0) return "fade"; // ~80% dos cortes ficam no dissolve clássico e discreto
  return LIGHT_TRANSITIONS[h % LIGHT_TRANSITIONS.length];
}

/** Junta os clipes de um ato com dissolves (xfade), variando o tipo de transição em alguns cortes. */
async function renderAct(clips: string[], durationsMs: number[], transitionMs: number, fps: number, out: string, actNum = 1) {
  if (clips.length === 1) {
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", clips[0], "-c", "copy", out]);
    return;
  }
  const inputs = clips.flatMap((c) => ["-i", c]);
  const tr = transitionMs / 1000;
  const filters: string[] = [];
  let prev = "[0:v]";
  let offset = 0;
  for (let i = 1; i < clips.length; i++) {
    offset += durationsMs[i - 1] / 1000; // clipes têm +transição de sobra; o offset usa a duração "útil"
    const label = i === clips.length - 1 ? "[v]" : `[x${i}]`;
    const transition = pickTransition(actNum, i);
    filters.push(`${prev}[${i}:v]xfade=transition=${transition}:duration=${tr.toFixed(3)}:offset=${offset.toFixed(3)}${label}`);
    prev = label;
  }
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(fps), out]);
}

export async function renderTimeline(t: Timeline, o: RenderOptions) {
  const { profile } = o;
  const transitionMs = o.transitionMs ?? 400;
  const fontFile = o.fontFile || winFont();
  await mkdir(o.workDir, { recursive: true });
  const log = async (l: string) => o.onLog?.(l);
  const totalScenes = t.acts.reduce((s, a) => s + a.scenes.length, 0);
  let done = 0;

  // 1) Clipes por cena → 2) ato com dissolves
  const actFiles: string[] = [];
  for (const a of t.acts) {
    const clips: string[] = [];
    const durs: number[] = [];
    for (let i = 0; i < a.scenes.length; i++) {
      const s = a.scenes[i];
      const isLast = i === a.scenes.length - 1;
      const out = path.join(o.workDir, `a${String(a.act).padStart(2, "0")}-s${String(i + 1).padStart(2, "0")}.mp4`);
      await renderSceneClip(s, isLast ? 0 : transitionMs, o, out, fontFile);
      clips.push(out);
      durs.push(s.durationMs);
      done++;
      await o.onProgress?.({ percent: 5 + (done / totalScenes) * 60, message: `Ato ${a.act}: cena ${i + 1}/${a.scenes.length}` });
    }
    const actOut = path.join(o.workDir, `act-${String(a.act).padStart(2, "0")}.mp4`);
    await renderAct(clips, durs, transitionMs, profile.fps, actOut, a.act);
    actFiles.push(actOut);
    await log(`Ato ${a.act}: ${a.scenes.length} cenas → ${path.basename(actOut)}`);
  }

  // 3) Vídeo completo (concat de atos) + trilha de áudio (vozes com gap)
  await o.onProgress?.({ percent: 68, message: "Montando vídeo e áudio" });
  const list = path.join(o.workDir, "acts.txt");
  await writeFile(list, actFiles.map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  const videoAll = path.join(o.workDir, "video-all.mp4");
  await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", videoAll]);

  const audioAll = path.join(o.workDir, "voice-all.wav");
  {
    const inputs = t.acts.flatMap((a) => ["-i", a.voiceFile]);
    const parts: string[] = [];
    const labels: string[] = [];
    t.acts.forEach((a, i) => {
      parts.push(`[${i}:a]aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo[a${i}]`);
      labels.push(`[a${i}]`);
      if (i < t.acts.length - 1 && t.gapMs > 0) {
        parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${(t.gapMs / 1000).toFixed(3)}[g${i}]`);
        labels.push(`[g${i}]`);
      }
    });
    parts.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[voice]`);
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "[voice]", audioAll]);
  }

  // 4) Trilha (opcional) com ducking
  let mixed = audioAll;
  if (t.musicFile && existsSync(t.musicFile)) {
    mixed = path.join(o.workDir, "mix.wav");
    await run(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error", "-i", audioAll, "-stream_loop", "-1", "-i", t.musicFile,
      "-filter_complex", `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.22[m];[m][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=40:release=600[md];[0:a][md]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-14:TP=-1.5:LRA=11[out]`,
      "-map", "[out]", mixed,
    ]);
    await log("Trilha mixada com ducking");
  } else {
    const norm = path.join(o.workDir, "voice-norm.wav");
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", audioAll, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", norm]);
    mixed = norm;
  }

  // 5) Legendas + encode final
  await o.onProgress?.({ percent: 80, message: "Legendas e codificação final" });
  const vf: string[] = [];
  if (o.captions !== "none") {
    const ass = path.join(o.workDir, "captions.ass");
    await writeFile(ass, buildAss(t, profile, o.captions), "utf8");
    vf.push(`subtitles='${ffPath(ass)}'`);
  }
  const enc = await detectEncoder(o.encoder ?? "auto");
  await log(`Encoder: ${enc.codec}`);
  await mkdir(path.dirname(o.outFile), { recursive: true });
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", videoAll, "-i", mixed, ...(vf.length ? ["-vf", vf.join(",")] : []), ...enc.args, ...(enc.codec === "libx264" ? ["-preset", profile.preset, "-crf", String(profile.crf)] : []), "-c:a", "aac", "-b:a", profile.audioBitrate, "-shortest", "-movflags", "+faststart", o.outFile];
  try {
    await run(FFMPEG, args);
  } catch (err) {
    if (enc.codec !== "libx264") {
      await log(`${enc.codec} falhou; refazendo com libx264`);
      const sw = encoderArgs("libx264");
      await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", videoAll, "-i", mixed, ...(vf.length ? ["-vf", vf.join(",")] : []), ...sw.args, "-preset", profile.preset, "-crf", String(profile.crf), "-c:a", "aac", "-b:a", profile.audioBitrate, "-shortest", "-movflags", "+faststart", o.outFile]);
    } else throw err;
  }
  await o.onProgress?.({ percent: 100, message: "Concluído" });
  return { outFile: o.outFile, encoder: enc.codec };
}

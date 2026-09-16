"use client";

import { useMemo, useState } from "react";
import {
  CAPTION_PRESETS,
  captionPresetFor,
  legendaDe,
  type CaptionMode,
  type EstiloLegenda,
  type VideoFormat,
} from "@docupulse/core";
import { Icon } from "@docupulse/ui";

type SavedCaptionStyle = Partial<EstiloLegenda> & { mode?: CaptionMode };

const FONTES = ["Segoe UI", "Segoe UI Semibold", "Arial Black", "Georgia", "Verdana", "Trebuchet MS", "Impact"];

function parseSaved(raw: string): SavedCaptionStyle {
  try {
    const value = JSON.parse(raw) as SavedCaptionStyle;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function hexRgb(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return [255, 255, 255];
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}

function luminance(hex: string) {
  const values = hexRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

export function CaptionStyleEditor({ format, savedPreset, savedStyleJson }: { format: VideoFormat; savedPreset: string; savedStyleJson: string }) {
  const saved = useMemo(() => parseSaved(savedStyleJson), [savedStyleJson]);
  const resolved = captionPresetFor(savedPreset, format, legendaDe(null));
  const initialStyle: EstiloLegenda = savedPreset === "custom"
    ? { ...resolved.style, ...saved, tamanhoRel: { ...resolved.style.tamanhoRel, ...(saved.tamanhoRel ?? {}) } }
    : resolved.style;
  const [preset, setPreset] = useState(CAPTION_PRESETS.some((item) => item.id === savedPreset) ? savedPreset : "auto");
  const [mode, setMode] = useState<CaptionMode>(saved.mode ?? resolved.mode);
  const [style, setStyle] = useState<EstiloLegenda>(initialStyle);

  const vertical = format === "SHORT_9_16";
  const sizePct = (vertical ? style.tamanhoRel.vertical : style.tamanhoRel.horizontal) * 100;
  const ratio = contrast(style.cor, style.corContorno);
  const safeWarning = vertical && style.posicao === "bottom";

  function choosePreset(id: string) {
    setPreset(id);
    if (id === "custom") {
      setStyle((current) => ({ ...current, ...saved, tamanhoRel: { ...current.tamanhoRel, ...(saved.tamanhoRel ?? {}) } }));
      if (saved.mode) setMode(saved.mode);
      return;
    }
    const next = captionPresetFor(id, format, legendaDe(null));
    setMode(next.mode);
    setStyle(next.style);
  }

  function customize(patch: Partial<EstiloLegenda>) {
    setPreset("custom");
    setStyle((current) => ({ ...current, ...patch }));
  }

  function setSize(value: number) {
    const rel = Math.max(0.03, Math.min(0.07, value / 100));
    setPreset("custom");
    setStyle((current) => ({
      ...current,
      tamanhoRel: vertical ? { ...current.tamanhoRel, vertical: rel } : { ...current.tamanhoRel, horizontal: rel },
    }));
  }

  const positionClass = style.posicao === "top" ? "top-[10%]" : style.posicao === "bottom" ? "bottom-[16%]" : "top-1/2 -translate-y-1/2";
  const shadow = `${style.contorno ?? 3}px 0 ${style.corContorno}, -${style.contorno ?? 3}px 0 ${style.corContorno}, 0 ${style.contorno ?? 3}px ${style.corContorno}, 0 -${style.contorno ?? 3}px ${style.corContorno}`;

  return (
    <div className="rounded border border-line bg-void/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg">Modelo de legenda</span>
        <span className="font-mono text-[10px] text-muted">{CAPTION_PRESETS.length - 2} estilos + automático + personalizado</span>
      </div>
      <select name="captionPreset" value={preset} onChange={(event) => choosePreset(event.target.value)} className="field mt-2 w-full px-3 py-2 text-xs">
        {CAPTION_PRESETS.map((item) => <option key={item.id} value={item.id} className="bg-surface-low">{item.label} — {item.description}</option>)}
      </select>

      <div className={`relative mt-3 overflow-hidden rounded border border-line bg-gradient-to-br from-slate-900 via-slate-700 to-amber-900 ${vertical ? "mx-auto aspect-[9/16] max-h-72" : "aspect-video w-full"}`}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 65% 25%, white 0, transparent 32%), linear-gradient(120deg, transparent 45%, black 100%)" }} />
        <div className={`absolute inset-x-[6%] text-center leading-tight ${positionClass}`} style={{ fontFamily: style.fonte, fontSize: `${Math.max(14, sizePct * (vertical ? 4.6 : 3.6))}px`, color: style.cor, textShadow: shadow, textTransform: style.maiusculas ? "uppercase" : "none", fontWeight: mode === "bold-center-animated" ? 900 : 600 }}>
          Uma <span style={{ color: style.corAtiva }}>história</span> que ninguém contou
        </div>
        <span className="absolute left-2 top-2 rounded bg-black/55 px-2 py-1 font-mono text-[9px] text-white">PRÉVIA {vertical ? "9:16" : "16:9"}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted">Fonte
          <select name="captionFont" value={style.fonte} onChange={(event) => customize({ fonte: event.target.value })} className="field mt-1 w-full px-2 py-1.5 text-xs">
            {FONTES.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-muted">Animação
          <select name="captionMode" value={mode} onChange={(event) => { setPreset("custom"); setMode(event.target.value as CaptionMode); }} className="field mt-1 w-full px-2 py-1.5 text-xs">
            <option value="subtle-bottom">Frase discreta</option><option value="bold-center-animated">Karaokê palavra a palavra</option>
          </select>
        </label>
        <label className="text-[10px] text-muted">Cor principal
          <input name="captionColor" type="color" value={style.cor} onChange={(event) => customize({ cor: event.target.value })} className="mt-1 h-9 w-full rounded border border-line bg-void p-1" />
        </label>
        <label className="text-[10px] text-muted">Palavra ativa
          <input name="captionActiveColor" type="color" value={style.corAtiva} onChange={(event) => customize({ corAtiva: event.target.value })} className="mt-1 h-9 w-full rounded border border-line bg-void p-1" />
        </label>
        <label className="text-[10px] text-muted">Contorno
          <input name="captionOutlineColor" type="color" value={style.corContorno} onChange={(event) => customize({ corContorno: event.target.value })} className="mt-1 h-9 w-full rounded border border-line bg-void p-1" />
        </label>
        <label className="text-[10px] text-muted">Posição
          <select name="captionPosition" value={style.posicao ?? (vertical ? "top" : "bottom")} onChange={(event) => customize({ posicao: event.target.value as EstiloLegenda["posicao"] })} className="field mt-1 w-full px-2 py-1.5 text-xs">
            <option value="top">Superior</option><option value="center">Centro</option><option value="bottom">Inferior</option>
          </select>
        </label>
        <label className="text-[10px] text-muted">Tamanho: {sizePct.toFixed(1)}%
          <input name={vertical ? "captionSizeV" : "captionSizeH"} type="range" min="3" max="7" step="0.1" value={sizePct} onChange={(event) => setSize(Number(event.target.value))} className="mt-2 w-full accent-primary" />
          <input type="hidden" name={vertical ? "captionSizeH" : "captionSizeV"} value={(vertical ? style.tamanhoRel.horizontal : style.tamanhoRel.vertical) * 100} />
        </label>
        <label className="text-[10px] text-muted">Palavras por bloco
          <input name="captionWords" type="number" min="2" max="10" value={style.palavrasPorLinha ?? (mode === "bold-center-animated" ? 3 : 7)} onChange={(event) => customize({ palavrasPorLinha: Number(event.target.value) })} className="field mt-1 w-full px-2 py-1.5 text-xs" />
        </label>
        <label className="text-[10px] text-muted">Espessura do contorno
          <input name="captionOutlineWidth" type="number" min="0" max="8" value={style.contorno ?? 3} onChange={(event) => customize({ contorno: Number(event.target.value) })} className="field mt-1 w-full px-2 py-1.5 text-xs" />
        </label>
        <label className="text-[10px] text-muted">Sombra
          <input name="captionShadow" type="number" min="0" max="5" value={style.sombra ?? 1} onChange={(event) => customize({ sombra: Number(event.target.value) })} className="field mt-1 w-full px-2 py-1.5 text-xs" />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-[11px] text-fg-secondary"><input name="captionUppercase" type="checkbox" checked={style.maiusculas ?? mode === "bold-center-animated"} onChange={(event) => customize({ maiusculas: event.target.checked })} className="accent-primary" /> Usar letras maiúsculas</label>

      <div className="mt-3 space-y-1 text-[10px]">
        <div className={ratio >= 4.5 ? "text-success" : "text-warning"}><Icon name={ratio >= 4.5 ? "check_circle" : "contrast"} className="mr-1 align-middle text-[13px]" />Contraste texto/contorno: {ratio.toFixed(1)}:1 {ratio >= 4.5 ? "· adequado" : "· aumente a diferença das cores"}</div>
        {safeWarning && <div className="text-warning"><Icon name="warning" className="mr-1 align-middle text-[13px]" />Em vídeo vertical, a posição inferior pode disputar espaço com os controles do TikTok/Reels.</div>}
      </div>
      <button type="submit" name="saveCaption" value="1" className="mt-3 w-full rounded border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-medium text-primary-bright hover:bg-primary/20">Salvar como padrão deste projeto</button>
    </div>
  );
}

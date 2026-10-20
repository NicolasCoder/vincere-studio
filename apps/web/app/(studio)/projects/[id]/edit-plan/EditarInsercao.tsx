"use client";
import { useRef, useState, useTransition } from "react";
import { EDIT_LAYOUTS, LAYOUT_META, type EditInsertion } from "@vincere-studio/core";
import { Badge, Button, Icon } from "@vincere-studio/ui";

const LAYOUT_TONE: Record<string, "cyan" | "violet" | "success" | "warning" | "neutral"> = {
  "lower-third": "cyan",
  "overlay-dado": "violet",
  "insert-arquivo": "success",
  "split-evidencia": "warning",
  "graphic-fullscreen": "neutral",
  cronologia: "violet",
  "mesa-arquivo": "success",
};

const fmtMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Card de uma inserção do plano, com edição na mão — texto, horário, layout, ou remover.
 *
 * Existe porque a única forma de mudar algo antes era "Gerar novo plano" (refaz tudo de novo,
 * do zero, pela IA) ou aplicar como está. Pedido explícito do usuário depois de tentar mexer
 * numa inserção pelo Remotion e descobrir que lá é só revisão — nada se salva de volta.
 */
export function EditarInsercao({ insertion, action }: { insertion: EditInsertion; action: (formData: FormData) => void | Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function remover() {
    if (!confirm(`Remover a inserção "${insertion.primary}"?`)) return;
    const fd = new FormData();
    fd.set("remover", "1");
    startTransition(() => action(fd));
  }

  if (!editando) {
    return (
      <div className={`rounded border p-3 ${insertion.resolved ? "border-line bg-void/40" : "border-warning/40 bg-warning/5"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={LAYOUT_TONE[insertion.layout]}>{LAYOUT_META[insertion.layout].label}</Badge>
          {insertion.lowerThirdStyle && <Badge tone="neutral">{insertion.lowerThirdStyle}</Badge>}
          <span className="font-mono text-[11px] text-muted">
            {fmtMs(insertion.startMs)} – {fmtMs(insertion.endMs)}
          </span>
          {!insertion.resolved && (
            <Badge tone="warning">
              <Icon name="error_outline" className="mr-1 align-middle text-[13px]" />
              tempo não confirmado
            </Badge>
          )}
          {insertion.backdrop && (
            <Badge tone={insertion.backdrop === "light" ? "warning" : "neutral"}>
              <Icon name="contrast" className="mr-1 align-middle text-[13px]" />
              fundo {insertion.backdrop === "light" ? "claro" : "escuro"} · luma {insertion.backdropLuma}
            </Badge>
          )}
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={() => setEditando(true)} className="text-muted hover:text-primary-bright" title="Editar">
              <Icon name="edit" className="text-[16px]" />
            </button>
            <button type="button" onClick={remover} disabled={pending} className="text-muted hover:text-error" title="Remover">
              <Icon name="delete" className="text-[16px]" />
            </button>
          </span>
        </div>
        <div className="mt-1.5 font-display text-sm font-semibold">{insertion.primary}</div>
        {insertion.secondary && <div className="text-[12px] text-fg-secondary">{insertion.secondary}</div>}
        <p className="mt-2 text-[11px] text-muted">
          <span className="text-fg-secondary">gatilho:</span> "{insertion.trigger}"
        </p>
        {insertion.note && <p className="mt-1 text-[11px] italic text-muted">{insertion.note}</p>}
        {insertion.evidencePrompt && (
          <p className="mt-2 rounded border border-line bg-void/40 p-2 text-[10px] text-fg-secondary">
            <span className="text-primary-bright">evidência a gerar:</span> {insertion.evidencePrompt}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => { action(fd); setEditando(false); })}
      className="rounded border border-primary-bright/50 bg-void/60 p-3"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 text-[11px] text-fg-secondary sm:col-span-4">
          Texto principal
          <input name="primary" defaultValue={insertion.primary} className="field px-2 py-1.5 text-sm" />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-[11px] text-fg-secondary sm:col-span-4">
          Texto secundário
          <input name="secondary" defaultValue={insertion.secondary ?? ""} className="field px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-fg-secondary">
          Início (s)
          <input name="startS" type="number" step="0.1" defaultValue={(insertion.startMs / 1000).toFixed(1)} className="field px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-fg-secondary">
          Fim (s)
          <input name="endS" type="number" step="0.1" defaultValue={(insertion.endMs / 1000).toFixed(1)} className="field px-2 py-1.5 text-sm" />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-[11px] text-fg-secondary sm:col-span-2">
          Layout
          <select name="layout" defaultValue={insertion.layout} className="field px-2 py-1.5 text-sm">
            {EDIT_LAYOUTS.map((l) => (
              <option key={l} value={l} className="bg-surface-low">
                {LAYOUT_META[l].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[10px] text-muted">
        Trocar para cronologia, mesa de arquivo, inserção de arquivo ou split de evidência só aparece se essa inserção já
        tiver os dados/evidência necessários — sem eles, o trecho fica limpo (sem erro).
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" icon="check" disabled={pending}>
          Salvar
        </Button>
        <Button type="button" size="sm" variant="ghost" icon="close" onClick={() => setEditando(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

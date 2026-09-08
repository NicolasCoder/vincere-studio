"use client";
import { useState } from "react";
import { Button, cn } from "@docupulse/ui";

/** Editor de um bloco de roteiro: texto editável com salvar explícito e realce das marcações [Pausa]. */
export function BlockEditor({ narration, title, action, disabled }: { narration: string; title: string; action: (fd: FormData) => Promise<void>; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(narration);
  const words = text.replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  if (!editing) {
    return (
      <div className="group relative">
        <p className="text-[15px] leading-relaxed text-fg">
          {narration.split(/(\[[^\]]+\])/).map((part, i) =>
            part.startsWith("[") ? <span key={i} className="mx-1 rounded-sm bg-secondary/20 px-1.5 font-mono text-[11px] text-secondary-soft">{part}</span> : <span key={i}>{part}</span>,
          )}
          {!narration && <span className="text-muted">(bloco vazio — clique em editar)</span>}
        </p>
        <button type="button" onClick={() => setEditing(true)} disabled={disabled} className="absolute -right-1 -top-1 rounded border border-line bg-void/80 px-2 py-0.5 font-mono text-[10px] text-fg-secondary opacity-0 transition-opacity hover:text-fg group-hover:opacity-100">
          editar
        </button>
      </div>
    );
  }
  return (
    <form action={action} onSubmit={() => setEditing(false)} className="space-y-2">
      <input name="title" defaultValue={title} className="field w-full px-3 py-1.5 font-display text-sm font-semibold" />
      <textarea name="narration" value={text} onChange={(e) => setText(e.target.value)} rows={8} className={cn("field w-full px-3 py-2 text-[15px] leading-relaxed")} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="primary" icon="save">Salvar bloco</Button>
        <Button type="button" size="sm" onClick={() => { setText(narration); setEditing(false); }}>Cancelar</Button>
        <span className="ml-auto font-mono text-[11px] text-muted">{words} palavras · use [Pausa dramática 1.5s] para respiros</span>
      </div>
    </form>
  );
}

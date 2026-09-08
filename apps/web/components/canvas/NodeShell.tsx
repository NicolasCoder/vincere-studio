"use client";
import { useRef, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { NODE_META, type NodeKind } from "@docupulse/core";
import { Icon, cn } from "@docupulse/ui";

export const TONE = {
  cyan: { ring: "border-primary/50", glow: "shadow-glow-cyan", text: "text-primary-bright", bg: "bg-primary/15", handle: "#22d3ee" },
  violet: { ring: "border-secondary/50", glow: "shadow-glow-violet", text: "text-secondary-soft", bg: "bg-secondary/20", handle: "#a855f7" },
  amber: { ring: "border-warning/50", glow: "shadow-[0_0_24px_-4px_rgba(251,191,36,0.35)]", text: "text-warning", bg: "bg-warning/15", handle: "#fbbf24" },
  emerald: { ring: "border-success/50", glow: "shadow-[0_0_24px_-4px_rgba(52,211,153,0.35)]", text: "text-success", bg: "bg-success/15", handle: "#34d399" },
} as const;

export function NodeShell({
  kind,
  index,
  selected,
  children,
  width = 420,
  isTarget,
}: {
  kind: NodeKind;
  index: number;
  selected?: boolean;
  children: ReactNode;
  width?: number;
  isTarget?: boolean;
}) {
  const meta = NODE_META[kind];
  const t = TONE[meta.tone];
  return (
    <div
      className={cn("glass-elevated rounded-lg transition-shadow", selected ? cn(t.ring, t.glow) : "border-line")}
      style={{ width }}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className={cn("grid size-7 place-items-center rounded", t.bg, t.text)}>
          <Icon name={meta.icon} className="text-[18px]" />
        </span>
        <span className="flex-1 truncate font-display text-sm font-semibold">{meta.label}</span>
        <span className={cn("rounded-sm px-2 py-0.5 font-mono text-[10px] tracking-wider", t.bg, t.text)}>
          {isTarget ? "TARGET NODE" : `NODE #${String(index).padStart(2, "0")}`}
        </span>
      </div>
      <div className="nodrag-scroll space-y-3 p-4">{children}</div>
      {kind !== "RENDER" && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ width: 22, height: 22, background: "#0b0f17", border: `2px solid ${t.handle}`, boxShadow: `0 0 12px ${t.handle}66` }}
        />
      )}
      {kind !== "AVATAR" && kind !== "PRODUCT" && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ width: 22, height: 22, background: "#0b0f17", border: `2px solid ${t.handle}`, boxShadow: `0 0 12px ${t.handle}66` }}
        />
      )}
    </div>
  );
}

/** Linha chave/valor editável, no estilo dos nós do Stitch. */
export function Field({
  label,
  value,
  onChange,
  mono = true,
  tone = "cyan",
  multiline,
  suffix,
}: {
  label: string;
  value: string | number;
  onChange?: (v: string) => void;
  mono?: boolean;
  tone?: keyof typeof TONE;
  multiline?: boolean;
  suffix?: ReactNode;
}) {
  const cls = cn("w-full bg-transparent outline-none", mono ? "font-mono text-[12px]" : "text-[13px]", TONE[tone].text);
  return (
    <div className="rounded border border-line bg-void/60 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="label-mono text-muted">{label}</span>
        {suffix}
      </div>
      {multiline ? (
        <textarea className={cn(cls, "nodrag nowheel mt-1 h-20 resize-none text-fg leading-relaxed")} value={value} onChange={(e) => onChange?.(e.target.value)} readOnly={!onChange} />
      ) : (
        <input className={cn(cls, "nodrag mt-0.5")} value={value} onChange={(e) => onChange?.(e.target.value)} readOnly={!onChange} />
      )}
    </div>
  );
}

export function Meter({ label, value, max = 100, unit = "%", tone = "cyan" }: { label: string; value: number; max?: number; unit?: string; tone?: keyof typeof TONE }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="rounded border border-line bg-void/60 px-3 py-2">
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="text-fg-secondary">{label}</span>
        <span className={TONE[tone].text}>
          {unit === "%" ? Math.round(value) : value}
          {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-line/50">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TONE[tone].handle }} />
      </div>
    </div>
  );
}

export function Thumb({
  label,
  icon,
  ratio = "portrait",
  imageUrl,
  onPick,
  uploading,
}: {
  label: string;
  icon: string;
  ratio?: "portrait" | "square";
  /** relPath (storage/…) da imagem de referência já enviada, se houver. */
  imageUrl?: string;
  /** Quando definido, o thumb vira clicável e abre um seletor de arquivo. */
  onPick?: (file: File) => void;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("group relative shrink-0 overflow-hidden rounded border border-line bg-gradient-to-br from-surface-low via-void to-secondary/20", ratio === "portrait" ? "h-36 w-24" : "size-24")}>
      {imageUrl ? (
        <img src={`/api/media/${imageUrl}`} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted"><Icon name={icon} className="text-[28px]" /></div>
      )}
      {onPick && (
        <button
          type="button"
          title="Anexar imagem de referência"
          className="nodrag absolute inset-0 grid place-items-center bg-void/0 opacity-0 transition-opacity group-hover:bg-void/70 group-hover:opacity-100"
          onClick={() => inputRef.current?.click()}
        >
          <Icon name={uploading ? "sync" : "upload"} className={cn("text-[20px] text-primary-bright", uploading && "animate-spin")} />
        </button>
      )}
      {onPick && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
      )}
      <span className="absolute bottom-1 left-1 rounded-sm bg-void/80 px-1 font-mono text-[9px] text-primary-bright">{label}</span>
    </div>
  );
}

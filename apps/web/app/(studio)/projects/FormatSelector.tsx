"use client";
import { useState } from "react";
import type { FormatSpec, VideoFormat } from "@vincere-studio/core";
import { Icon, cn } from "@vincere-studio/ui";

export function FormatSelector({ formats, defaultValue = "LONG_16_9" }: { formats: FormatSpec[]; defaultValue?: VideoFormat }) {
  const [value, setValue] = useState<VideoFormat>(defaultValue);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="format" value={value} />
      {formats.map((f) => {
        const active = f.id === value;
        return (
          <button
            type="button"
            key={f.id}
            onClick={() => setValue(f.id)}
            className={cn(
              "flex items-start gap-3 rounded border p-3 text-left transition-all",
              active ? "border-primary/60 bg-primary/10 shadow-glow-cyan" : "border-line bg-surface-low/60 hover:border-line-glow",
            )}
          >
            <span className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded border font-mono text-[10px]", active ? "border-primary/50 text-primary-bright" : "border-line text-muted")}>
              <Icon name={f.ratio === "16:9" ? "crop_landscape" : "crop_portrait"} className="text-[18px]" />
              {f.ratio}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold">{f.label}</span>
                <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[10px]", active ? "bg-primary/20 text-primary-bright" : "bg-line/40 text-muted")}>
                  {active ? "Ativo" : f.ratio === "9:16" ? "Shorts/Reels" : "Long-form"}
                </span>
              </span>
              <span className="mt-1 block text-xs text-fg-secondary">{f.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "../cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Barra de acento no topo: fase ativa (Script = violet, Audio = cyan, B-Roll = slate) */
  accent?: "cyan" | "violet" | "dual" | "slate" | "none";
  elevated?: boolean;
  glow?: "cyan" | "violet" | "none";
}

const accents = {
  cyan: "before:bg-primary",
  violet: "before:bg-secondary",
  dual: "before:bg-gradient-to-r before:from-primary before:to-secondary",
  slate: "before:bg-muted",
  none: "",
};

export function Card({ accent = "none", elevated, glow = "none", className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden",
        elevated ? "glass-elevated" : "glass",
        accent !== "none" && "before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:content-['']",
        accents[accent],
        glow === "cyan" && "shadow-glow-cyan border-primary/40",
        glow === "violet" && "shadow-glow-violet border-secondary/40",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

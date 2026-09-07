import type { HTMLAttributes } from "react";
import { cn } from "../cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "cyan" | "violet" | "success" | "warning" | "error" | "neutral";
  pill?: boolean;
  dot?: boolean;
}

const tones = {
  cyan: "bg-primary/15 text-primary-bright border-primary/30",
  violet: "bg-secondary/15 text-secondary-soft border-secondary/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  error: "bg-error-container/40 text-error border-error/30",
  neutral: "bg-line/30 text-fg-secondary border-line",
};

export function Badge({ tone = "neutral", pill, dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider",
        pill ? "rounded-full" : "rounded-sm",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
}

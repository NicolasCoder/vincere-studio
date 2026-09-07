import type { ButtonHTMLAttributes } from "react";
import { cn } from "../cn";
import { Icon } from "./Icon";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "cyan" | "violet";
  icon?: string;
}

export function Chip({ active, tone = "cyan", icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded border border-line bg-void/60 px-2 font-mono text-[11px] font-medium tracking-wider transition-colors",
        active
          ? tone === "cyan"
            ? "border-primary/60 bg-primary/10 text-primary-bright"
            : "border-secondary/60 bg-secondary/10 text-secondary-soft"
          : "text-fg-secondary hover:text-fg hover:border-line-glow",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "icon" | "subtle" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  children?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-display font-medium tracking-[-0.01em] transition-[transform,background-color,border-color,color,opacity,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none";

const variants: Record<Variant, string> = {
  primary: "gradient-cta text-fg shadow-glow-cta hover:brightness-110",
  secondary: "bg-surface/70 border border-white/[0.08] text-fg-secondary hover:border-white/[0.18] hover:bg-surface-elevated/80 hover:text-fg",
  ghost: "bg-surface/60 border border-white/[0.07] text-fg-secondary hover:border-white/[0.16] hover:text-fg",
  outline: "bg-transparent border border-white/[0.1] text-fg-secondary hover:border-primary/60 hover:text-fg",
  subtle: "bg-transparent text-fg-secondary hover:bg-white/[0.05] hover:text-fg",
  icon: "size-8 !p-0 bg-transparent text-fg-secondary hover:bg-white/[0.06] hover:text-fg",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({ variant = "ghost", size = "md", icon, iconRight, className, children, ...rest }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], variant !== "icon" && sizes[size], className)} {...rest}>
      {icon && <Icon name={icon} className="text-[18px]" />}
      {children}
      {iconRight && <Icon name={iconRight} className="text-[18px]" />}
    </button>
  );
}

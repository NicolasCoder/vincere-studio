import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";
import { Icon } from "./Icon";

type Variant = "primary" | "ghost" | "icon" | "subtle" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  children?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded font-display font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "gradient-cta text-fg shadow-glow-cta hover:brightness-110",
  ghost: "bg-surface/60 border border-line text-fg-secondary hover:border-primary-bright hover:text-fg",
  outline: "bg-surface/60 border border-line text-fg-secondary hover:border-primary-bright hover:text-fg",
  subtle: "bg-transparent text-fg-secondary hover:bg-line/40 hover:text-fg",
  icon: "size-8 !p-0 bg-transparent text-fg-secondary hover:bg-line/40 hover:text-fg",
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

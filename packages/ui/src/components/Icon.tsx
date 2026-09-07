import { cn } from "../cn";

export function Icon({ name, className, filled }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span className={cn("material-symbols-outlined select-none", filled && "filled", className)} aria-hidden>
      {name}
    </span>
  );
}

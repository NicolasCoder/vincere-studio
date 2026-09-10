import { cn } from "../cn";

export function Stat({
  label,
  value,
  sub,
  tone = "cyan",
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "cyan" | "violet" | "fg" | "error" | "warning";
  className?: string;
}) {
  return (
    <div className={cn("rounded border border-line bg-void/40 p-3", className)}>
      <div className="label-mono text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-2xl font-bold",
          tone === "cyan" && "text-primary-bright",
          tone === "violet" && "text-secondary-soft",
          tone === "fg" && "text-fg",
          tone === "error" && "text-error",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-fg-secondary">{sub}</div>}
    </div>
  );
}

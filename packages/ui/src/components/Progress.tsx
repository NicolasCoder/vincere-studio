import { cn } from "../cn";

export function Progress({ value, className, pulse }: { value: number; className?: string; pulse?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line/50", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500"
        style={{ width: `${v}%` }}
      />
      {pulse && v < 100 && (
        <div
          className="absolute inset-y-0 w-16 animate-[pulse-travel_1.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent"
          style={{ left: `calc(${v}% - 4rem)` }}
        />
      )}
    </div>
  );
}

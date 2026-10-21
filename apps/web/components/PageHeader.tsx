import { Icon } from "@vincere-studio/ui";

export function PageHeader({ icon, title, subtitle, right }: { icon?: string; title: React.ReactNode; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex items-center gap-3.5">
        {icon && (
          <span className="hidden size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-primary-bright sm:grid">
            <Icon name={icon} className="text-[20px]" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-2xl text-xs sm:text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{right}</div>}
    </div>
  );
}

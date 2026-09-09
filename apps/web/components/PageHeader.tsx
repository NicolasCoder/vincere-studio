import { Icon } from "@docupulse/ui";

export function PageHeader({ icon, title, subtitle, right }: { icon?: string; title: React.ReactNode; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
      <div className="flex items-start gap-4">
        {icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded border border-primary/30 bg-primary/10 text-primary-bright">
            <Icon name={icon} className="text-[24px]" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="w-full sm:w-auto">{right}</div>}
    </div>
  );
}

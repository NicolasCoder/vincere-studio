import { Icon } from "@vincere-studio/ui";

export function PageHeader({ icon, title, subtitle, right }: { icon?: string; title: React.ReactNode; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
      <div className="flex items-start gap-4">
        {icon && (
          <span className="hidden size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-low text-primary-bright sm:grid">
            <Icon name={icon} className="text-[22px]" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{right}</div>}
    </div>
  );
}

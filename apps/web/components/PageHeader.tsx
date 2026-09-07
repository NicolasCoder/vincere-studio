import { Icon } from "@docupulse/ui";

export function PageHeader({ icon, title, subtitle, right }: { icon?: string; title: React.ReactNode; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        {icon && (
          <span className="grid size-11 place-items-center rounded border border-primary/30 bg-primary/10 text-primary-bright">
            <Icon name={icon} className="text-[24px]" />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

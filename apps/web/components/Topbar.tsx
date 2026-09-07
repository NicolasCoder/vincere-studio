import { Icon } from "@docupulse/ui";

export function Topbar({ crumbs, costUsd }: { crumbs: string[]; costUsd: number }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-line bg-void/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs text-fg-secondary">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted">/</span>}
            <span className={i === crumbs.length - 1 ? "flex items-center gap-1.5 text-fg" : ""}>
              {i === crumbs.length - 1 && <span className="size-1.5 rounded-full bg-primary-bright" />}
              {c}
            </span>
          </span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="field flex h-9 w-72 items-center gap-2 px-3 text-sm text-fg-secondary">
          <Icon name="search" className="text-[18px]" />
          <span className="flex-1">Quick search...</span>
          <kbd className="rounded-sm border border-line bg-void px-1.5 font-mono text-[10px] text-muted">Cmd + K</kbd>
        </div>
        <div
          className="flex h-9 items-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 font-mono text-xs text-primary-bright"
          title="Consumo real de API acumulado (base dos créditos)"
        >
          <Icon name="bolt" className="text-[16px]" filled />
          US$ {costUsd.toFixed(2)} <span className="text-muted">consumido</span>
        </div>
        <button className="relative grid size-9 place-items-center rounded text-fg-secondary hover:bg-line/40 hover:text-fg">
          <Icon name="notifications" className="text-[20px]" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary-bright" />
        </button>
        <div className="relative size-9 rounded-full border border-line bg-gradient-to-br from-secondary/60 to-primary/60">
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-void bg-primary-bright" />
        </div>
      </div>
    </header>
  );
}

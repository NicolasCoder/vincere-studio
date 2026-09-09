import { Icon } from "@docupulse/ui";

export function Topbar({ crumbs, costUsd }: { crumbs: string[]; costUsd: number }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-line bg-void/80 px-4 backdrop-blur-md sm:px-6">
      <label htmlFor="mobile-nav-toggle" className="grid size-9 shrink-0 place-items-center rounded text-fg-secondary hover:bg-line/40 hover:text-fg lg:hidden">
        <Icon name="menu" className="text-[22px]" />
      </label>
      <div className="hidden items-center gap-2 text-xs text-fg-secondary sm:flex">
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
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="field hidden h-9 w-40 items-center gap-2 px-3 text-sm text-fg-secondary md:flex lg:w-72">
          <Icon name="search" className="text-[18px]" />
          <span className="hidden flex-1 lg:inline">Quick search...</span>
          <kbd className="hidden rounded-sm border border-line bg-void px-1.5 font-mono text-[10px] text-muted lg:inline">Cmd + K</kbd>
        </div>
        <div
          className="flex h-9 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 font-mono text-xs text-primary-bright sm:gap-2 sm:px-3"
          title="Custo equivalente das chamadas de API (no nível gratuito do Gemini isso não é cobrado)"
        >
          <Icon name="bolt" className="text-[16px]" filled />
          <span className="hidden sm:inline">US$ {costUsd.toFixed(2)} <span className="text-muted">equiv.</span></span>
          <span className="sm:hidden">{costUsd.toFixed(2)}</span>
        </div>
        <button className="relative hidden size-9 place-items-center rounded text-fg-secondary hover:bg-line/40 hover:text-fg sm:grid">
          <Icon name="notifications" className="text-[20px]" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary-bright" />
        </button>
        <div className="relative size-9 shrink-0 rounded-full border border-line bg-gradient-to-br from-secondary/60 to-primary/60">
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-void bg-primary-bright" />
        </div>
      </div>
    </header>
  );
}

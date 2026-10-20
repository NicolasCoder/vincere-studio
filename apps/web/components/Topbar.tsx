import { Icon } from "@vincere-studio/ui";

export function Topbar({ crumbs, costUsd = 0 }: { crumbs: string[]; costUsd?: number }) {
  return (
    <header className="sticky top-12 z-10 hidden h-14 items-center lg:top-0 lg:flex gap-4 border-b border-line bg-void/80 px-4 backdrop-blur-md sm:px-6">
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
        <div
          className="flex h-9 items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 font-mono text-xs text-primary-bright sm:gap-2 sm:px-3"
          title="Custo equivalente das chamadas de API (no nível gratuito do Gemini isso não é cobrado)"
        >
          <Icon name="bolt" className="text-[16px]" filled />
          <span className="hidden sm:inline">US$ {costUsd.toFixed(2)} <span className="text-muted">equiv.</span></span>
          <span className="sm:hidden">{costUsd.toFixed(2)}</span>
        </div>
      </div>
    </header>
  );
}

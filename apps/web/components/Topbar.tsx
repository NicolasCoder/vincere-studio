export function Topbar({ crumbs }: { crumbs: string[]; costUsd?: number }) {
  return (
    <header className="sticky top-12 z-10 hidden h-12 items-center lg:top-0 lg:flex gap-3 border-b border-white/[0.05] bg-void/75 px-4 backdrop-blur-xl sm:px-6">
      <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted/50">/</span>}
            <span className={i === crumbs.length - 1 ? "font-medium text-fg" : "text-fg-secondary"}>
              {c}
            </span>
          </span>
        ))}
      </div>
    </header>
  );
}

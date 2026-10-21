export function Topbar({ crumbs }: { crumbs: string[]; costUsd?: number }) {
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
    </header>
  );
}

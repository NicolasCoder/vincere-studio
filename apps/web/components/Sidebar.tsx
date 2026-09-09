"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cn } from "@docupulse/ui";

const nav = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/channels", icon: "smart_display", label: "Channel Manager", badge: "3" },
  { href: "/projects", icon: "lightbulb", label: "Ideation Hub", badge: "AI", accent: true },
  { href: "/workflow", icon: "account_tree", label: "Workflow Studio", badge: "NEW", live: true },
  { href: "/history", icon: "history_edu", label: "Histórico de Produção", badge: "docs" },
  { href: "/metrics", icon: "monitoring", label: "Métricas & Desempenho", badge: "Live", live: true },
  { href: "/assets", icon: "video_library", label: "Media Assets" },
  { href: "/references", icon: "collections_bookmark", label: "Referências" },
  { href: "/skills", icon: "auto_stories", label: "Skills" },
  { href: "/health", icon: "monitor_heart", label: "Saúde do Sistema" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function Sidebar({ docsCount, quotaUsed, quotaTotal }: { docsCount: number; quotaUsed: number; quotaTotal: number }) {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-sidebar -translate-x-full flex-col border-r border-line bg-surface-low transition-transform duration-200 peer-checked/nav:translate-x-0 lg:translate-x-0 lg:bg-surface-low/95">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-5">
        <span className="grid size-9 place-items-center rounded border border-primary/40 bg-primary/10 text-primary-bright shadow-glow-cyan">
          <Icon name="play_circle" className="text-[22px]" />
        </span>
        <div>
          <div className="font-display text-base font-bold leading-tight">
            DocuPulse<span className="text-primary-bright">.AI</span>
          </div>
          <div className="label-mono text-muted">Studio OS</div>
        </div>
        <label htmlFor="mobile-nav-toggle" className="ml-auto grid size-8 place-items-center rounded text-fg-secondary hover:bg-line/40 hover:text-fg lg:hidden">
          <Icon name="close" className="text-[18px]" />
        </label>
      </Link>

      <nav className="mt-2 flex flex-col gap-1 px-3">
        {nav.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-l-2 border-primary bg-primary/10 text-primary-bright"
                  : "text-fg-secondary hover:bg-line/30 hover:text-fg",
              )}
            >
              <Icon name={item.icon} className="text-[20px]" filled={active} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-wider",
                    item.accent
                      ? "border-secondary/40 bg-secondary/20 text-secondary-soft"
                      : item.live
                        ? "border-primary/40 bg-primary/10 text-primary-bright"
                        : "border-line text-muted",
                  )}
                >
                  {item.live && <span className="mr-1 inline-block size-1.5 rounded-full bg-primary-bright align-middle" />}
                  {item.badge === "docs" ? `${docsCount} docs` : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-line p-4">
        <div className="rounded border border-line bg-void/60 p-3">
          <div className="flex items-center justify-between">
            <span className="rounded-sm bg-secondary/30 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-secondary-soft">
              LOCAL · FREE
            </span>
            <span className="font-mono text-xs text-primary-bright">{Math.round((quotaUsed / quotaTotal) * 100)}%</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-fg-secondary">
            <span className="font-mono">Docs Renderizados</span>
            <span className="font-mono text-fg">
              {quotaUsed}/{quotaTotal} Docs
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-line/50">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(quotaUsed / quotaTotal) * 100}%` }} />
          </div>
        </div>
        <Link href="/docs" className="flex items-center gap-2 px-1 text-xs text-fg-secondary hover:text-fg">
          <Icon name="help_outline" className="text-[16px]" /> Documentation & Support
        </Link>
      </div>
    </aside>
  );
}

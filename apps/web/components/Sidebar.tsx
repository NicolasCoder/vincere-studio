"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cn } from "@vincere-studio/ui";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: string;
  live?: boolean;
  accent?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  defaultOpen?: boolean;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    id: "criar",
    title: "CRIAR",
    defaultOpen: true,
    items: [
      { href: "/dashboard", icon: "home", label: "Início" },
      { href: "/workflow", icon: "account_tree", label: "Copiloto & Fluxo", badge: "IA", accent: true },
      { href: "/studio", icon: "movie_filter", label: "HyperFrames Studio" },
      { href: "/tendencias", icon: "trending_up", label: "Tendências" },
    ],
  },
  {
    id: "motion-dex",
    title: "MOTION DEX",
    defaultOpen: true,
    items: [
      { href: "/sharingan", icon: "visibility", label: "Clonagem (Sharingan)", badge: "GPU", accent: true },
      { href: "/motion-dex", icon: "auto_awesome_motion", label: "MotionDex", live: true },
    ],
  },
  {
    id: "gerar-ia",
    title: "GERAR COM IA",
    defaultOpen: false,
    items: [
      { href: "/flow-studio", icon: "movie", label: "Imagem e Vídeo (Flow)" },
      { href: "/prompts", icon: "photo_library", label: "Biblioteca de Prompts" },
      { href: "/voice-studio", icon: "record_voice_over", label: "Vozes & Whisper" },
    ],
  },
  {
    id: "biblioteca",
    title: "BIBLIOTECA",
    defaultOpen: false,
    items: [
      { href: "/skills", icon: "school", label: "Skills e Receitas" },
      { href: "/tipografia", icon: "text_fields", label: "Tipografia" },
      { href: "/references", icon: "bookmarks", label: "Referências" },
      { href: "/assets", icon: "video_library", label: "Mídias" },
      { href: "/channels", icon: "smart_display", label: "Canais" },
      { href: "/metrics", icon: "monitoring", label: "Métricas" },
    ],
  },
  {
    id: "sistema",
    title: "SISTEMA & OUTROS",
    defaultOpen: false,
    items: [
      { href: "/settings", icon: "settings", label: "Configurações" },
      { href: "/copiloto", icon: "linear_scale", label: "Esteira Linear" },
      { href: "/talking-head", icon: "person_pin", label: "Talking Head & Cortes" },
      { href: "/projects", icon: "view_kanban", label: "Quadro de Projetos" },
      { href: "/docs", icon: "help_outline", label: "Ajuda" },
    ],
  },
];

export function Sidebar({
  docsCount,
  quotaUsed,
  quotaTotal,
  youtubeConnected,
}: {
  docsCount: number;
  quotaUsed: number;
  quotaTotal: number;
  youtubeConnected?: boolean;
}) {
  const path = usePathname();

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const sec of sections) {
      const hasActive = sec.items.some(
        (item) => path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href)),
      );
      initial[sec.id] = Boolean(sec.defaultOpen || hasActive);
    }
    return initial;
  });

  // Garante que a seção da rota atual abra automaticamente ao navegar
  useEffect(() => {
    for (const sec of sections) {
      const hasActive = sec.items.some(
        (item) => path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href)),
      );
      if (hasActive) {
        setOpenMap((prev) => (prev[sec.id] ? prev : { ...prev, [sec.id]: true }));
      }
    }
  }, [path]);

  const toggleSection = (id: string) => {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col border-r border-white/[0.06] bg-surface-low/95 backdrop-blur-2xl transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] peer-checked/nav:translate-x-0 lg:translate-x-0 overflow-y-auto">
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
        <Image src="/vincere-mark.png" alt="" width={32} height={32} className="size-8 shrink-0 object-contain" priority />
        <div>
          <div className="font-display text-[15px] font-semibold tracking-tight leading-tight text-fg">Vincere</div>
          <div className="text-[10px] font-medium tracking-wider uppercase text-muted">Studio</div>
        </div>
        <label
          htmlFor="mobile-nav-toggle"
          className="ml-auto grid size-8 place-items-center rounded-lg text-fg-secondary hover:bg-white/[0.06] hover:text-fg lg:hidden"
        >
          <Icon name="close" className="text-[18px]" />
        </label>
      </Link>

      <nav className="mt-3 flex flex-col gap-3 px-3 pb-6">
        {sections.map((sec) => {
          const isOpen = !!openMap[sec.id];
          const hasActiveChild = sec.items.some(
            (item) => path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href)),
          );

          return (
            <div key={sec.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors duration-150 select-none",
                  hasActiveChild ? "text-fg-secondary" : "text-muted/80 hover:text-fg-secondary",
                )}
              >
                <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                  {sec.title}
                </span>
                <Icon
                  name={isOpen ? "expand_less" : "expand_more"}
                  className="text-[14px] opacity-60 transition-transform duration-150"
                />
              </button>

              {isOpen && (
                <div className="space-y-0.5 pt-0.5">
                  {sec.items.map((item) => {
                    const active = path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]",
                          active
                            ? "bg-primary/15 text-fg font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                            : "text-fg-secondary hover:bg-white/[0.04] hover:text-fg",
                        )}
                      >
                        <Icon
                          name={item.icon}
                          className={cn(
                            "text-[17px] transition-colors",
                            active ? "text-primary-bright" : "text-muted group-hover:text-fg-secondary",
                          )}
                          filled={active}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.href === "/channels" && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-medium tracking-wide",
                              youtubeConnected
                                ? "bg-primary/15 text-primary-bright"
                                : "bg-white/[0.05] text-muted",
                            )}
                          >
                            {youtubeConnected ? "Ativo" : "Off"}
                          </span>
                        )}
                        {item.badge && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-medium tracking-wide",
                              item.accent
                                ? "bg-primary/15 text-primary-bright"
                                : "bg-white/[0.06] text-muted",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.05] px-4 py-3.5 text-[11px] leading-relaxed text-muted">
        Clique no <span className="text-primary-bright font-medium">Vince</span> no canto inferior para pedir qualquer criação.
      </div>
    </aside>
  );
}

"use client";
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
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "CRIAR",
    items: [
      { href: "/dashboard", icon: "home", label: "Início" },
      { href: "/projects", icon: "movie", label: "Projetos (Dark & Doc)" },
      { href: "/talking-head", icon: "person_pin", label: "Talking Head & Reels", badge: "Novo", live: true },
      { href: "/studio", icon: "movie_filter", label: "HyperFrames Studio", accent: true },
      { href: "/tendencias", icon: "trending_up", label: "Tendências" },
      { href: "/copilot", icon: "edit_note", label: "Roteiro em beats" },
    ],
  },
  {
    title: "GERAR COM IA",
    items: [
      { href: "/sharingan", icon: "visibility", label: "Clonagem (Sharingan)", badge: "Local/Cloud", accent: true },
      { href: "/flow-studio", icon: "auto_awesome", label: "Imagem e vídeo (Flow)" },
      { href: "/prompts", icon: "photo_library", label: "Biblioteca de prompts" },
      { href: "/voice-studio", icon: "record_voice_over", label: "Vozes (Duas Vias)" },
      { href: "/workflow", icon: "account_tree", label: "Workflow nodal" },
    ],
  },
  {
    title: "BIBLIOTECA",
    items: [
      { href: "/skills", icon: "school", label: "Skills e receitas" },
      { href: "/tipografia", icon: "text_fields", label: "Tipografia" },
      { href: "/references", icon: "collections_bookmark", label: "Referências" },
      { href: "/assets", icon: "video_library", label: "Mídias" },
      { href: "/channels", icon: "smart_display", label: "Canais" },
      { href: "/metrics", icon: "monitoring", label: "Métricas" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { href: "/health", icon: "monitor_heart", label: "Saúde" },
      { href: "/settings", icon: "settings", label: "Configurações" },
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
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col border-r border-line bg-surface-low transition-transform duration-200 peer-checked/nav:translate-x-0 lg:translate-x-0 lg:bg-surface-low/95 overflow-y-auto">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-5 border-b border-line/40">
        <Image src="/vincere-mark.png" alt="" width={36} height={36} className="size-9 shrink-0 object-contain" priority />
        <div>
          <div className="font-display text-base font-bold leading-tight">Vincere</div>
          <div className="label-mono text-muted text-[11px]">Studio</div>
        </div>
        <label htmlFor="mobile-nav-toggle" className="ml-auto grid size-8 place-items-center rounded text-fg-secondary hover:bg-line/40 hover:text-fg lg:hidden">
          <Icon name="close" className="text-[18px]" />
        </label>
      </Link>

      <nav className="mt-3 flex flex-col gap-4 px-3 pb-6">
        {sections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <div className="px-3 text-[10px] font-mono tracking-wider text-muted font-bold">
              {sec.title}
            </div>
            {sec.items.map((item) => {
              const active = path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded px-3 py-2 text-[13px] transition-colors",
                    active
                      ? "border-l-2 border-primary bg-primary/10 text-primary-bright font-medium"
                      : "text-fg-secondary hover:bg-line/30 hover:text-fg",
                  )}
                >
                  <Icon name={item.icon} className="text-[18px]" filled={active} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.href === "/channels" && (
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-wider",
                        youtubeConnected ? "border-primary/40 bg-primary/10 text-primary-bright" : "border-line text-muted",
                      )}
                    >
                      {youtubeConnected && <span className="mr-1 inline-block size-1.5 rounded-full bg-primary-bright align-middle" />}
                      {youtubeConnected ? "Conectado" : "Conectar"}
                    </span>
                  )}
                  {item.badge && (
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-wider",
                        item.accent
                          ? "border-secondary/40 bg-secondary/20 text-secondary-soft"
                          : item.live
                            ? "border-primary/40 bg-primary/10 text-primary-bright"
                            : "border-line text-muted",
                      )}
                    >
                      {item.live && <span className="mr-1 inline-block size-1.5 rounded-full bg-primary-bright align-middle" />}
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-line p-4 text-[11px] leading-relaxed text-muted">
        Dúvida em qualquer tela? Use <span className="text-primary-bright">Chamar o Claude</span> no canto inferior.
      </div>
    </aside>
  );
}

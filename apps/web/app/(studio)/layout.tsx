import Image from "next/image";
import { Icon } from "@vincere-studio/ui";
import { Sidebar } from "@/components/Sidebar";
import { ClaudeButton } from "@/components/ClaudeButton";
import { AutoHealingMonitor } from "@/components/AutoHealingMonitor";
import { getUsageSummary, listProjects } from "@/lib/data";
import { getYoutubeConnection } from "@vincere-studio/providers";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const [projects, usage, youtubeConnection] = await Promise.all([listProjects(), getUsageSummary(), getYoutubeConnection()]);
  const rendered = projects.filter((p) => p.status === "PUBLISHED").length;
  return (
    <div className="grid-overlay min-h-screen">
      {/* Toggle de navegação mobile: só CSS (checkbox hack), sem JS — funciona em Server Components. */}
      <input type="checkbox" id="mobile-nav-toggle" className="peer/nav hidden" />
      <label
        htmlFor="mobile-nav-toggle"
        aria-hidden="true"
        className="fixed inset-0 z-20 hidden bg-void/70 backdrop-blur-sm peer-checked/nav:block lg:hidden"
      />
      <Sidebar docsCount={projects.length} quotaUsed={rendered} quotaTotal={20} youtubeConnected={!!youtubeConnection} />
      <div className="lg:pl-64">
        {/* Barra móvel: garante o menu em todas as telas, inclusive as que não usam Topbar. */}
        <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-void/90 px-3 backdrop-blur-md lg:hidden">
          <label htmlFor="mobile-nav-toggle" className="grid size-9 place-items-center rounded text-fg-secondary hover:bg-line/40 hover:text-fg" aria-label="Abrir menu">
            <Icon name="menu" className="text-[22px]" />
          </label>
          <Image src="/vincere-mark.png" alt="" width={24} height={24} className="size-6 object-contain" />
          <span className="font-display text-sm font-bold">Vincere Studio</span>
        </div>
        <div data-cost={usage.costUsd}>{children}</div>
      </div>
      <AutoHealingMonitor />
      <ClaudeButton />
    </div>
  );
}

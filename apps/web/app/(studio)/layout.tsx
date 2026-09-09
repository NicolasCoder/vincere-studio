import { Sidebar } from "@/components/Sidebar";
import { getUsageSummary, listProjects } from "@/lib/data";
import { getYoutubeConnection } from "@docupulse/providers";

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
      <div className="lg:pl-sidebar">
        {/* usage disponível para as páginas via props se necessário */}
        <div data-cost={usage.costUsd}>{children}</div>
      </div>
    </div>
  );
}

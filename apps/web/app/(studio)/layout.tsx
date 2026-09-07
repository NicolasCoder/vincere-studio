import { Sidebar } from "@/components/Sidebar";
import { getUsageSummary, listProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const [projects, usage] = await Promise.all([listProjects(), getUsageSummary()]);
  const rendered = projects.filter((p) => p.status === "PUBLISHED").length;
  return (
    <div className="grid-overlay min-h-screen">
      <Sidebar docsCount={projects.length} quotaUsed={rendered} quotaTotal={20} />
      <div className="pl-sidebar">
        {/* usage disponível para as páginas via props se necessário */}
        <div data-cost={usage.costUsd}>{children}</div>
      </div>
    </div>
  );
}

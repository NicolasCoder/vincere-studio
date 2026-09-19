// scripts/list-projects.ts
// Lista todos os projetos do PulseStudio (id, nome, status, quando foi criado) para você decidir
// o que apagar. Rodar da raiz do repo:
//   cd C:\Users\Igor\Documents\PulseStudio
//   npx tsx scripts/list-projects.ts
//
// (Se der erro de módulo, rode primeiro: pnpm install tsx --save-dev -w)

import { prisma } from "@docupulse/db";

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      renderJobs: { select: { id: true, outputPath: true, startedAt: true, reviewStatus: true } },
      publications: { select: { id: true, videoId: true, url: true, privacyStatus: true } },
    },
  });

  if (!projects.length) {
    console.log("Nenhum projeto encontrado no banco.");
    return;
  }

  console.log(`\n${projects.length} projeto(s) encontrado(s):\n`);
  for (const p of projects) {
    console.log(`ID: ${p.id}`);
    console.log(`  Título: ${p.title ?? "(sem título)"}`);
    console.log(`  Etapa: ${p.stage} | Status: ${p.status}`); // stage/status = onde está na fila
    console.log(`  Criado em: ${p.createdAt.toLocaleString("pt-BR")}`);
    console.log(`  Renders: ${p.renderJobs.length}${p.renderJobs.length ? " (" + p.renderJobs.map(r => r.reviewStatus).join(", ") + ")" : ""}`);
    console.log(`  Publicações: ${p.publications.length ? p.publications.map(pub => `${pub.privacyStatus}${pub.videoId ? " (" + pub.url + ")" : ""}`).join(", ") : "nenhuma"}`);
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error("Erro ao listar projetos:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

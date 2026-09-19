// scripts/delete-projects.ts
// Apaga projetos específicos: registros no banco (Project, Script, Scene, RenderJob,
// Publication, Job, EditPlan etc. via cascade do Prisma) + os arquivos em disco
// (storage/projects/<id>/). NÃO toca em Setting, ScriptSkill, ReferenceChannel — configurações
// do app (YouTube conectado, orçamento, skills de roteiro salvas) ficam intactas.
//
// Uso (da raiz do repo):
//   npx tsx scripts/delete-projects.ts <projectId1> <projectId2> ...
//
// Rode scripts/list-projects.ts primeiro para pegar os IDs certos.
// Por segurança, roda em modo "dry run" (só mostra o que faria) a menos que você passe --confirm.
//
//   npx tsx scripts/delete-projects.ts <ids...>            -> dry run, não apaga nada
//   npx tsx scripts/delete-projects.ts <ids...> --confirm   -> apaga de verdade

import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@docupulse/db";

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const ids = args.filter((a) => a !== "--confirm");

  if (!ids.length) {
    console.log("Uso: npx tsx scripts/delete-projects.ts <projectId...> [--confirm]");
    process.exit(1);
  }

  const projects = await prisma.project.findMany({ where: { id: { in: ids } } });
  if (!projects.length) {
    console.log("Nenhum dos IDs informados foi encontrado no banco.");
    return;
  }

  console.log(confirm ? "MODO CONFIRMADO — vai apagar de verdade:\n" : "DRY RUN — nada será apagado ainda:\n");

  for (const p of projects) {
    const dir = path.resolve("storage", "projects", p.id);
    console.log(`- ${p.id} (${p.title ?? "sem título"})`);
    console.log(`  pasta: ${dir} ${existsSync(dir) ? "(existe)" : "(não existe no disco)"}`);

    if (confirm) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
        console.log("  -> pasta apagada");
      }
      await prisma.project.delete({ where: { id: p.id } });
      console.log("  -> registro do banco apagado (cascade: scripts, cenas, renders, publicações, jobs)");
    }
  }

  const notFound = ids.filter((id) => !projects.some((p) => p.id === id));
  if (notFound.length) console.log(`\nIDs não encontrados (ignorados): ${notFound.join(", ")}`);

  if (!confirm) {
    console.log("\nNada foi apagado (dry run). Confira a lista acima e rode de novo com --confirm no final.");
  } else {
    console.log(`\n${projects.length} projeto(s) apagado(s) com sucesso.`);
  }
}

main()
  .catch((err) => {
    console.error("Erro ao apagar projetos:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

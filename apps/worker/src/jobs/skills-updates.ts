import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { prisma } from "@vincere-studio/db";
import type { JobContext } from "../queue";

export interface SkillUpdateReport {
  timestamp: string;
  skillsDirFound: string[];
  totalSkillsDetected: number;
  skills: {
    name: string;
    locations: { path: string; modifiedAt: string; hasSkillMd: boolean }[];
    status: "up_to_date" | "outdated" | "missing_in_target" | "updated";
    actionTaken?: string;
  }[];
  updatedCount: number;
}

async function copyDirRecursive(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * CHECK_SKILLS_UPDATES: varre as pastas de skills dos agentes de IA instalados na máquina
 * (~/.gemini/config/skills para Antigravity e ~/.claude/skills para Claude Code, além de ~/.agents/skills),
 * compara versões e atualiza/sincroniza as skills com os arquivos mais recentes.
 */
export async function checkSkillsUpdates(ctx: JobContext): Promise<SkillUpdateReport> {
  const autoUpdate = ctx.payload.autoUpdate !== false; // padrão true
  const userHome = process.env.USERPROFILE || process.env.HOME || "";

  await ctx.progress({ percent: 10, message: "Localizando diretórios de skills no computador..." });

  const targetDirs = [
    path.join(userHome, ".gemini", "config", "skills"),
    path.join(userHome, ".claude", "skills"),
    path.join(userHome, ".agents", "skills"),
    path.join(userHome, ".codex", "skills"),
  ].filter((p) => existsSync(p));

  // Inclui diretório de skills local do repositório se existir
  const repoSkills = [
    path.resolve(process.cwd(), "skills"),
    path.resolve(process.cwd(), "..", "..", "skills"),
  ].find((p) => existsSync(p));

  const allSearchDirs = [...targetDirs];
  if (repoSkills && !allSearchDirs.includes(repoSkills)) {
    allSearchDirs.push(repoSkills);
  }

  await ctx.log(`Diretórios de skills encontrados (${allSearchDirs.length}): ${allSearchDirs.join(", ")}`);

  const skillRegistry = new Map<
    string,
    { path: string; parentDir: string; modifiedAt: Date; hasSkillMd: boolean }[]
  >();

  await ctx.progress({ percent: 30, message: "Varrendo e indexando skills instaladas..." });

  for (const dir of allSearchDirs) {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory()) continue;
        const skillName = item.name.toLowerCase();
        const skillPath = path.join(dir, item.name);
        const skillMd = path.join(skillPath, "SKILL.md");
        const hasSkillMd = existsSync(skillMd);

        let mtime = new Date(0);
        try {
          const stat = await fs.stat(hasSkillMd ? skillMd : skillPath);
          mtime = stat.mtime;
        } catch {}

        if (!skillRegistry.has(skillName)) {
          skillRegistry.set(skillName, []);
        }
        skillRegistry.get(skillName)!.push({
          path: skillPath,
          parentDir: dir,
          modifiedAt: mtime,
          hasSkillMd,
        });
      }
    } catch (err) {
      await ctx.log(`Aviso ao ler ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await ctx.progress({ percent: 60, message: "Comparando versões e verificando atualizações..." });

  let updatedCount = 0;
  const reportSkills: SkillUpdateReport["skills"] = [];

  for (const [name, locs] of skillRegistry.entries()) {
    // Encontra a versão com maior data de modificação
    const newest = [...locs].sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())[0];
    let status: SkillUpdateReport["skills"][0]["status"] = "up_to_date";
    let actionTaken: string | undefined;

    // Se temos mais de um diretório de agente e a skill não está em todos os diretórios principais
    const missingIn = targetDirs.filter(
      (td) => !locs.some((l) => path.resolve(l.parentDir) === path.resolve(td)),
    );

    const outdatedLocs = locs.filter(
      (l) => l.path !== newest.path && newest.modifiedAt.getTime() - l.modifiedAt.getTime() > 1000,
    );

    if (missingIn.length > 0 || outdatedLocs.length > 0) {
      status = outdatedLocs.length > 0 ? "outdated" : "missing_in_target";

      if (autoUpdate && newest.hasSkillMd) {
        // Atualiza os desatualizados
        for (const out of outdatedLocs) {
          try {
            await copyDirRecursive(newest.path, out.path);
            actionTaken = `Sincronizado ${newest.parentDir} -> ${out.path}`;
            updatedCount++;
            status = "updated";
            await ctx.log(`[skill:${name}] Atualizada versão mais recente para: ${out.path}`);
          } catch (err) {
            await ctx.log(`Erro ao atualizar ${name} em ${out.path}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        // Propaga para os diretórios onde estava ausente
        for (const missDir of missingIn) {
          try {
            const dest = path.join(missDir, path.basename(newest.path));
            await copyDirRecursive(newest.path, dest);
            actionTaken = (actionTaken ? `${actionTaken}; ` : "") + `Instalado em ${missDir}`;
            updatedCount++;
            status = "updated";
            await ctx.log(`[skill:${name}] Instalada no agente: ${dest}`);
          } catch (err) {
            await ctx.log(`Erro ao instalar ${name} em ${missDir}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    reportSkills.push({
      name,
      locations: locs.map((l) => ({
        path: l.path,
        modifiedAt: l.modifiedAt.toISOString(),
        hasSkillMd: l.hasSkillMd,
      })),
      status,
      actionTaken,
    });
  }

  await ctx.progress({ percent: 90, message: "Gravando relatório de atualização..." });

  const finalReport: SkillUpdateReport = {
    timestamp: new Date().toISOString(),
    skillsDirFound: allSearchDirs,
    totalSkillsDetected: skillRegistry.size,
    skills: reportSkills,
    updatedCount,
  };

  // Salva no banco Setting para consulta rápida da interface
  await prisma.setting.upsert({
    where: { key: "skills_update_status" },
    create: { key: "skills_update_status", value: JSON.stringify(finalReport) },
    update: { value: JSON.stringify(finalReport) },
  });

  await ctx.log(
    `Verificação concluída: ${skillRegistry.size} skills analisadas em ${allSearchDirs.length} pastas. Atualizadas: ${updatedCount}.`,
  );

  return finalReport;
}

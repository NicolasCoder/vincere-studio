import { prisma } from "@docupulse/db";
import { unstable_noStore as noStore } from "next/cache";

/** Acesso a dados usado pelos Server Components. Sempre lê o SQLite ao vivo. */

export async function listProjects() {
  noStore();
  return prisma.project.findMany({ orderBy: { updatedAt: "desc" }, include: { publications: true } });
}

export async function getProject(id: string) {
  noStore();
  return prisma.project.findUnique({
    where: { id },
    include: {
      ideas: { orderBy: { score: "desc" } },
      scripts: { orderBy: { version: "desc" }, take: 1, include: { blocks: { orderBy: { order: "asc" } } } },
      renderJobs: { orderBy: { startedAt: "desc" }, take: 1 },
      publications: true,
      usage: true,
    },
  });
}

export async function getUsageSummary() {
  noStore();
  const rows = await prisma.usage.findMany();
  const costUsd = rows.reduce((s, r) => s + r.costUsd, 0);
  return { costUsd, entries: rows.length };
}

export async function listJobs(limit = 20) {
  noStore();
  return prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { project: true } });
}

export async function getSettings() {
  noStore();
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}

export const fmtDuration = (s?: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")} min`;
};

export const fmtMs = (ms?: number | null) => {
  if (ms == null) return "--:--";
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export const parseJson = <T,>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** Cria os perfis de voz padrão na primeira vez (sem precisar rodar o seed). */
export async function ensureDefaultVoiceProfiles() {
  if ((await prisma.voiceProfile.count()) > 0) return;
  await prisma.voiceProfile.createMany({
    data: [
      { name: "Narrador Dark (Charon)", provider: "GEMINI_TTS", voiceId: "Charon", style: "Narre em português do Brasil, tom grave, ritmo lento e misterioso, como um documentário investigativo de alta produção. Pausas naturais, sem exagero teatral.", rate: 1.0, fallbacks: JSON.stringify([{ provider: "EDGE_TTS", voiceId: "pt-BR-AntonioNeural" }]), isDefault: true },
      { name: "Narradora Investigativa (Kore)", provider: "GEMINI_TTS", voiceId: "Kore", style: "Narre em português do Brasil, voz firme e clara, tom investigativo e envolvente.", rate: 1.0, fallbacks: JSON.stringify([{ provider: "EDGE_TTS", voiceId: "pt-BR-FranciscaNeural" }]) },
      { name: "Infantil Animado (Puck)", provider: "GEMINI_TTS", voiceId: "Puck", style: "Narre em português do Brasil com energia alegre e acolhedora, como um contador de histórias para crianças.", rate: 1.05, fallbacks: JSON.stringify([{ provider: "EDGE_TTS", voiceId: "pt-BR-ThalitaNeural" }]) },
      { name: "Antônio (Edge, grátis)", provider: "EDGE_TTS", voiceId: "pt-BR-AntonioNeural", style: "", rate: 1.0, fallbacks: JSON.stringify([{ provider: "GEMINI_TTS", voiceId: "Charon" }]) },
    ],
  });
}

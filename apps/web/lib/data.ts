import path from "node:path";
import { readdir, stat } from "node:fs/promises";
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

/**
 * Data do arquivo .ts mais recente entre os que o worker executa.
 *
 * Varre só os diretórios de código do worker e dos pacotes que ele importa — não o repositório
 * inteiro, senão qualquer edição de documentação marcaria o worker como desatualizado.
 */
async function maisRecenteNoWorker(): Promise<Date | null> {
  const raiz = path.resolve(process.cwd(), "..", "..");
  const alvos = [
    path.join(raiz, "apps", "worker", "src"),
    path.join(raiz, "packages", "core", "src"),
    path.join(raiz, "packages", "providers", "src"),
    path.join(raiz, "packages", "render", "src"),
  ];

  let maior = 0;
  const visitar = async (dir: string) => {
    const itens = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const it of itens) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) await visitar(p);
      else if (it.name.endsWith(".ts") || it.name.endsWith(".tsx")) {
        const s = await stat(p).catch(() => null);
        if (s && s.mtimeMs > maior) maior = s.mtimeMs;
      }
    }
  };
  for (const a of alvos) await visitar(a);
  return maior ? new Date(maior) : null;
}

/** Painel de saúde do sistema: worker vivo (heartbeat), fila, jobs travados e falhas recentes. */
export async function getSystemHealth() {
  noStore();
  const [heartbeatSetting, subidaSetting, counts, stuckJobs, recentFailed] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "worker_heartbeat" } }),
    prisma.setting.findUnique({ where: { key: "worker_started_at" } }),
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    // RUNNING há mais de 20min sem nenhuma atualização de progresso/log = provável travamento.
    prisma.job.findMany({
      where: { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - 20 * 60 * 1000) } },
      include: { project: true },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.job.findMany({
      where: { status: "FAILED" },
      orderBy: { finishedAt: "desc" },
      take: 5,
      include: { project: true },
    }),
  ]);

  const heartbeatAt = heartbeatSetting ? new Date(heartbeatSetting.value) : null;
  const heartbeatAgeMs = heartbeatAt ? Date.now() - heartbeatAt.getTime() : null;
  // heartbeat a cada 15s; folga generosa pra não falsear "offline" por um tick lento.
  const workerStatus: "online" | "atencao" | "offline" =
    heartbeatAgeMs == null ? "offline" : heartbeatAgeMs < 60_000 ? "online" : heartbeatAgeMs < 5 * 60_000 ? "atencao" : "offline";

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;

  // Worker desatualizado: o processo roda por tsx sem observador, então código novo só entra com
  // restart. Quem corrige um job e esquece de reiniciar continua recebendo o erro já corrigido,
  // sem nada na tela indicando isso. Comparar a subida do worker com a data do arquivo de código
  // mais recente transforma esse silêncio num aviso.
  const subidaAt = subidaSetting ? new Date(subidaSetting.value) : null;
  const codigoAt = await maisRecenteNoWorker();
  const workerDesatualizado = !!(subidaAt && codigoAt && codigoAt.getTime() > subidaAt.getTime());

  return {
    workerStatus,
    heartbeatAt,
    heartbeatAgeMs,
    subidaAt,
    codigoAt,
    workerDesatualizado,
    queued: byStatus.QUEUED ?? 0,
    running: byStatus.RUNNING ?? 0,
    done: byStatus.DONE ?? 0,
    failed: byStatus.FAILED ?? 0,
    stuckJobs,
    recentFailed,
  };
}

export const fmtAge = (ms: number | null) => {
  if (ms == null) return "nunca";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}min atrás`;
};

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

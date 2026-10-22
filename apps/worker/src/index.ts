import { prisma, type Job } from "@vincere-studio/db";
import type { JobType } from "@vincere-studio/core";
import { claimNext, fail, finish, makeContext } from "./queue";
import { handlers } from "./jobs";
import { carregarChavesNoAmbiente } from "@vincere-studio/providers";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 1000);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const HEARTBEAT_MS = 15_000;
// Pipeline paralelo: quantos jobs o worker processa ao mesmo tempo (jobs de tipos
// diferentes, de projetos diferentes ou não). RENDER_VIDEO fica de fora da conta —
// só um por vez, sempre, porque é o único que pesa de verdade em CPU/RAM (ffmpeg).
const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 2));
const HEAVY_TYPES = ["RENDER_VIDEO", "TALKING_HEAD_PIPELINE", "SHARINGAN_CLONE"];

/** Grava um "pulso" periódico na tabela Setting, pra o painel de saúde do sistema saber
 * se o worker está vivo mesmo sem nenhum job em andamento. */
async function heartbeat() {
  await prisma.setting.upsert({
    where: { key: "worker_heartbeat" },
    create: { key: "worker_heartbeat", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });
}

/**
 * Registra QUANDO este processo subiu, para a tela de saúde detectar worker desatualizado.
 *
 * O worker roda por tsx sem observador: código novo só entra com restart. Quando alguém corrige
 * um job, commita e esquece de reiniciar, a ferramenta segue executando o código velho e o mesmo
 * erro reaparece — foi o que aconteceu três vezes num dia. Comparando este instante com a data
 * do arquivo de código mais recente, a tela consegue dizer "worker desatualizado" em vez de
 * repetir um erro já corrigido.
 */
async function registrarSubida() {
  await prisma.setting.upsert({
    where: { key: "worker_started_at" },
    create: { key: "worker_started_at", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });
}

async function notify(event: string, data: unknown) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, data, at: new Date().toISOString() }) });
  } catch (e) {
    console.warn("webhook falhou:", (e as Error).message);
  }
}

// Jobs em andamento agora (id -> type), pra saber quantos slots estão ocupados
// e se algum job "pesado" (RENDER_VIDEO) já está rodando.
const inFlight = new Map<string, string>();

async function runJob(job: Job) {
  const ctx = makeContext(job);
  const handler = handlers[job.type as JobType];
  try {
    if (!handler) throw new Error(`Tipo de job desconhecido: ${job.type}`);
    // Chaves salvas pela interface valem na hora, sem reiniciar o worker; falha aqui não derruba o job.
    await carregarChavesNoAmbiente().catch((err) => console.error("[chaves] não foi possível carregar as chaves salvas:", err instanceof Error ? err.message : err));
    const result = await handler(ctx);
    await finish(job, result);
    await notify("job.done", { id: job.id, type: job.type, projectId: job.projectId, result });
  } catch (err) {
    await fail(job, err);
    await notify("job.failed", { id: job.id, type: job.type, projectId: job.projectId, error: String(err) });
  } finally {
    inFlight.delete(job.id);
  }
}

/** Tenta preencher vagas livres reivindicando novos jobs QUEUED, respeitando o
 * limite de concorrência geral e a exclusividade dos tipos pesados. Dispara cada
 * job sem esperar terminar (fire-and-forget controlado pelo mapa inFlight). */
async function fillSlots() {
  while (inFlight.size < CONCURRENCY) {
    const heavyRunning = HEAVY_TYPES.some((t) => [...inFlight.values()].includes(t));
    const exclude = heavyRunning ? HEAVY_TYPES : [];
    const job = await claimNext(exclude).catch((e) => {
      console.error("claim error", e);
      return null;
    });
    if (!job) break;
    inFlight.set(job.id, job.type);
    void runJob(job);
  }
}

async function main() {
  // Com vários jobs escrevendo no SQLite ao mesmo tempo (pipeline paralelo), o modo
  // padrão ("rollback journal") trava fácil com SQLITE_BUSY. WAL permite leituras
  // concorrentes com uma escrita, e busy_timeout faz quem colidir esperar e tentar
  // de novo em vez de falhar na hora. Configuração persiste no arquivo do banco.
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch((e) => console.warn("WAL falhou:", (e as Error).message));
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;").catch((e) => console.warn("busy_timeout falhou:", (e as Error).message));

  // Jobs que ficaram RUNNING de uma execução anterior voltam para a fila.
  const reset = await prisma.job.updateMany({ where: { status: "RUNNING" }, data: { status: "QUEUED" } });
  console.log(`Vincere worker online · concorrência ${CONCURRENCY} (+ RENDER_VIDEO exclusivo) · poll ${POLL_MS}ms · ${reset.count} job(s) recuperado(s)`);
  await heartbeat().catch((e) => console.warn("heartbeat falhou:", (e as Error).message));
  await registrarSubida().catch((e) => console.warn("registro de subida falhou:", (e as Error).message));
  let lastHeartbeat = Date.now();
  for (;;) {
    if (!encerrando) await fillSlots().catch((e) => console.error("fillSlots error", e));
    if (encerrando && inFlight.size === 0) {
      console.log("Worker encerrado sem job pela metade.");
      process.exit(0);
    }
    if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
      lastHeartbeat = Date.now();
      await heartbeat().catch((e) => console.warn("heartbeat falhou:", (e as Error).message));
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/**
 * Desligamento gracioso: para de pegar job novo e espera o que está rodando terminar.
 *
 * Sem isto, encerrar o worker no meio de um APPLY_VISUAL_LAYER joga 25 minutos de render fora —
 * o job volta para a fila como QUEUED e recomeça do zero na próxima subida. E isso acontece
 * toda vez que o processo é derrubado para carregar código novo, que é o caso mais comum.
 *
 * O segundo sinal força a saída: quem aperta duas vezes quer sair agora, e ficar refém de um
 * render longo seria pior que perder o render.
 */
let encerrando = false;
for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    if (encerrando) {
      console.log(`${sinal} de novo — saindo agora, ${inFlight.size} job(s) voltam para a fila.`);
      process.exit(1);
    }
    encerrando = true;
    console.log(
      inFlight.size
        ? `${sinal} recebido: terminando ${inFlight.size} job(s) em andamento antes de sair. Repita o sinal para sair agora.`
        : `${sinal} recebido: nada em andamento, saindo.`,
    );
  });
}

main();

import { prisma } from "@docupulse/db";
import type { JobType } from "@docupulse/core";
import { claimNext, fail, finish, makeContext } from "./queue";
import { handlers } from "./jobs";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 1000);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const HEARTBEAT_MS = 15_000;

/** Grava um "pulso" periódico na tabela Setting, pra o painel de saúde do sistema saber
 * se o worker está vivo mesmo sem nenhum job em andamento. */
async function heartbeat() {
  await prisma.setting.upsert({
    where: { key: "worker_heartbeat" },
    create: { key: "worker_heartbeat", value: new Date().toISOString() },
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

async function tick() {
  const job = await claimNext();
  if (!job) return false;
  const ctx = makeContext(job);
  const handler = handlers[job.type as JobType];
  try {
    if (!handler) throw new Error(`Tipo de job desconhecido: ${job.type}`);
    const result = await handler(ctx);
    await finish(job, result);
    await notify("job.done", { id: job.id, type: job.type, projectId: job.projectId, result });
  } catch (err) {
    await fail(job, err);
    await notify("job.failed", { id: job.id, type: job.type, projectId: job.projectId, error: String(err) });
  }
  return true;
}

async function main() {
  // Jobs que ficaram RUNNING de uma execução anterior voltam para a fila.
  const reset = await prisma.job.updateMany({ where: { status: "RUNNING" }, data: { status: "QUEUED" } });
  console.log(`DocuPulse worker online · poll ${POLL_MS}ms · ${reset.count} job(s) recuperado(s)`);
  await heartbeat().catch((e) => console.warn("heartbeat falhou:", (e as Error).message));
  let lastHeartbeat = Date.now();
  for (;;) {
    const did = await tick().catch((e) => {
      console.error("tick error", e);
      return false;
    });
    if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
      lastHeartbeat = Date.now();
      await heartbeat().catch((e) => console.warn("heartbeat falhou:", (e as Error).message));
    }
    if (!did) await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();

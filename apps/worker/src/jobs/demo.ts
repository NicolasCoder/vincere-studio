import type { JobContext } from "../queue";

/** Job de teste: simula etapas com progresso, para validar fila, UI e webhook. */
export async function demo(ctx: JobContext) {
  const steps = Number(ctx.payload.steps ?? 10);
  const delayMs = Number(ctx.payload.delayMs ?? 500);
  await ctx.log(`Iniciando job demo com ${steps} etapas`);
  for (let i = 1; i <= steps; i++) {
    if (await ctx.isCancelled()) {
      await ctx.log("Cancelado pelo usuário");
      return { cancelled: true };
    }
    await new Promise((r) => setTimeout(r, delayMs));
    await ctx.progress({ percent: (i / steps) * 100, message: `Etapa ${i}/${steps}`, etaSeconds: ((steps - i) * delayMs) / 1000 });
  }
  await ctx.log("Concluído");
  return { steps };
}

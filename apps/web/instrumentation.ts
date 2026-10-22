// Executa uma vez quando o servidor do Next inicia: faz as chaves de API salvas em Configurações valerem
// neste processo (o valor salvo na tela vence o do .env). O worker faz o mesmo antes de cada job.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Durante o `next build` não há banco de uso: não tentar carregar as chaves.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { carregarChavesNoAmbiente } = await import("@vincere-studio/providers");
    await carregarChavesNoAmbiente();
  } catch (err) {
    console.error("[chaves] não foi possível carregar as chaves salvas:", err instanceof Error ? err.message : err);
  }
}

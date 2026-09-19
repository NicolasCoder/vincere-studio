import { defineConfig } from "vitest/config";

// IGO-7: smoke test das páginas críticas — roda contra um build de produção real
// (next build && next start numa porta separada), não contra o servidor de dev do
// Igor. Timeout generoso porque o build sozinho já leva dezenas de segundos.
export default defineConfig({
  test: {
    include: ["**/*.smoke.test.ts"],
    environment: "node",
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});

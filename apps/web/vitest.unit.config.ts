import { defineConfig } from "vitest/config";

// Testes unitários de lib/ (lógica pura, sem servidor nem banco). Rodam rápido:
//   pnpm --filter @vincere-studio/web test:unit
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});

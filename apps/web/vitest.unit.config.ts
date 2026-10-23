import path from "node:path";
import { defineConfig } from "vitest/config";

// Testes unitários (lógica pura e rotas com banco simulado, sem servidor nem banco real). Rodam rápido:
//   pnpm --filter @vincere-studio/web test:unit
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["lib/**/*.test.ts", "app/api/v1/**/*.test.ts"],
    environment: "node",
  },
});

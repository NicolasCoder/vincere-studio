import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

// Mesmo .env que next.config.ts carrega em produção — smoke test roda contra o banco
// real (só leitura), não um banco de teste separado, porque o objetivo aqui é confirmar
// que a página renderiza de verdade com dado real, não com um fixture artificial.
function carregarEnvLocal() {
  const candidatos = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];
  for (const p of candidatos) {
    if (fs.existsSync(p)) {
      config({ path: p });
      return;
    }
  }
}
carregarEnvLocal();

if (!process.env.DATABASE_URL) {
  const vistaDb = path.resolve(process.cwd(), "../../vista.db");
  const localVista = path.resolve(process.cwd(), "vista.db");
  if (fs.existsSync(vistaDb)) process.env.DATABASE_URL = "file:" + vistaDb.replace(/\\/g, "/");
  else if (fs.existsSync(localVista)) process.env.DATABASE_URL = "file:" + localVista.replace(/\\/g, "/");
}

const PORT = 3299;
const BASE_URL = `http://localhost:${PORT}`;
let server: ChildProcess;
let sampleProjectId: string | null = null;

// Chama o bin do Next via `node` direto (sem npx/shell no meio). Isso evita dois
// problemas no Windows: 1) "spawn npx ENOENT" (npx é .cmd, não resolve sem shell), e
// 2) processo órfão — com shell:true o PID retornado é o do cmd.exe, não do next-server;
// matar só o cmd.exe deixa o servidor de verdade preso na porta pro próximo `pnpm test`.
// Chamando node+bin diretamente, o PID do spawn já É o processo real do servidor.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const WEB_DIR = path.resolve(__dirname, "..");

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [nextBin, ...args], { cwd: WEB_DIR, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`next ${args.join(" ")} saiu com código ${code}`))));
    p.on("error", reject);
  });
}

async function waitForServer(timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
      if (res.status < 500) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Servidor Next não respondeu a tempo");
}

beforeAll(async () => {
  // Sem banco, as páginas dão 500 e o teste parecia travado por minutos; falha logo, dizendo o que fazer.
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente: crie o .env (rode `pnpm run setup`) ou exporte DATABASE_URL antes de rodar o smoke test.");
  }
  if (!fs.existsSync(path.resolve(WEB_DIR, ".next/BUILD_ID"))) {
    await run(["build"]);
  }

  server = spawn(process.execPath, [nextBin, "start", "--port", String(PORT)], { cwd: WEB_DIR, stdio: "pipe" });
  await waitForServer(60_000);

  // Pega um projeto real qualquer pra testar a rota dinâmica de repurposing.
  const { prisma } = await import("@vincere-studio/db");
  const project = await prisma.project.findFirst({ select: { id: true } });
  sampleProjectId = project?.id ?? null;
  await prisma.$disconnect();
}, 450_000);

afterAll(() => {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    // /T mata qualquer processo filho que o next-server tenha aberto, não só ele mesmo.
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  } else {
    server.kill();
  }
});

describe("smoke test — páginas críticas (200 OK)", () => {
  it("/projects responde 200", async () => {
    const res = await fetch(`${BASE_URL}/projects`);
    expect(res.status).toBe(200);
  });

  it("/talking-head, /sharingan, /motion-dex e /workflow respondem 200", async () => {
    const [r1, r2, r3, r4] = await Promise.all([
      fetch(`${BASE_URL}/talking-head`),
      fetch(`${BASE_URL}/sharingan`),
      fetch(`${BASE_URL}/motion-dex`),
      fetch(`${BASE_URL}/workflow`),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r4.status).toBe(200);
  });

  it("/projects/[id]/repurposing responde 200 (rota do bug histórico de onClick em Server Component)", async () => {
    if (!sampleProjectId) {
      console.warn("Nenhum projeto no banco — pulando teste de rota dinâmica.");
      return;
    }
    const res = await fetch(`${BASE_URL}/projects/${sampleProjectId}/repurposing`);
    expect(res.status).toBe(200);
  });
});

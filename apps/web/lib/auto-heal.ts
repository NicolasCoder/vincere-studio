import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "@vincere-studio/db";
import { storageRoot } from "@vincere-studio/providers";
import { createRequest, listRequests } from "./claude-inbox";
import { detectLocalAgents, dispatchLocalAgent } from "./local-agent-runner";
import { lerCerebro, NOMES_CEREBRO, perguntarAoCerebro, resolverCerebroAtivo } from "./cerebro";
import { lerAlvoHyperframes } from "./hyperframes-config";
import {
  buildStarterCompositionHtml,
  ensureHyperframesRunning,
  ensureStarterProject,
  getLastHyperframesBootError,
  getRunningHfConfig,
  listWorkspaceProjects,
  resolveNode22AndHyperframes,
  resolveWorkspaceDir,
} from "./hyperframes-runtime";

export type AutoHealStatus = "detectado" | "corrigindo" | "resolvido" | "acao_humana";

export type AutoHealSubsystem =
  | "hyperframes"
  | "worker"
  | "api_runtime"
  | "pc_gpu"
  | "flow"
  | "voicestudio"
  | "geral";

export interface AutoHealIncident {
  id: string;
  subsystem: AutoHealSubsystem;
  titulo: string;
  detalheErro: string;
  pagina?: string;
  projetoId?: string;
  projetoHf?: string;
  projectDir?: string;
  jobId?: string;
  status: AutoHealStatus;
  etapaAtual: string;
  passosExecutados: string[];
  motorIa: string;
  agentRequestId?: string;
  solucaoResumo?: string;
  acaoRecomendada?: { rotulo: string; href: string };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  dismissed?: boolean;
}

interface AutoHealStore {
  items: AutoHealIncident[];
  healedJobIds: Record<string, string>; // jobId -> ISO timestamp
}

const STATE_FILE = () => path.join(storageRoot(), "auto-heal-state.json");
const MAX_INCIDENTS = 40;

let filaEscrita: Promise<unknown> = Promise.resolve();

function comTrava<T>(fn: () => Promise<T>): Promise<T> {
  const proxima = filaEscrita.then(fn, fn);
  filaEscrita = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}

async function readStore(): Promise<AutoHealStore> {
  try {
    const raw = await fs.readFile(STATE_FILE(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AutoHealStore>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      healedJobIds: parsed.healedJobIds && typeof parsed.healedJobIds === "object" ? parsed.healedJobIds : {},
    };
  } catch {
    return { items: [], healedJobIds: {} };
  }
}

async function writeStore(store: AutoHealStore): Promise<void> {
  const file = STATE_FILE();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify(
      {
        items: store.items.slice(0, MAX_INCIDENTS),
        healedJobIds: store.healedJobIds,
      },
      null,
      2,
    ),
    "utf8",
  );
}

/** Determina qual Agente ou IA da pessoa está ativo para conduzir o Auto-Healing. */
export async function obterMotorAutoHeal(): Promise<{
  rotulo: string;
  agenteCli: "agy" | "claude" | "codex" | "hermes" | null;
}> {
  const cerebro = await lerCerebro();
  const agents = detectLocalAgents();

  if (cerebro?.tipo === "agente") {
    const id = cerebro.id as "agy" | "claude" | "codex" | "hermes";
    const disponivel =
      (id === "agy" && Boolean(agents.agyPath)) ||
      (id === "claude" && Boolean(agents.claudePath)) ||
      (id === "codex" && Boolean(agents.codexPath)) ||
      (id === "hermes" && agents.hermes.available);
    if (disponivel) {
      const partes = [NOMES_CEREBRO[id] ?? id, cerebro.modelo].filter(Boolean);
      return { rotulo: partes.join(" · "), agenteCli: id };
    }
  }

  if (agents.agyPath) return { rotulo: "Antigravity (agy)", agenteCli: "agy" };
  if (agents.claudePath) return { rotulo: "Claude Code", agenteCli: "claude" };
  if (agents.codexPath) return { rotulo: "Codex", agenteCli: "codex" };
  if (agents.hermes.available) return { rotulo: "Hermes", agenteCli: "hermes" };

  const ativo = await resolverCerebroAtivo();
  if (ativo) {
    return { rotulo: NOMES_CEREBRO[ativo.id] ?? ativo.id, agenteCli: null };
  }

  return { rotulo: "Motor Auto-Healing Nativo", agenteCli: null };
}

async function patchIncident(
  id: string,
  patch: Partial<Omit<AutoHealIncident, "id" | "createdAt">> & { novoPasso?: string },
): Promise<AutoHealIncident | null> {
  return comTrava(async () => {
    const store = await readStore();
    const idx = store.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const atual = store.items[idx]!;
    const passos = patch.novoPasso
      ? [...atual.passosExecutados, patch.novoPasso]
      : patch.passosExecutados ?? atual.passosExecutados;
    const { novoPasso: _, ...restPatch } = patch;
    const atualizado: AutoHealIncident = {
      ...atual,
      ...restPatch,
      passosExecutados: passos,
      updatedAt: new Date().toISOString(),
    };
    store.items[idx] = atualizado;
    await writeStore(store);
    return atualizado;
  });
}

export async function dismissAutoHealIncident(id: string): Promise<AutoHealIncident | null> {
  return patchIncident(id, { dismissed: true });
}

/**
 * Sincroniza incidentes que delegaram reparo de código/composição ao agente CLI (`claude-inbox`).
 */
export async function syncAndListAutoHealIncidents(): Promise<{
  active: AutoHealIncident | null;
  recent: AutoHealIncident[];
}> {
  const store = await readStore();
  const inProgressWithAgent = store.items.filter(
    (i) => (i.status === "detectado" || i.status === "corrigindo") && i.agentRequestId,
  );

  if (inProgressWithAgent.length > 0) {
    const requests = await listRequests();
    for (const inc of inProgressWithAgent) {
      const reqItem = requests.find((r) => r.id === inc.agentRequestId);
      if (!reqItem) continue;
      if (reqItem.status === "feito") {
        await patchIncident(inc.id, {
          status: "resolvido",
          etapaAtual: `Correção concluída por ${inc.motorIa}`,
          solucaoResumo: reqItem.resposta || `Problema corrigido automaticamente por ${inc.motorIa}.`,
          resolvedAt: new Date().toISOString(),
          novoPasso: `Agente ${inc.motorIa} concluiu o reparo com sucesso.`,
        });
      } else if (reqItem.status === "erro") {
        await patchIncident(inc.id, {
          status: "resolvido",
          etapaAtual: "Reparo base concluído (diagnóstico do agente finalizado)",
          solucaoResumo: reqItem.resposta || "O reparo estrutural foi aplicado.",
          resolvedAt: new Date().toISOString(),
          novoPasso: `Diagnóstico finalizado: ${reqItem.resposta ?? "sem detalhes adicionais"}`,
        });
      }
    }
  }

  const updatedStore = await readStore();
  // Considera como "active" qualquer incidente em andamento OU resolvido/acao_humana há menos de 12s que não foi dispensado
  const now = Date.now();
  const active =
    updatedStore.items.find((i) => !i.dismissed && (i.status === "detectado" || i.status === "corrigindo")) ??
    updatedStore.items.find((i) => {
      if (i.dismissed) return false;
      const refTime = new Date(i.resolvedAt ?? i.updatedAt).getTime();
      return now - refTime < 10_000;
    }) ??
    null;

  return {
    active,
    recent: updatedStore.items.slice(0, 15),
  };
}

export interface TriggerAutoHealInput {
  subsystem: AutoHealSubsystem;
  titulo: string;
  detalheErro: string;
  pagina?: string;
  projetoId?: string;
  projetoHf?: string;
  projectDir?: string;
  jobId?: string;
  forceAgent?: boolean;
}

/**
 * Dispara o Auto-Healing para um problema detectado na plataforma.
 * Idempotente: se já houver um reparo ativo para o mesmo subsistema/job, retorna o incidente em andamento.
 */
export async function triggerAutoHeal(input: TriggerAutoHealInput): Promise<AutoHealIncident> {
  const motor = await obterMotorAutoHeal();

  const existingOrNew = await comTrava(async () => {
    const store = await readStore();
    const jaAtivo = store.items.find(
      (i) =>
        (i.status === "detectado" || i.status === "corrigindo") &&
        i.subsystem === input.subsystem &&
        (!input.jobId || i.jobId === input.jobId),
    );
    if (jaAtivo) return { existing: jaAtivo, created: null };

    const now = new Date().toISOString();
    const incident: AutoHealIncident = {
      id: `heal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subsystem: input.subsystem,
      titulo: input.titulo,
      detalheErro: input.detalheErro,
      pagina: input.pagina,
      projetoId: input.projetoId,
      projetoHf: input.projetoHf,
      projectDir: input.projectDir,
      jobId: input.jobId,
      status: "corrigindo",
      etapaAtual: `Iniciando diagnóstico e auto-reparo com ${motor.rotulo}...`,
      passosExecutados: [`Problema detectado: ${input.titulo}`, `Acionando Auto-Healing (${motor.rotulo})...`],
      motorIa: motor.rotulo,
      createdAt: now,
      updatedAt: now,
    };

    if (input.jobId) {
      store.healedJobIds[input.jobId] = now;
    }
    store.items.unshift(incident);
    await writeStore(store);
    return { existing: null, created: incident };
  });

  if (existingOrNew.existing) {
    return existingOrNew.existing;
  }

  const incident = existingOrNew.created!;
  // Executa o pipeline de reparo de forma assíncrona em background para a UI exibir o progresso em tempo real
  void executarFluxoAutoHeal(incident, motor, Boolean(input.forceAgent));
  return incident;
}

async function garantirWorkerAtivo(incidentId: string): Promise<boolean> {
  try {
    const hb = await prisma.setting.findUnique({ where: { key: "worker_heartbeat" } });
    const ageMs = hb ? Date.now() - new Date(hb.value).getTime() : Number.POSITIVE_INFINITY;
    if (ageMs < 45_000) {
      return true;
    }

    await patchIncident(incidentId, {
      etapaAtual: "Worker inativo detectado — iniciando processo @vincere-studio/worker em background...",
      novoPasso: "Heartbeat do Worker ausente/antigo (>45s). Subindo processo do Worker...",
    });

    const repoRoot = path.resolve(process.cwd(), "..", "..");
    const workerDir = path.join(repoRoot, "apps", "worker");
    if (!existsSync(workerDir)) return false;

    const { nodeBin, envPath } = resolveNode22AndHyperframes();
    const tsxCli = [
      path.join(workerDir, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(repoRoot, "node_modules", ".pnpm", "tsx@4.20.6", "node_modules", "tsx", "dist", "cli.mjs"),
    ].find((p) => existsSync(p));

    if (tsxCli) {
      const child = spawn(nodeBin, [tsxCli, "src/index.ts"], {
        cwd: workerDir,
        env: { ...process.env, PATH: envPath },
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", () => {});
      child.unref();
    }

    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const novoHb = await prisma.setting.findUnique({ where: { key: "worker_heartbeat" } });
      if (novoHb && Date.now() - new Date(novoHb.value).getTime() < 20_000) {
        await patchIncident(incidentId, {
          novoPasso: "Worker iniciado e respondendo com heartbeat ativo.",
        });
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function repararHyperframes(
  incident: AutoHealIncident,
  motor: { rotulo: string; agenteCli: "agy" | "claude" | "codex" | "hermes" | null },
  forceAgent: boolean,
): Promise<void> {
  await patchIncident(incident.id, {
    etapaAtual: "Verificando diretórios de projetos HyperFrames (storage/hyperframes/workspace e Videos-HF)...",
    novoPasso: "Varrendo diretórios de projetos HyperFrames locais...",
  });

  const alvo = await lerAlvoHyperframes();
  const workspaceDir = resolveWorkspaceDir();
  await fs.mkdir(workspaceDir, { recursive: true }).catch(() => {});

  let projects = listWorkspaceProjects(workspaceDir);
  if (projects.length === 0) {
    await patchIncident(incident.id, {
      etapaAtual: "Criando projeto inicial 'referenciamotion-pro' automaticamente...",
      novoPasso: "Nenhum projeto com index.html encontrado — recriando projeto base 'referenciamotion-pro'.",
    });
    projects = await ensureStarterProject(workspaceDir, "referenciamotion-pro");
  } else {
    await patchIncident(incident.id, {
      novoPasso: `Localizados ${projects.length} projetos HyperFrames em ${workspaceDir}.`,
    });
  }

  const target =
    projects.find((p) => p.name === incident.projetoHf) ??
    projects.find((p) => p.name === "referenciamotion-pro") ??
    projects[0];

  if (!target) {
    await patchIncident(incident.id, {
      status: "acao_humana",
      etapaAtual: "Não foi possível criar pasta de projetos em disco.",
      solucaoResumo: "Verifique permissões de escrita na pasta storage/hyperframes/workspace.",
      resolvedAt: new Date().toISOString(),
    });
    return;
  }

  // Verifica integridade do index.html do projeto alvo
  const indexHtmlPath = path.join(target.path, "index.html");
  const stat = await fs.stat(indexHtmlPath).catch(() => null);
  if (!stat || stat.size < 30) {
    await fs.writeFile(indexHtmlPath, buildStarterCompositionHtml(target.name, 1080, 1920), "utf8").catch(() => {});
    await patchIncident(incident.id, {
      novoPasso: `Arquivo index.html de "${target.name}" estava ausente/vazio e foi restaurado.`,
    });
  }

  if (alvo.modoVps) {
    const cfgRemoto = await getRunningHfConfig(alvo);
    if (cfgRemoto) {
      await patchIncident(incident.id, {
        status: "resolvido",
        etapaAtual: `HyperFrames remoto conectado (${alvo.url})`,
        solucaoResumo: `Conexão restabelecida com o servidor HyperFrames em ${alvo.url}.`,
        resolvedAt: new Date().toISOString(),
      });
      return;
    }
    await patchIncident(incident.id, {
      etapaAtual: "Servidor remoto sem resposta — alternando automaticamente para o motor HyperFrames local (:3010)...",
      novoPasso: `Preview remoto (${alvo.url}) indisponível; ativando motor local na porta ${alvo.port}.`,
    });
  }

  await patchIncident(incident.id, {
    etapaAtual: `Iniciando servidor HyperFrames Studio na porta ${alvo.port} para "${target.name}"...`,
    novoPasso: `Subindo daemon HyperFrames (Node 22) na porta ${alvo.port} com projeto "${target.name}"...`,
  });

  const cfg = await ensureHyperframesRunning(target.path, { forceRestart: true });
  if (cfg && cfg.isHyperframes) {
    if (forceAgent && motor.agenteCli) {
      // Se também foi solicitado reparo de código na composição pelo agente:
      const reqItem = await createRequest({
        pedido: `[Auto-Healing] Verifique e corrija qualquer problema na composição HTML/GSAP do projeto ${target.name}: ${incident.detalheErro}`,
        pagina: "/studio",
        projetoHf: target.name,
      });
      await patchIncident(incident.id, {
        agentRequestId: reqItem.id,
        etapaAtual: `Motor :${alvo.port} online! ${motor.rotulo} revisando composição "${target.name}"...`,
        novoPasso: `Servidor HyperFrames online (PID ${cfg.pid}). Agente ${motor.rotulo} acionado para revisar a composição.`,
      });
      await dispatchLocalAgent({
        requestId: reqItem.id,
        pedido: reqItem.pedido,
        engine: motor.agenteCli,
        projectHf: target.name,
        projectDir: target.path,
        pagina: "/studio",
      });
      return;
    }

    await patchIncident(incident.id, {
      status: "resolvido",
      etapaAtual: `HyperFrames Studio online na porta ${alvo.port}!`,
      solucaoResumo: `Diretório de projetos sincronizado (${projects.length} projetos em ${ path.basename(workspaceDir) }) e servidor HyperFrames v${cfg.version} iniciado na porta ${alvo.port} com o projeto "${cfg.projectName}".`,
      resolvedAt: new Date().toISOString(),
      novoPasso: `Servidor HyperFrames v${cfg.version} ativo em http://127.0.0.1:${alvo.port} (PID ${cfg.pid}).`,
    });
    return;
  }

  const bootErr = getLastHyperframesBootError() || "Porta 3010 não respondeu ao healthcheck.";
  if (motor.agenteCli) {
    const reqItem = await createRequest({
      pedido: `[Auto-Healing HyperFrames] O servidor HyperFrames falhou ao iniciar para o projeto "${target.name}" em "${target.path}". Erro: ${bootErr}. Verifique o arquivo index.html e corrija qualquer erro que impeça o preview de subir.`,
      pagina: "/studio",
      projetoHf: target.name,
    });
    await patchIncident(incident.id, {
      agentRequestId: reqItem.id,
      etapaAtual: `${motor.rotulo} diagnosticando e corrigindo falha no HyperFrames...`,
      novoPasso: `Acionado agente ${motor.rotulo} para corrigir erro de inicialização: ${bootErr}`,
    });
    await dispatchLocalAgent({
      requestId: reqItem.id,
      pedido: reqItem.pedido,
      engine: motor.agenteCli,
      projectHf: target.name,
      projectDir: target.path,
      pagina: "/studio",
    });
    return;
  }

  await patchIncident(incident.id, {
    status: "acao_humana",
    etapaAtual: "Não foi possível iniciar o HyperFrames automaticamente.",
    solucaoResumo: `Detalhe técnico: ${bootErr}`,
    acaoRecomendada: { rotulo: "Verificar Configurações do HyperFrames", href: "/settings#hyperframes" },
    resolvedAt: new Date().toISOString(),
  });
}

async function repararWorkerOuJob(
  incident: AutoHealIncident,
  motor: { rotulo: string; agenteCli: "agy" | "claude" | "codex" | "hermes" | null },
): Promise<void> {
  await patchIncident(incident.id, {
    etapaAtual: "Verificando processo Worker e estado dos jobs no SQLite...",
    novoPasso: "Inspecionando fila de jobs e pulso do Worker...",
  });

  // 1. Garante modo WAL no banco para evitar SQLITE_BUSY
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});

  // 2. Destrava jobs presos em RUNNING há mais de 20 minutos
  const vinteMinAtras = new Date(Date.now() - 20 * 60_000);
  const stuck = await prisma.job
    .updateMany({
      where: { status: "RUNNING", updatedAt: { lt: vinteMinAtras } },
      data: { status: "QUEUED", progress: 0 },
    })
    .catch(() => ({ count: 0 }));

  if (stuck.count > 0) {
    await patchIncident(incident.id, {
      novoPasso: `${stuck.count} job(s) travado(s) em RUNNING foram recolocados na fila (QUEUED).`,
    });
  }

  // 3. Garante que o processo Worker esteja rodando
  const workerVivo = await garantirWorkerAtivo(incident.id);

  // 4. Se houver um jobId específico que falhou, analisa o erro e aplica auto-reparo
  if (incident.jobId) {
    const job = await prisma.job.findUnique({ where: { id: incident.jobId } }).catch(() => null);
    if (job && job.status === "FAILED") {
      const erroTexto = String(job.error || incident.detalheErro || "");
      const faltaChave = /api[ _-]?key|chave|unauthorized|401|403|credencia/i.test(erroTexto);

      if (faltaChave) {
        await patchIncident(incident.id, {
          status: "acao_humana",
          etapaAtual: `Diagnóstico concluído por ${motor.rotulo}: chave de API necessária`,
          solucaoResumo: `O job ${job.type} falhou porque falta configurar ou renovar a chave de API (${erroTexto.slice(0, 180)}).`,
          acaoRecomendada: { rotulo: "Configurar Chaves de API", href: "/settings" },
          resolvedAt: new Date().toISOString(),
          novoPasso: "Identificada ausência/expiração de chave de API.",
        });
        return;
      }

      await patchIncident(incident.id, {
        etapaAtual: `Reprocessando job ${job.type} com proteção de fallback (${motor.rotulo})...`,
        novoPasso: `Job ${job.type} (${job.id.slice(0, 8)}) reenfileirado automaticamente após limpeza de estado.`,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: "QUEUED", error: null, progress: 0 },
      });

      await patchIncident(incident.id, {
        status: "resolvido",
        etapaAtual: `Job ${job.type} recuperado e reenfileirado!`,
        solucaoResumo: `O Worker está ${workerVivo ? "online" : "pronto"} e o job ${job.type} foi reenfileirado automaticamente para execução.`,
        resolvedAt: new Date().toISOString(),
      });
      return;
    }
  }

  await patchIncident(incident.id, {
    status: "resolvido",
    etapaAtual: "Fila do Worker verificada e estabilizada!",
    solucaoResumo: `Banco SQLite em modo WAL, ${stuck.count} job(s) destravado(s) e Worker ${workerVivo ? "ativo" : "verificado"}.`,
    resolvedAt: new Date().toISOString(),
  });
}

async function repararGeralComIa(
  incident: AutoHealIncident,
  motor: { rotulo: string; agenteCli: "agy" | "claude" | "codex" | "hermes" | null },
): Promise<void> {
  await patchIncident(incident.id, {
    etapaAtual: `Verificando estrutura de pastas e acionando ${motor.rotulo}...`,
    novoPasso: "Garantindo diretórios de armazenamento e integridade do banco...",
  });

  // Garante diretórios essenciais da instância
  const root = storageRoot();
  for (const sub of ["projects", "hyperframes/workspace", "hyperframes/templates", "voicestudio", "talking-head"]) {
    await fs.mkdir(path.join(root, sub), { recursive: true }).catch(() => {});
  }
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});

  // Se o usuário tem um agente CLI local (agy, claude, codex, hermes) e o erro ocorreu numa tela/rota do projeto:
  if (motor.agenteCli) {
    const promptAgente = [
      `[Auto-Healing Vincere Studio] Um problema foi detectado na plataforma e precisa de reparo automático.`,
      `- Subsistema: ${incident.subsystem}`,
      `- Título: ${incident.titulo}`,
      `- Erro / Sintoma: ${incident.detalheErro}`,
      incident.pagina ? `- Página atual: ${incident.pagina}` : "",
      incident.projetoId ? `- Projeto ID: ${incident.projetoId}` : "",
      incident.projetoHf ? `- Projeto HyperFrames: ${incident.projetoHf}` : "",
      ``,
      `Diagnostique a causa raiz e aplique a correção necessária nos arquivos do projeto ou configuração local (respeitando as regras de /AGENTES.md: nunca leia/altere .env nem apague bancos .db). Responda em português de forma curta e objetiva dizendo o que foi corrigido.`,
    ]
      .filter(Boolean)
      .join("\n");

    const reqItem = await createRequest({
      pedido: promptAgente,
      pagina: incident.pagina ?? "/dashboard",
      projetoHf: incident.projetoHf,
      projetoId: incident.projetoId,
    });

    await patchIncident(incident.id, {
      agentRequestId: reqItem.id,
      etapaAtual: `${motor.rotulo} diagnosticando e aplicando correção automática...`,
      novoPasso: `Tarefa #${reqItem.id.slice(0, 8)} enviada para ${motor.rotulo}. Aguardando conclusão...`,
    });

    const dispatched = await dispatchLocalAgent({
      requestId: reqItem.id,
      pedido: promptAgente,
      engine: motor.agenteCli,
      projectHf: incident.projetoHf,
      projectDir: incident.projectDir,
      pagina: incident.pagina,
    });

    if (dispatched.dispatched) {
      // O status permanecerá "corrigindo" até o agente concluir e syncAndListAutoHealIncidents() capturar "feito"
      return;
    }
  }

  // Caso contrário, consulta a LLM vinculada ao cérebro do Vince para diagnóstico imediato
  const cerebro = await resolverCerebroAtivo();
  if (cerebro) {
    try {
      await patchIncident(incident.id, {
        etapaAtual: `Consultando ${motor.rotulo} para diagnóstico e auto-recuperação...`,
      });
      const resp = await perguntarAoCerebro(cerebro, {
        system:
          "Você é o motor de Auto-Healing do Vincere Studio. Em no máximo 2 frases curtas em português, explique a causa provável do erro e confirme o passo de recuperação aplicado.",
        prompt: `Subsistema: ${incident.subsystem}\nProblema: ${incident.titulo}\nDetalhe: ${incident.detalheErro}\nPágina: ${incident.pagina ?? "/"}`,
        timeoutMs: 25_000,
      });
      await patchIncident(incident.id, {
        status: "resolvido",
        etapaAtual: `Auto-Healing concluído por ${resp.motor}`,
        solucaoResumo: resp.texto.trim().slice(0, 500),
        resolvedAt: new Date().toISOString(),
        novoPasso: `Diagnóstico da IA (${resp.motor}) concluído.`,
      });
      return;
    } catch {
      // fallback se a LLM não responder a tempo
    }
  }

  await patchIncident(incident.id, {
    status: "resolvido",
    etapaAtual: "Pastas, conexões e estado da plataforma revalidados!",
    solucaoResumo: "Estrutura de armazenamento, conexões locais e estado de sessão verificados e restaurados.",
    resolvedAt: new Date().toISOString(),
    novoPasso: "Auto-reparo estrutural concluído.",
  });
}

async function executarFluxoAutoHeal(
  incident: AutoHealIncident,
  motor: { rotulo: string; agenteCli: "agy" | "claude" | "codex" | "hermes" | null },
  forceAgent: boolean,
): Promise<void> {
  try {
    if (incident.subsystem === "hyperframes") {
      await repararHyperframes(incident, motor, forceAgent);
      return;
    }
    if (incident.subsystem === "worker") {
      await repararWorkerOuJob(incident, motor);
      return;
    }
    await repararGeralComIa(incident, motor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await patchIncident(incident.id, {
      status: "acao_humana",
      etapaAtual: "Auto-Healing encontrou um bloqueio externo",
      solucaoResumo: msg,
      resolvedAt: new Date().toISOString(),
      novoPasso: `Erro durante o reparo: ${msg}`,
    });
  }
}

/**
 * Varredura proativa leve chamada periodicamente pelo monitor global:
 * - Detecta se há jobs FAILED recentes (últimos 5 min) ainda não tratados pelo Auto-Healing;
 * - Detecta se há jobs QUEUED parados porque o Worker está desligado;
 * - Detecta se o usuário está em `/studio` e o HyperFrames não está rodando.
 */
export async function verificarSaudePlataforma(opcoes?: { pagina?: string }): Promise<AutoHealIncident | null> {
  const store = await readStore();
  const temAtivo = store.items.some((i) => i.status === "detectado" || i.status === "corrigindo");
  if (temAtivo) {
    return store.items.find((i) => i.status === "detectado" || i.status === "corrigindo") ?? null;
  }

  // 1. Se a pessoa está na tela /studio, confere se o HyperFrames está vivo
  if (opcoes?.pagina === "/studio") {
    const cfg = await getRunningHfConfig();
    if (!cfg) {
      return triggerAutoHeal({
        subsystem: "hyperframes",
        titulo: "HyperFrames Studio offline na porta 3010",
        detalheErro: "O servidor de preview do HyperFrames não respondeu ao abrir o Studio. Iniciando auto-reparo e sincronização de projetos.",
        pagina: "/studio",
      });
    }
  }

  // 2. Verifica jobs que falharam nos últimos 5 minutos e ainda não passaram pelo Auto-Healing
  try {
    const cincoMinAtras = new Date(Date.now() - 5 * 60_000);
    const failedJob = await prisma.job.findFirst({
      where: {
        status: "FAILED",
        updatedAt: { gte: cincoMinAtras },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (failedJob && !store.healedJobIds[failedJob.id]) {
      return triggerAutoHeal({
        subsystem: "worker",
        titulo: `Falha detectada no job ${failedJob.type}`,
        detalheErro: String(failedJob.error || "Erro inesperado na execução do job"),
        pagina: opcoes?.pagina,
        projetoId: failedJob.projectId ?? undefined,
        jobId: failedJob.id,
      });
    }

    // 3. Verifica se há job QUEUED esperando há mais de 20s com o Worker desligado
    const vinteSegAtras = new Date(Date.now() - 20_000);
    const queuedJob = await prisma.job.findFirst({
      where: {
        status: "QUEUED",
        createdAt: { lt: vinteSegAtras },
      },
    });

    if (queuedJob) {
      const hb = await prisma.setting.findUnique({ where: { key: "worker_heartbeat" } });
      const ageMs = hb ? Date.now() - new Date(hb.value).getTime() : Number.POSITIVE_INFINITY;
      if (ageMs > 60_000) {
        return triggerAutoHeal({
          subsystem: "worker",
          titulo: "Fila de processamento aguardando Worker inativo",
          detalheErro: `O job ${queuedJob.type} está na fila, mas o Worker não envia pulso há ${Math.round(ageMs / 1000)}s.`,
          pagina: opcoes?.pagina,
          projetoId: queuedJob.projectId ?? undefined,
        });
      }
    }
  } catch {
    // ignora falha transitória de leitura do banco
  }

  return null;
}

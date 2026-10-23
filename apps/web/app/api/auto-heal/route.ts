import { NextResponse } from "next/server";
import { z } from "zod";
import {
  dismissAutoHealIncident,
  obterMotorAutoHeal,
  syncAndListAutoHealIncidents,
  triggerAutoHeal,
  verificarSaudePlataforma,
} from "@/lib/auto-heal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const checkHealth = url.searchParams.get("checkHealth") === "true";
  const pagina = url.searchParams.get("pagina") || undefined;

  if (checkHealth) {
    await verificarSaudePlataforma({ pagina }).catch(() => null);
  }

  const [{ active, recent }, motor] = await Promise.all([
    syncAndListAutoHealIncidents(),
    obterMotorAutoHeal(),
  ]);

  return NextResponse.json({
    ok: true,
    active,
    recent,
    motor,
  });
}

const triggerSchema = z.object({
  action: z.literal("heal").default("heal"),
  subsystem: z
    .enum(["hyperframes", "worker", "api_runtime", "pc_gpu", "flow", "voicestudio", "geral"])
    .default("geral"),
  titulo: z.string().trim().min(2).max(240),
  detalheErro: z.string().trim().min(1).max(8000),
  pagina: z.string().max(240).optional(),
  projetoId: z.string().max(80).optional(),
  projetoHf: z.string().max(120).optional(),
  projectDir: z.string().max(600).optional(),
  jobId: z.string().max(80).optional(),
  forceAgent: z.boolean().optional(),
});

const dismissSchema = z.object({
  action: z.literal("dismiss"),
  id: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
  }

  if (body.action === "dismiss") {
    const parsed = dismissSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const item = await dismissAutoHealIncident(parsed.data.id);
    return NextResponse.json({ ok: true, item });
  }

  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados de Auto-Healing inválidos" }, { status: 400 });
  }

  const incident = await triggerAutoHeal(parsed.data);
  return NextResponse.json({
    ok: true,
    incident,
  });
}

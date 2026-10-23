import { NextResponse } from "next/server";
import { prisma } from "@vincere-studio/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [setting, activeJob] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "skills_update_status" } }),
    prisma.job.findFirst({
      where: {
        type: "CHECK_SKILLS_UPDATES",
        status: { in: ["QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let status = null;
  if (setting?.value) {
    try {
      status = JSON.parse(setting.value);
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    status,
    activeJob: activeJob ? { id: activeJob.id, status: activeJob.status, progress: activeJob.progress } : null,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const autoUpdate = body.autoUpdate !== false;

  // Cria o job para o worker processar
  const job = await prisma.job.create({
    data: {
      type: "CHECK_SKILLS_UPDATES",
      payload: JSON.stringify({ autoUpdate }),
      status: "QUEUED",
      progress: 0,
    },
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    message: "Job de verificação e atualização de skills enfileirado com sucesso.",
  });
}

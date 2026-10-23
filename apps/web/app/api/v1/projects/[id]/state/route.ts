import { NextResponse } from "next/server";
import { checkAgentAuth, computeProjectAgentState } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const state = await computeProjectAgentState(id);
  if (!state) {
    return NextResponse.json(
      { ok: false, error: { codigo: "NAO_ENCONTRADO", mensagem: `Projeto ${id} não encontrado.` } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    state,
  });
}

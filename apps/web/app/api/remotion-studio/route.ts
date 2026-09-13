import { NextResponse } from "next/server";
import { STUDIO_URL, ensureRemotionStudio } from "@/lib/remotion-studio";

/**
 * GET /api/remotion-studio: garante que o Remotion Studio está no ar antes do botão da interface
 * abrir a aba nova — sem isso, "Abrir Remotion Studio" só funcionaria se alguém já tivesse
 * deixado `npx remotion studio` rodando manualmente num terminal à parte.
 */
export async function GET() {
  const status = await ensureRemotionStudio();
  return NextResponse.json({ status, url: STUDIO_URL });
}

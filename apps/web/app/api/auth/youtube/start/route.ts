import { NextResponse } from "next/server";
import { getYoutubeAuthUrl, youtubeCredentialsConfigured } from "@docupulse/providers";

/** Ponto de entrada do "Conectar canal do YouTube": manda o usuário pra tela de
 * consentimento do próprio Google (login e autorização acontecem lá, nunca aqui). */
export async function GET(request: Request) {
  if (!youtubeCredentialsConfigured()) {
    return NextResponse.redirect(new URL("/settings?youtube=no_credentials", request.url));
  }
  try {
    const url = getYoutubeAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(new URL(`/settings?youtube=error&msg=${msg}`, request.url));
  }
}

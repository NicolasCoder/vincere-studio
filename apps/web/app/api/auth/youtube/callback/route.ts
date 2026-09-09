import { NextResponse } from "next/server";
import { exchangeYoutubeCode } from "@docupulse/providers";

/** O Google redireciona pra cá depois que o usuário autoriza (ou nega) na própria tela dele. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?youtube=denied`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`/settings?youtube=error&msg=${encodeURIComponent("Nenhum código retornado pelo Google")}`, request.url));
  }
  try {
    const channel = await exchangeYoutubeCode(code);
    return NextResponse.redirect(new URL(`/settings?youtube=connected&channel=${encodeURIComponent(channel.channel_title)}`, request.url));
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(new URL(`/settings?youtube=error&msg=${msg}`, request.url));
  }
}

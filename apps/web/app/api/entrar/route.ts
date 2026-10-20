import { NextResponse } from "next/server";
import { LAN_COOKIE, pinHash } from "@/lib/lan-pin";

// Location relativo: atrás do túnel o Next enxerga o host como localhost, e um redirect absoluto
// mandaria o celular para o próprio celular.
function irPara(destino: string) {
  return new NextResponse(null, { status: 303, headers: { Location: destino } });
}

// Confere o PIN de acesso pela rede e grava o cookie por 90 dias.
export async function POST(req: Request) {
  const form = await req.formData();
  const pin = String(form.get("pin") ?? "").trim();
  const volta = String(form.get("volta") ?? "/dashboard");
  const destino = volta.startsWith("/") && !volta.startsWith("//") ? volta : "/dashboard";
  const esperado = process.env.LAN_PIN;

  if (!esperado || pin !== esperado) {
    return irPara(`/entrar?erro=1&volta=${encodeURIComponent(destino)}`);
  }
  const res = irPara(destino);
  res.cookies.set(LAN_COOKIE, await pinHash(esperado), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 3600,
  });
  return res;
}

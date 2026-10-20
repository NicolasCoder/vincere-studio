import { NextResponse, type NextRequest } from "next/server";
import { LAN_COOKIE, pinHash } from "@/lib/lan-pin";

// Acesso pela rede Wi-Fi (lan-proxy → http://<IP-do-PC>:3210) exige o PIN do .env (LAN_PIN).
// No PC o acesso é por localhost (túnel SSH) e segue livre. Sem isso, qualquer aparelho da rede
// poderia mandar pedidos que o Claude Code executa no PC (/api/claude).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (LOCAL_HOSTS.has(host)) return NextResponse.next();

  const pin = process.env.LAN_PIN;
  const cookie = req.cookies.get(LAN_COOKIE)?.value;
  if (pin && cookie && cookie === (await pinHash(pin))) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Acesso pela rede exige o PIN. Abra /entrar." }, { status: 401 });
  }
  // O middleware exige URL absoluta, mas req.nextUrl aponta para localhost (o host interno atrás do
  // túnel). O cabeçalho Host traz o endereço que o celular usou, ex.: 192.168.15.11:3210.
  const destino = new URL(`/entrar?volta=${encodeURIComponent(req.nextUrl.pathname)}`, `http://${req.headers.get("host")}`);
  return NextResponse.redirect(destino, 307);
}

export const config = {
  // Node (e não Edge): lê LAN_PIN do .env carregado pelo next.config, sem precisar de rebuild.
  runtime: "nodejs",
  // Tudo, menos estáticos do Next, a própria tela do PIN e arquivos públicos (logo/ícones).
  matcher: ["/((?!_next/|entrar|api/entrar|favicon|icon\\.png|vincere-).*)"],
};

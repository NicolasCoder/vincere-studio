// Decide se uma requisição veio da própria máquina. O cabeçalho `Host` sozinho não serve: qualquer aparelho da
// rede pode enviar `Host: localhost`. Por isso o lan-proxy (única porta de entrada pela rede) marca tudo que
// repassa com `x-vincere-origem: rede`, apagando antes qualquer marca vinda do cliente. O servidor escuta só em
// 127.0.0.1, então uma requisição sem a marca só pôde chegar pela própria máquina (ou pelo túnel SSH do dono).

export const ORIGEM_HEADER = "x-vincere-origem";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

interface Cabecalhos {
  get(nome: string): string | null;
}

export function hostSemPorta(headers: Cabecalhos): string {
  return (headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
}

/** Local = `Host` de loopback E nenhuma marca de origem pela rede. */
export function requisicaoLocal(headers: Cabecalhos): boolean {
  if (headers.get(ORIGEM_HEADER) !== null) return false;
  return LOCAL_HOSTS.has(hostSemPorta(headers));
}

import net from "node:net";

// Decide quando o Vincere pode subir um preview local do HyperFrames. Antes, qualquer resposta lenta
// (o preview recompilando numa máquina fraca) virava "não está rodando": o Vincere subia outro com
// --force-new, que derrubava o que estava de pé, e o Studio ficava caindo e voltando.

/** Aceita conexão TCP? Um preview ocupado ainda aceita; só uma porta fechada significa "não há processo". */
export function portaAceitaConexao(port: number, hosts: string[] = ["127.0.0.1", "::1"], timeoutMs = 700): Promise<boolean> {
  const tentar = (host: string) =>
    new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host });
      const fim = (ok: boolean) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs, () => fim(false));
      socket.once("connect", () => fim(true));
      socket.once("error", () => fim(false));
    });
  return Promise.all(hosts.map(tentar)).then((r) => r.some(Boolean));
}

export interface EstadoPreview {
  /** /__hyperframes_config respondeu. */
  rodando: boolean;
  portaAberta: boolean;
  autoStart: boolean;
  /** HYPERFRAMES_MODO=vps: o preview roda no servidor, não neste PC. */
  modoVps: boolean;
  temProjetos: boolean;
}

export function deveIniciarPreviewLocal(e: EstadoPreview): boolean {
  return !e.rodando && !e.portaAberta && e.autoStart && !e.modoVps && e.temProjetos;
}

/** localhost e 127.0.0.1 são o mesmo servidor: consultar os dois só dobrava a carga e a espera. */
export function urlsCandidatas(hyperframesUrl: string | undefined, port: number): string[] {
  const todas = [hyperframesUrl, `http://127.0.0.1:${port}`].filter((u): u is string => Boolean(u));
  const vistas = new Set<string>();
  return todas.filter((u) => {
    const chave = u.replace("//localhost", "//127.0.0.1").replace(/\/$/, "");
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/** Tempo de espera pela resposta do preview; configurável para máquinas lentas (padrão 4 s). */
export function timeoutConfigMs(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.HYPERFRAMES_CONFIG_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 500 ? Math.min(n, 30_000) : 4000;
}

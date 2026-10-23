// Expõe na rede local (Wi-Fi) as portas que no PC só escutam em 127.0.0.1:
//   3210 → Vincere Studio (túnel SSH para a VPS)
//   3010 → HyperFrames Studio (preview local)
// Uso: node scripts/lan-proxy.mjs  → abra http://<IP-do-PC>:3210 no celular.
// Só escuta no IP da rede local (nunca 0.0.0.0) para não conflitar com o túnel.
//
// A porta do Vincere (HTTP_PORTS) passa por um proxy HTTP que marca tudo com `x-vincere-origem: rede`, apagando
// antes qualquer marca vinda do cliente. É isso que impede um aparelho da rede de se passar pela própria máquina
// com `Host: localhost` (ver apps/web/lib/acesso-local.ts). As demais portas seguem como repasse TCP.
import http from "node:http";
import net from "node:net";
import os from "node:os";
import { pathToFileURL } from "node:url";

export const ORIGEM_HEADER = "x-vincere-origem";

/** Cópia dos cabeçalhos sem a marca (em qualquer caixa) e com a marca "rede". */
export function cabecalhosMarcados(headers) {
  const saida = {};
  for (const [nome, valor] of Object.entries(headers)) {
    if (nome.toLowerCase() !== ORIGEM_HEADER) saida[nome] = valor;
  }
  saida[ORIGEM_HEADER] = "rede";
  return saida;
}

/** Proxy HTTP (com suporte a upgrade/WebSocket) que marca a origem e repassa para 127.0.0.1:destino. */
export function criarProxyHttp(destino) {
  const server = http.createServer((req, res) => {
    const upstream = http.request(
      { host: "127.0.0.1", port: destino, path: req.url, method: req.method, headers: cabecalhosMarcados(req.headers) },
      (resposta) => {
        res.writeHead(resposta.statusCode ?? 502, resposta.headers);
        resposta.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("Vincere indisponível (o túnel ou o servidor não responde).");
    });
    req.on("aborted", () => upstream.destroy());
    req.pipe(upstream);
  });

  server.on("upgrade", (req, socket, head) => {
    const upstream = net.connect(destino, "127.0.0.1", () => {
      const linhas = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (const [nome, valor] of Object.entries(cabecalhosMarcados(req.headers))) {
        for (const v of Array.isArray(valor) ? valor : [valor]) linhas.push(`${nome}: ${v}`);
      }
      upstream.write(`${linhas.join("\r\n")}\r\n\r\n`);
      if (head?.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    const fechar = () => {
      socket.destroy();
      upstream.destroy();
    };
    socket.on("error", fechar);
    upstream.on("error", fechar);
  });

  server.on("clientError", (_err, socket) => socket.destroy());
  return server;
}

function criarRepasseTcp(destino) {
  return net.createServer((client) => {
    const upstream = net.connect(destino, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", close);
    upstream.on("error", close);
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254."))
    .map((i) => i.address);
}

function iniciar() {
  const PORTS = (process.env.LAN_PORTS || "3210,3010").split(",").map(Number);
  const HTTP_PORTS = new Set((process.env.LAN_HTTP_PORTS || "3210").split(",").map(Number));
  const hosts = process.env.LAN_HOST ? [process.env.LAN_HOST] : lanAddresses();
  if (hosts.length === 0) {
    console.error("Nenhum IP de rede local encontrado. Conecte o PC ao Wi-Fi e tente de novo.");
    process.exit(1);
  }
  for (const host of hosts) {
    for (const port of PORTS) {
      const server = HTTP_PORTS.has(port) ? criarProxyHttp(port) : criarRepasseTcp(port);
      server.on("error", (err) => console.error(`[${host}:${port}] ${err.message}`));
      server.listen(port, host, () =>
        console.log(`Repassando http://${host}:${port} → 127.0.0.1:${port}${HTTP_PORTS.has(port) ? " (marcando a origem: rede)" : ""}`),
      );
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) iniciar();

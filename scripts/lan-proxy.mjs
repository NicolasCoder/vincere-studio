// Expõe na rede local (Wi-Fi) as portas que no PC só escutam em 127.0.0.1:
//   3210 → Vincere Studio (túnel SSH para a VPS)
//   3010 → HyperFrames Studio (preview local)
// Uso: node scripts/lan-proxy.mjs  → abra http://<IP-do-PC>:3210 no celular.
// Só escuta no IP da rede local (nunca 0.0.0.0) para não conflitar com o túnel.
import net from "node:net";
import os from "node:os";

const PORTS = (process.env.LAN_PORTS || "3210,3010").split(",").map(Number);

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254."))
    .map((i) => i.address);
}

const hosts = process.env.LAN_HOST ? [process.env.LAN_HOST] : lanAddresses();
if (hosts.length === 0) {
  console.error("Nenhum IP de rede local encontrado. Conecte o PC ao Wi-Fi e tente de novo.");
  process.exit(1);
}

for (const host of hosts) {
  for (const port of PORTS) {
    const server = net.createServer((client) => {
      const upstream = net.connect(port, "127.0.0.1");
      client.pipe(upstream).pipe(client);
      const close = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on("error", close);
      upstream.on("error", close);
    });
    server.on("error", (err) => console.error(`[${host}:${port}] ${err.message}`));
    server.listen(port, host, () => console.log(`Repassando http://${host}:${port} → 127.0.0.1:${port}`));
  }
}

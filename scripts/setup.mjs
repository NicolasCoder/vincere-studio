#!/usr/bin/env node
// Primeiro uso do Vincere Studio, em qualquer sistema (Windows, Mac, Linux).
//   pnpm run setup            prepara tudo: .env, pastas, banco e confere as ferramentas
//   pnpm run setup -- --check só confere e mostra o que falta, sem alterar nada
//   pnpm run setup -- --sem-banco  não mexe no banco (cria só .env e pastas)
// Nunca sobrescreve um .env nem um banco que já existem. Obs.: "pnpm setup" (sem "run") é um comando interno do
// pnpm e não chega aqui; use "pnpm run setup".
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argumentos = new Set(process.argv.slice(2));
const soConferir = argumentos.has("--check");
const semBanco = argumentos.has("--sem-banco");
const raiz = process.env.VINCERE_SETUP_RAIZ ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";

const ok = (m) => console.log(`  ✓ ${m}`);
const aviso = (m) => console.log(`  - ${m}`);
const erro = (m) => console.log(`  ✗ ${m}`);
const titulo = (m) => console.log(`\n${m}`);

/** Roda um comando de consulta (sem alterar nada) e devolve a primeira linha da saída, ou null se não existir. */
function consultar(comando, args) {
  const r = spawnSync(comando, args, { encoding: "utf8", shell: win, timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr || "").trim().split(/\r?\n/)[0] || "ok";
}

let falhou = false;

console.log(`Vincere Studio — primeiro uso${soConferir ? " (somente conferência)" : ""}`);
console.log(`Pasta: ${raiz}`);

// 1) Node
titulo("1. Node.js");
const [maior] = process.versions.node.split(".").map(Number);
if (maior >= 20) ok(`Node ${process.versions.node}`);
else {
  erro(`Node ${process.versions.node}: o Vincere precisa do Node 20 ou mais novo.`);
  falhou = true;
}

// 2) .env
titulo("2. Arquivo .env (configuração)");
const envArquivo = path.join(raiz, ".env");
const exemplo = path.join(raiz, ".env.example");
if (existsSync(envArquivo)) ok(".env já existe; não mexi nele.");
else if (!existsSync(exemplo)) {
  erro(".env.example não encontrado; não dá para criar o .env.");
  falhou = true;
} else if (soConferir) aviso("Falta o .env (o setup cria a partir do .env.example).");
else {
  copyFileSync(exemplo, envArquivo);
  ok("Criei o .env a partir do .env.example. As chaves de API você coloca depois, pela tela (Configurações → Chaves de API).");
}

// 3) Pastas
titulo("3. Pastas de dados");
let storage = path.join(raiz, "storage");
if (existsSync(envArquivo)) {
  const linha = readFileSync(envArquivo, "utf8").split(/\r?\n/).find((l) => /^STORAGE_DIR\s*=/.test(l));
  const valor = linha?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
  if (valor) storage = path.resolve(raiz, valor);
}
if (existsSync(storage)) ok(`Pasta de mídia: ${storage}`);
else if (soConferir) aviso(`Falta a pasta de mídia: ${storage}`);
else {
  mkdirSync(storage, { recursive: true });
  ok(`Criei a pasta de mídia: ${storage}`);
}

// 4) Banco
titulo("4. Banco de dados");
const bancoNovo = !existsSync(path.join(raiz, "storage", "docupulse.db"));
if (semBanco || soConferir) aviso(soConferir ? "Conferência: o banco não foi verificado." : "Pulei o banco (--sem-banco).");
else if (!existsSync(path.join(raiz, "node_modules"))) {
  erro("Dependências não instaladas. Rode `pnpm install` e depois `pnpm run setup`.");
  falhou = true;
} else {
  const passos = [["db:generate"], ["db:push"], ...(bancoNovo ? [["db:seed"]] : [])];
  for (const p of passos) {
    console.log(`  > pnpm ${p.join(" ")}`);
    const r = spawnSync("pnpm", p, { cwd: raiz, stdio: "inherit", shell: win });
    if (r.status !== 0) {
      erro(`Falhou: pnpm ${p.join(" ")}`);
      falhou = true;
      break;
    }
  }
  if (!falhou) ok(bancoNovo ? "Banco criado e preenchido com os dados iniciais." : "Banco já existia: atualizei o esquema e mantive os seus dados.");
}

// 5) Ferramentas (informativo: nada aqui impede de começar)
titulo("5. Ferramentas no seu computador");
const ffmpeg = consultar("ffmpeg", ["-version"]);
ffmpeg ? ok(ffmpeg) : aviso("ffmpeg não encontrado: necessário para renderizar e cortar vídeo (https://ffmpeg.org/download.html).");
const hf = consultar("hyperframes", ["--version"]);
hf ? ok(`HyperFrames ${hf}`) : aviso("HyperFrames não encontrado: instale com `npm i -g hyperframes`, ou aponte um servidor seu em Configurações.");
const gpu = consultar("nvidia-smi", ["-L"]);
gpu ? ok(`GPU: ${gpu}`) : aviso("Sem GPU NVIDIA detectada: Sharingan e render rápido ficam mais lentos (funcionam, só demoram).");
const agentes = [["claude", ["--version"]], ["codex", ["--version"]], ["agy", ["--version"]]]
  .map(([nome, args]) => [nome, consultar(nome, args)])
  .filter(([, v]) => v)
  .map(([nome]) => nome);
agentes.length
  ? ok(`Agentes de IA encontrados: ${agentes.join(", ")} (vincule um ao Vince em Configurações)`)
  : aviso("Nenhum agente de IA encontrado (Claude Code, Codex, Antigravity). Dá para usar uma chave do Gemini no lugar.");

// 6) Próximos passos
titulo(falhou ? "Resolva os itens com ✗ acima e rode de novo." : "Pronto! Próximos passos:");
if (!falhou) {
  console.log("  1. Inicie:  pnpm dev     (abre em http://localhost:3210)");
  console.log("  2. Em Configurações: salve a chave do Gemini (Chaves de API) e vincule a sua IA ao Vince.");
  console.log("  3. Escolha onde o HyperFrames roda (neste computador ou no seu servidor).");
}
process.exit(falhou ? 1 : 0);

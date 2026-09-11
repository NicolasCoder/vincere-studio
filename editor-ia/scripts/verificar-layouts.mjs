#!/usr/bin/env node
/**
 * Verificação dos layouts DVP: renderiza os sete layouts nos dois formatos e confere o que saiu.
 *
 * Existe por causa de uma tarde em que três defeitos foram para o master sem que nada reclamasse,
 * todos do mesmo tipo — código que passa no typecheck e desenha errado:
 *
 *   · OverlayDado cortado em 9:16 (tudo dimensionado por `height`, que em vertical é 1920)
 *   · faixa cinza na MesaArquivo (altura em % sem container com altura resolvida)
 *   · cronologia proposta em Short, onde o eixo nunca coube
 *
 * Nenhum desses é pegável por tipo. Todos são pegáveis renderizando e medindo.
 *
 * O que é asserção (falha o script) e o que é olho humano está separado de propósito: a folha de
 * contato no fim existe porque "ficou feio" não é mensurável, e fingir que é só produziria um
 * teste que ninguém confia.
 *
 * Uso:  node scripts/verificar-layouts.mjs [--apenas <layout>] [--manter]
 */
import { spawn } from "node:child_process";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(RAIZ, "_provas", "layouts");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

const LAYOUTS = [
  "lower-third",
  "overlay-dado",
  "insert-arquivo",
  "split-evidencia",
  "graphic-fullscreen",
  "cronologia",
  "mesa-arquivo",
];
/** Layouts que ocupam o quadro inteiro por natureza: nem chegam a ser renderizados sem fundo. */
const TELA_CHEIA = new Set(["graphic-fullscreen", "cronologia", "mesa-arquivo"]);

/**
 * Layouts que flutuam sobre o master com margem — os únicos em que encostar na borda significa
 * corte.
 *
 * A distinção não é cosmética. A primeira versão testava borda em toda inserção e acusou
 * `insert-arquivo` (um insert full-bleed) e `split-evidencia` (meia tela exata, de borda a borda)
 * como cortados: nos dois, ocupar a lateral inteira É o desenho. Um teste que acusa o comportamento
 * correto é pior que nenhum, porque ensina a ignorar o resultado.
 */
const BORDA_PROIBIDA = new Set(["lower-third", "overlay-dado"]);

/** Abaixo disto o layout praticamente não desenhou nada sobre o master. */
const COBERTURA_MINIMA = 0.004;
const FORMATOS = {
  LONG_16_9: { w: 1920, h: 1080 },
  SHORT_9_16: { w: 1080, h: 1920 },
};

/**
 * Layouts que o perfil DOCUMENTARIO_DVP não libera em 9:16. Continuam sendo renderizados: se um dia
 * alguém liberar, a verificação já mostra em que estado eles estão.
 */
const NAO_LIBERADOS_VERTICAL = new Set(["cronologia", "mesa-arquivo"]);

const exec = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: RAIZ, shell: process.platform === "win32", ...opts });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });

/** Executa capturando stdout binário, para ler pixels crus. */
const execBin = (cmd, args) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: RAIZ, shell: process.platform === "win32" });
    const pedacos = [];
    p.stdout.on("data", (d) => pedacos.push(d));
    p.stderr.on("data", () => {});
    p.on("close", (code) => resolve({ code, buf: Buffer.concat(pedacos) }));
  });

const GRADE_W = 64;
const GRADE_H = 36;

/**
 * Estatísticas de luma lendo os pixels, não o `signalstats`.
 *
 * O filtro não emite desvio padrão — só mínimo, máximo e percentis — e nenhum desses distingue
 * "quadro chapado" de "quadro escuro com um texto branco": YMAX chega a 255 com um pixel só. Reduzir
 * para 64x36 em cinza e fazer a conta aqui custa um ffmpeg e dá a medida certa, além de permitir
 * olhar linha a linha.
 */
async function estatisticas(file) {
  const { buf } = await execBin(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-i", file, "-frames:v", "1",
    "-vf", `scale=${GRADE_W}:${GRADE_H}:out_range=full,format=gray`,
    "-f", "rawvideo", "-",
  ]);
  if (buf.length < GRADE_W * GRADE_H) return { media: null, desvio: null, linhas: [] };
  const px = [...buf.subarray(0, GRADE_W * GRADE_H)];
  const media = px.reduce((s, x) => s + x, 0) / px.length;
  const desvio = Math.sqrt(px.reduce((s, x) => s + (x - media) ** 2, 0) / px.length);
  // Desvio por linha: uma faixa morta no meio do quadro aparece como linhas seguidas de desvio ~0.
  const linhas = [];
  for (let y = 0; y < GRADE_H; y++) {
    const l = px.slice(y * GRADE_W, (y + 1) * GRADE_W);
    const m = l.reduce((s, x) => s + x, 0) / l.length;
    linhas.push(Math.sqrt(l.reduce((s, x) => s + (x - m) ** 2, 0) / l.length));
  }
  return { media, desvio, linhas };
}

/**
 * Faixa morta: linhas seguidas sem nenhuma variação, longe das bordas.
 *
 * É a assinatura exata da faixa cinza que apareceu na MesaArquivo — uma altura em porcentagem que
 * não resolveu contra o container e virou um retângulo chapado no meio da composição. Fundo liso
 * legítimo quase sempre encosta no topo ou no rodapé, então só o miolo é acusado.
 */
function faixaMorta(linhas) {
  const margem = Math.round(GRADE_H * 0.15);
  let melhor = null;
  let inicio = -1;
  for (let y = 0; y <= GRADE_H; y++) {
    const chapada = y < GRADE_H && linhas[y] < 0.6;
    if (chapada && inicio < 0) inicio = y;
    if (!chapada && inicio >= 0) {
      const alt = y - inicio;
      const noMiolo = inicio >= margem && y <= GRADE_H - margem;
      if (noMiolo && alt >= Math.round(GRADE_H * 0.12) && (!melhor || alt > melhor.altura)) {
        melhor = { inicio, altura: alt };
      }
      inicio = -1;
    }
  }
  return melhor;
}

async function dimensoes(file) {
  const { out } = await exec("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0", file,
  ]);
  const [w, h] = out.trim().split(",").map(Number);
  return { w, h };
}

/**
 * Caixa do conteúdo desenhado, a partir do canal alfa.
 *
 * `cropdetect` normalmente procura barras pretas; aplicado ao alfa extraído, ele devolve a área que
 * realmente tem pixel opaco. Se essa área encosta na borda do quadro, o layout está sendo cortado.
 *
 * `skip=0` é obrigatório e não é detalhe: por padrão o cropdetect descarta os dois primeiros frames,
 * então num still de um frame só ele nunca avalia nada e não imprime — a verificação passava "sem
 * falhas" justamente por nunca ter rodado.
 */
async function caixaDoConteudo(file) {
  const { out } = await exec(FFMPEG, [
    "-hide_banner", "-i", file, "-frames:v", "1",
    "-vf", "alphaextract,cropdetect=limit=0.02:round=2:skip=0",
    "-f", "null", "-",
  ]);
  const todos = [...out.matchAll(/crop=(\d+):(\d+):(-?\d+):(-?\d+)/g)];
  if (!todos.length) return null;
  const [, w, h, x, y] = todos[todos.length - 1].map(Number);
  return { w, h, x, y };
}

const args = process.argv.slice(2);
const apenas = args.includes("--apenas") ? args[args.indexOf("--apenas") + 1] : null;
const manter = args.includes("--manter");

async function main() {
  if (!existsSync(path.join(RAIZ, "node_modules"))) {
    console.error("node_modules ausente em editor-ia — rode `npm install` ali antes.");
    process.exit(2);
  }
  await rm(SAIDA, { recursive: true, force: true });
  await mkdir(SAIDA, { recursive: true });

  const casos = [];
  for (const layout of LAYOUTS) {
    if (apenas && layout !== apenas) continue;
    for (const format of Object.keys(FORMATOS)) casos.push({ layout, format });
  }

  const falhas = [];
  const avisos = [];
  const feitos = [];

  for (const { layout, format } of casos) {
    const nome = `${layout}__${format}`;
    const alvo = FORMATOS[format];
    const comFundo = path.join(SAIDA, `${nome}.png`);
    const semFundo = path.join(SAIDA, `${nome}__alfa.png`);
    process.stdout.write(`· ${nome.padEnd(34)}`);

    // Props vão por arquivo, não inline: no Windows o `shell: true` do spawn come as aspas do JSON
    // e o Remotion recebe `{layout:overlay-dado}`, que não é JSON. Arquivo não tem esse problema.
    const render = async (arquivo, sobreMaster) => {
      const pfile = path.join(SAIDA, `${nome}__props-${sobreMaster ? "fundo" : "alfa"}.json`);
      await writeFile(pfile, JSON.stringify({ layout, format, sobreMaster }), "utf8");
      return exec("npx", [
        "remotion", "still", "src/index.ts", "Banco", arquivo,
        "--frame=60", "--image-format=png", "--log=error",
        `--props=${pfile}`,
      ]);
    };

    const r1 = await render(comFundo, true);
    if (r1.code !== 0 || !existsSync(comFundo)) {
      console.log("FALHOU no render");
      falhas.push(`${nome}: render não concluiu — ${r1.out.trim().split("\n").slice(-3).join(" | ")}`);
      continue;
    }

    // 1) Dimensões. Pega calculateMetadata ignorando o formato.
    const dim = await dimensoes(comFundo);
    if (dim.w !== alvo.w || dim.h !== alvo.h) {
      console.log(`FALHOU dimensão ${dim.w}x${dim.h}`);
      falhas.push(`${nome}: saiu ${dim.w}x${dim.h}, esperado ${alvo.w}x${alvo.h}`);
      continue;
    }

    // 2) Quadro chapado. Desvio perto de zero é nada desenhado — ou tela toda de uma cor só.
    const est = await estatisticas(comFundo);
    if (est.desvio == null || est.desvio < 4) {
      console.log(`FALHOU quadro chapado (desvio ${est.desvio})`);
      falhas.push(`${nome}: quadro praticamente uniforme (desvio de luma ${est.desvio}) — nada foi desenhado`);
      continue;
    }

    // 3) Faixa morta no miolo: um retângulo chapado atravessando a composição.
    const faixa = faixaMorta(est.linhas);
    if (faixa) {
      const pctTopo = Math.round((faixa.inicio / GRADE_H) * 100);
      const pctAlt = Math.round((faixa.altura / GRADE_H) * 100);
      console.log(`FALHOU faixa morta (${pctAlt}% da altura a partir de ${pctTopo}%)`);
      falhas.push(`${nome}: faixa chapada ocupando ${pctAlt}% da altura a partir de ${pctTopo}% do topo`);
      continue;
    }

    // 4) Corte. Só faz sentido para inserção: tela cheia encosta na borda por desenho.
    let nota = "";
    if (!TELA_CHEIA.has(layout)) {
      const r2 = await render(semFundo, false);
      const caixa = r2.code === 0 && existsSync(semFundo) ? await caixaDoConteudo(semFundo) : null;
      if (caixa) {
        const cobertura = (caixa.w * caixa.h) / (alvo.w * alvo.h);
        if (cobertura < COBERTURA_MINIMA) {
          console.log(`FALHOU quase nada desenhado (${(cobertura * 100).toFixed(2)}% do quadro)`);
          falhas.push(`${nome}: o layout cobre só ${(cobertura * 100).toFixed(2)}% do quadro — provavelmente não desenhou`);
          continue;
        }
        const encosta = caixa.x <= 0 || caixa.y <= 0 || caixa.x + caixa.w >= alvo.w || caixa.y + caixa.h >= alvo.h;
        if (encosta && BORDA_PROIBIDA.has(layout)) {
          console.log(`FALHOU corte (conteúdo ${caixa.w}x${caixa.h} em ${caixa.x},${caixa.y})`);
          falhas.push(
            `${nome}: conteúdo encosta na borda — caixa ${caixa.w}x${caixa.h} em (${caixa.x},${caixa.y}) num quadro ${alvo.w}x${alvo.h}`,
          );
          continue;
        }
        nota = ` conteúdo ${caixa.w}x${caixa.h} (${(cobertura * 100).toFixed(0)}%)`;
      } else {
        // Sem caixa não há verificação de corte — e uma verificação que não roda em silêncio é
        // pior que verificação nenhuma, porque o "sem falhas" no fim vira mentira.
        avisos.push(`${nome}: não foi possível medir a caixa do conteúdo — corte NÃO verificado`);
        nota = " (corte não verificado)";
      }
    }

    if (format === "SHORT_9_16" && NAO_LIBERADOS_VERTICAL.has(layout)) {
      avisos.push(`${nome}: renderiza, mas o perfil DOCUMENTARIO_DVP não libera este layout em 9:16`);
    }

    feitos.push({ nome, arquivo: comFundo });
    console.log(`ok · desvio ${est.desvio?.toFixed(1)}${nota}`);
  }

  // Folha de contato: os quatorze de uma vez, para o julgamento que nenhuma métrica faz.
  if (feitos.length) {
    const folha = path.join(SAIDA, "_folha-de-contato.png");
    const COLS = 3;
    const CEL_W = 480;
    const CEL_H = 270;
    // A última linha quase nunca fecha (14 casos em 3 colunas), e `vstack` recusa linhas de
    // larguras diferentes — foi assim que a folha deixou de ser gerada sem ninguém notar. As
    // células que faltam entram como quadros vazios, para todas as linhas terem a mesma largura.
    const faltam = (COLS - (feitos.length % COLS)) % COLS;
    const entradas = feitos.flatMap((f) => ["-i", f.arquivo]);
    for (let i = 0; i < faltam; i++) entradas.push("-f", "lavfi", "-i", `color=c=0x121212:s=${CEL_W}x${CEL_H}`);
    const total = feitos.length + faltam;

    const cels = Array.from({ length: total }, (_, i) =>
      `[${i}:v]scale=${CEL_W}:${CEL_H}:force_original_aspect_ratio=decrease,pad=${CEL_W}:${CEL_H}:(ow-iw)/2:(oh-ih)/2:color=0x1A1A1A,setsar=1[c${i}]`,
    ).join(";");

    const linhas = [];
    for (let i = 0; i < total; i += COLS) {
      const grupo = Array.from({ length: COLS }, (_, j) => `[c${i + j}]`);
      linhas.push(`${grupo.join("")}hstack=inputs=${COLS}[l${i / COLS}]`);
    }
    const empilha =
      linhas.length > 1
        ? `${linhas.map((_, i) => `[l${i}]`).join("")}vstack=inputs=${linhas.length}[saida]`
        : `[l0]null[saida]`;
    const { code, out } = await exec(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error", ...entradas,
      "-filter_complex", `${cels};${linhas.join(";")};${empilha}`,
      "-frames:v", "1", "-map", "[saida]", folha,
    ]);
    if (code === 0) console.log(`\nFolha de contato: ${path.relative(RAIZ, folha)}`);
    else avisos.push(`folha de contato não foi gerada — ${out.trim().split("\n").slice(-2).join(" | ")}`);
  }

  if (!manter) {
    for (const f of await readdir(SAIDA)) if (f.endsWith("__alfa.png") || f.endsWith(".json")) await rm(path.join(SAIDA, f));
  }

  console.log("");
  for (const a of avisos) console.log(`aviso · ${a}`);
  if (falhas.length) {
    console.log(`\n${falhas.length} falha(s):`);
    for (const f of falhas) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`${feitos.length}/${casos.length} layouts verificados sem falha.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

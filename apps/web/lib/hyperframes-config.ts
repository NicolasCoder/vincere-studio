import { prisma } from "@vincere-studio/db";
import { urlsCandidatas } from "./hyperframes-autostart";

// Onde o HyperFrames roda é uma escolha de cada instância, feita na tela de Configurações (sem editar .env):
//  - "local": neste computador (o Vincere pode iniciar o preview sozinho);
//  - "remoto": num servidor da própria pessoa, alcançado por um endereço (normalmente um túnel SSH).
// O .env continua valendo como padrão enquanto nada foi salvo na tela.

export type HfModo = "local" | "remoto";

export interface AlvoHyperframes {
  modo: HfModo;
  /** Endereço do preview remoto; null no modo local. */
  url: string | null;
  port: number;
  /** Endereços a consultar para saber se o preview está de pé. */
  urls: string[];
  /** true quando o preview não roda neste computador: nunca tentar iniciar um local. */
  modoVps: boolean;
}

const K_MODO = "hyperframes:modo";
const K_URL = "hyperframes:url";
const PORTA_PADRAO = 3010;

/** Aceita só http(s) sem usuário/senha e devolve a origem normalizada (sem caminho). */
export function validarUrlRemota(bruto: string): string {
  const texto = bruto.trim();
  if (!texto) throw new Error("Informe o endereço do HyperFrames no seu servidor.");
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    throw new Error("Endereço inválido. Exemplo: http://127.0.0.1:3010");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("O endereço precisa começar com http:// ou https://.");
  if (u.username || u.password) throw new Error("Não coloque usuário e senha no endereço.");
  if (!u.hostname) throw new Error("Endereço sem servidor.");
  return u.origin;
}

function portaDe(u: URL): number {
  return Number(u.port) || (u.protocol === "https:" ? 443 : 80);
}

type Ambiente = Record<string, string | undefined>;

/** Decide o alvo a partir do que foi salvo na tela e do .env (função pura, para testar). */
export function resolverAlvo(salvo: { modo?: string | null; url?: string | null }, env: Ambiente = process.env): AlvoHyperframes {
  if (salvo.modo === "remoto" && salvo.url) {
    try {
      const url = validarUrlRemota(salvo.url);
      return { modo: "remoto", url, port: portaDe(new URL(url)), urls: [url], modoVps: true };
    } catch {
      // Endereço salvo inválido: cai no padrão do .env em vez de quebrar o Studio.
    }
  }
  let porta = PORTA_PADRAO;
  try {
    porta = Number(new URL(env.HYPERFRAMES_URL || `http://127.0.0.1:${PORTA_PADRAO}`).port) || PORTA_PADRAO;
  } catch {
    porta = PORTA_PADRAO;
  }
  if (salvo.modo === "local") {
    return { modo: "local", url: null, port: porta, urls: urlsCandidatas(undefined, porta), modoVps: false };
  }
  // Nada salvo: comportamento anterior, guiado pelo .env.
  const modoVps = env.HYPERFRAMES_MODO?.trim().toLowerCase() === "vps";
  return {
    modo: modoVps ? "remoto" : "local",
    url: modoVps ? env.HYPERFRAMES_URL || null : null,
    port: porta,
    urls: urlsCandidatas(env.HYPERFRAMES_URL, porta),
    modoVps,
  };
}

export async function lerAlvoHyperframes(env: Ambiente = process.env): Promise<AlvoHyperframes> {
  try {
    const linhas = await prisma.setting.findMany({ where: { key: { in: [K_MODO, K_URL] } } });
    const mapa = Object.fromEntries(linhas.map((l) => [l.key, l.value]));
    return resolverAlvo({ modo: mapa[K_MODO], url: mapa[K_URL] }, env);
  } catch {
    return resolverAlvo({}, env);
  }
}

export async function salvarAlvoHyperframes(modo: HfModo, urlBruta?: string): Promise<AlvoHyperframes> {
  if (modo !== "local" && modo !== "remoto") throw new Error("Modo inválido.");
  const url = modo === "remoto" ? validarUrlRemota(urlBruta ?? "") : null;
  await prisma.setting.upsert({ where: { key: K_MODO }, update: { value: modo }, create: { key: K_MODO, value: modo } });
  if (url) await prisma.setting.upsert({ where: { key: K_URL }, update: { value: url }, create: { key: K_URL, value: url } });
  return resolverAlvo({ modo, url });
}

export interface ResultadoTeste {
  ok: boolean;
  mensagem: string;
  versao?: string;
  projeto?: string;
}

/** Pergunta ao preview quem ele é (/__hyperframes_config); é o mesmo sinal que o Studio usa. */
export async function testarHyperframes(urlBruta: string, fetchImpl: typeof fetch = fetch): Promise<ResultadoTeste> {
  let url: string;
  try {
    url = validarUrlRemota(urlBruta);
  } catch (err) {
    return { ok: false, mensagem: err instanceof Error ? err.message : "Endereço inválido." };
  }
  try {
    const res = await fetchImpl(`${url}/__hyperframes_config`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, mensagem: `O servidor respondeu com erro ${res.status}. Confira se é o HyperFrames.` };
    const dados = (await res.json()) as { isHyperframes?: boolean; version?: string; projectName?: string };
    if (!dados?.isHyperframes) return { ok: false, mensagem: "Respondeu, mas não parece ser um preview do HyperFrames." };
    return { ok: true, mensagem: "Conectado ao HyperFrames.", versao: dados.version, projeto: dados.projectName };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "sem conexão";
    return { ok: false, mensagem: `Não consegui conectar (${motivo}). Confira se o preview está rodando e se o túnel está aberto.` };
  }
}

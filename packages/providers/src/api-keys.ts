import { prisma } from "@vincere-studio/db";

// Chaves de API salvas pela interface (Configurações), por instância. Cada pessoa usa as próprias chaves:
// nada aqui é compartilhado e nenhum valor sai do servidor da instância. Ficam na tabela Setting (prefixo
// "apikey:") e, ao carregar, passam a valer em process.env (o valor salvo na tela vence o do .env).

export type GrupoChave = "texto" | "midia" | "voz" | "youtube";

export interface ApiKeySpec {
  name: string;
  label: string;
  grupo: GrupoChave;
  ajuda: string;
  /** false = configuração comum (URL, modelo): pode ser mostrada por inteiro. */
  segredo: boolean;
}

export const API_KEY_SPECS: ApiKeySpec[] = [
  { name: "GEMINI_API_KEY", label: "Gemini (ideias, roteiro e voz)", grupo: "texto", segredo: true, ajuda: "Grátis em aistudio.google.com/apikey" },
  { name: "GEMINI_IMAGE_API_KEY", label: "Gemini — imagens (opcional)", grupo: "texto", segredo: true, ajuda: "Só se você tiver faturamento ativo; senão usa a chave acima" },
  { name: "TEXT_PROVIDER", label: "Provedor de texto", grupo: "texto", segredo: false, ajuda: "GEMINI, OLLAMA ou OPENAI_COMPAT" },
  { name: "TEXT_PROVIDER_IDEIAS", label: "Provedor de texto só para ideias (opcional)", grupo: "texto", segredo: false, ajuda: "Vazio = o provedor de texto padrão" },
  { name: "TEXT_PROVIDER_ROTEIRO", label: "Provedor de texto só para roteiro (opcional)", grupo: "texto", segredo: false, ajuda: "Vazio = o provedor de texto padrão" },
  { name: "TEXT_PROVIDER_FALLBACK", label: "Provedor de texto de reserva (opcional)", grupo: "texto", segredo: false, ajuda: "Assume se o principal falhar (GEMINI, OLLAMA ou OPENAI_COMPAT)" },
  { name: "OPENAI_COMPAT_API_KEY", label: "LLM compatível com OpenAI — chave", grupo: "texto", segredo: true, ajuda: "NVIDIA NIM, OpenRouter, Groq, Hermes…" },
  { name: "OPENAI_COMPAT_BASE_URL", label: "LLM compatível com OpenAI — endereço", grupo: "texto", segredo: false, ajuda: "Ex.: https://integrate.api.nvidia.com/v1" },
  { name: "OPENAI_COMPAT_MODEL", label: "LLM compatível com OpenAI — modelo", grupo: "texto", segredo: false, ajuda: "Nome do modelo no provedor" },
  { name: "PEXELS_API_KEY", label: "Pexels (B-roll em vídeo)", grupo: "midia", segredo: true, ajuda: "Grátis em pexels.com/api" },
  { name: "PIXABAY_API_KEY", label: "Pixabay (B-roll)", grupo: "midia", segredo: true, ajuda: "Grátis em pixabay.com/api/docs" },
  { name: "COVERR_API_KEY", label: "Coverr (B-roll)", grupo: "midia", segredo: true, ajuda: "coverr.co/developers" },
  { name: "CLOUDFLARE_ACCOUNT_ID", label: "Cloudflare — ID da conta (imagens grátis)", grupo: "midia", segredo: false, ajuda: "dash.cloudflare.com: o ID aparece na URL da conta" },
  { name: "CLOUDFLARE_API_TOKEN", label: "Cloudflare Workers AI — token", grupo: "midia", segredo: true, ajuda: "Token com permissão Workers AI; cota diária gratuita" },
  { name: "HUGGINGFACE_TOKEN", label: "Hugging Face (imagens grátis)", grupo: "midia", segredo: true, ajuda: "huggingface.co → Settings → Access Tokens" },
  { name: "TOGETHER_API_KEY", label: "Together.ai (imagens, nível grátis)", grupo: "midia", segredo: true, ajuda: "api.together.xyz" },
  { name: "OPENAI_API_KEY", label: "OpenAI (GPT Image, pago)", grupo: "midia", segredo: true, ajuda: "platform.openai.com → API keys" },
  { name: "KIE_API_KEY", label: "kie.ai (imagens pagas)", grupo: "midia", segredo: true, ajuda: "Só funciona com teto de orçamento acima de US$ 0" },
  { name: "ELEVENLABS_API_KEY", label: "ElevenLabs (voz premium, opcional)", grupo: "voz", segredo: true, ajuda: "Plano grátis com créditos mensais" },
  { name: "YOUTUBE_API_KEY", label: "YouTube Data API (painel de canais)", grupo: "youtube", segredo: true, ajuda: "Google Cloud Console" },
  { name: "YOUTUBE_CLIENT_ID", label: "YouTube OAuth — Client ID", grupo: "youtube", segredo: false, ajuda: "Para conectar o seu canal (Google Cloud Console)" },
  { name: "YOUTUBE_CLIENT_SECRET", label: "YouTube OAuth — Client Secret", grupo: "youtube", segredo: true, ajuda: "Par do Client ID acima" },
];

const NOMES = new Set(API_KEY_SPECS.map((s) => s.name));
const PROVEDORES_TEXTO = new Set(["GEMINI", "OLLAMA", "OPENAI_COMPAT"]);
const PREFIXO = "apikey:";

export function chaveNoBanco(name: string): string {
  return `${PREFIXO}${name}`;
}

export function nomePermitido(name: string): boolean {
  return NOMES.has(name);
}

/** Mostra só o final da chave; nunca devolve o valor inteiro para a tela. */
export function mascarar(valor: string): string {
  if (valor.length <= 8) return "••••••••";
  return `••••••••${valor.slice(-4)}`;
}

/** Valida e normaliza o valor; lança Error com mensagem em português (sem repetir o valor recebido). */
export function validarValor(name: string, bruto: string): string {
  if (!nomePermitido(name)) throw new Error("Chave desconhecida.");
  const valor = bruto.trim();
  if (!valor) throw new Error("Cole o valor antes de salvar.");
  if (valor.length > 512) throw new Error("Valor longo demais (máximo 512 caracteres).");
  if (/[\r\n]/.test(valor)) throw new Error("O valor não pode ter quebra de linha.");
  const spec = API_KEY_SPECS.find((s) => s.name === name);
  if (spec?.segredo && /\s/.test(valor)) throw new Error("A chave não pode ter espaços; confira se copiou inteira.");
  const ehProvedorDeTexto = name === "TEXT_PROVIDER" || name.startsWith("TEXT_PROVIDER_");
  if (ehProvedorDeTexto && !PROVEDORES_TEXTO.has(valor.toUpperCase())) {
    throw new Error("Provedor de texto inválido. Use GEMINI, OLLAMA ou OPENAI_COMPAT.");
  }
  if (name === "OPENAI_COMPAT_BASE_URL" && !/^https?:\/\/[^\s]+$/i.test(valor)) {
    throw new Error("O endereço precisa começar com http:// ou https://.");
  }
  return ehProvedorDeTexto ? valor.toUpperCase() : valor;
}

type Ambiente = Record<string, string | undefined>;

// Valor que o .env já tinha antes de a tela sobrescrevê-lo, para voltar a ele se a chave for removida.
// Guardado por ambiente (e não global): cada processo/objeto env tem o seu próprio "original".
const originaisPorAmbiente = new WeakMap<object, Map<string, string | undefined>>();

function originaisDe(env: Ambiente): Map<string, string | undefined> {
  let m = originaisPorAmbiente.get(env);
  if (!m) {
    m = new Map();
    originaisPorAmbiente.set(env, m);
  }
  return m;
}

function aplicar(env: Ambiente, name: string, valor: string) {
  const originais = originaisDe(env);
  if (!originais.has(name)) originais.set(name, env[name]);
  env[name] = valor;
}

function restaurar(env: Ambiente, name: string) {
  const originais = originaisDe(env);
  if (!originais.has(name)) return;
  const original = originais.get(name);
  if (original === undefined) delete env[name];
  else env[name] = original;
  originais.delete(name);
}

export async function carregarChavesSalvas(): Promise<Record<string, string>> {
  const linhas = await prisma.setting.findMany({ where: { key: { startsWith: PREFIXO } } });
  const out: Record<string, string> = {};
  for (const l of linhas) {
    const name = l.key.slice(PREFIXO.length);
    if (nomePermitido(name) && l.value) out[name] = l.value;
  }
  return out;
}

/**
 * Faz as chaves salvas na tela valerem no processo atual. O web chama ao iniciar (instrumentation) e o
 * worker, antes de cada job: assim salvar uma chave já habilita a função, sem reiniciar nada. Chaves
 * removidas voltam ao valor do .env.
 */
export async function carregarChavesNoAmbiente(env: Ambiente = process.env): Promise<string[]> {
  const salvas = await carregarChavesSalvas();
  for (const [name, valor] of Object.entries(salvas)) aplicar(env, name, valor);
  for (const name of [...originaisDe(env).keys()]) if (!(name in salvas)) restaurar(env, name);
  return Object.keys(salvas);
}

export async function salvarChave(name: string, bruto: string, env: Ambiente = process.env): Promise<void> {
  const valor = validarValor(name, bruto);
  await prisma.setting.upsert({
    where: { key: chaveNoBanco(name) },
    update: { value: valor },
    create: { key: chaveNoBanco(name), value: valor },
  });
  aplicar(env, name, valor);
}

export async function removerChave(name: string, env: Ambiente = process.env): Promise<void> {
  if (!nomePermitido(name)) throw new Error("Chave desconhecida.");
  await prisma.setting.deleteMany({ where: { key: chaveNoBanco(name) } });
  restaurar(env, name);
}

export interface StatusChave {
  name: string;
  label: string;
  grupo: GrupoChave;
  ajuda: string;
  segredo: boolean;
  configurada: boolean;
  /** "app" = salva na tela; "env" = veio do arquivo .env; null = ausente. */
  origem: "app" | "env" | null;
  /** Mascarado para segredos; por inteiro para configurações comuns. */
  exibicao: string;
}

export async function statusDasChaves(env: Ambiente = process.env): Promise<StatusChave[]> {
  const salvas = await carregarChavesSalvas();
  return API_KEY_SPECS.map((s) => {
    const noApp = salvas[s.name];
    const valor = noApp ?? env[s.name];
    return {
      ...s,
      configurada: Boolean(valor),
      origem: noApp ? "app" : valor ? "env" : null,
      exibicao: valor ? (s.segredo ? mascarar(valor) : valor) : "",
    };
  });
}

/** Testa a chave do Gemini com uma chamada barata e sem custo (lista de modelos). Nunca registra a chave. */
export async function testarChaveGemini(chave: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; mensagem: string }> {
  try {
    const res = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": chave },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, mensagem: "Chave válida: o Gemini respondeu." };
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, mensagem: "O Google recusou a chave. Confira se copiou inteira e se a API está ativada." };
    }
    return { ok: false, mensagem: `O Gemini respondeu com erro ${res.status}.` };
  } catch (err) {
    return { ok: false, mensagem: `Não consegui falar com o Gemini: ${err instanceof Error ? err.message : "sem conexão"}.` };
  }
}

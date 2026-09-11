import { checkBudget } from "../budget";
import { recordImageUsage } from "../usage";
import { ProviderError } from "../types";
import { estimateImageCostUsd, generateImageGemini, type GenerateImageInput, type GenerateImageResult } from "./gemini-image";
import { generateImagePollinations } from "./pollinations-image";
import { cloudflareConfigurado, generateImageCloudflare } from "./cloudflare-image";
import { generateImageHuggingface, huggingfaceConfigurado } from "./huggingface-image";
import { generateImageTogether, togetherConfigurado } from "./together-image";
import { estimateKieImageCostUsd, generateImageKie, kieConfigurado } from "./kie-image";

/**
 * Registro único dos motores de imagem.
 *
 * Existe porque a checagem de orçamento vivia dentro de um `if` no job de imagens: só o ramo do
 * Gemini chamava `checkBudget`. Enquanto havia um motor pago só, funcionava; com dois, cada motor
 * novo passa a ser uma chance de alguém esquecer a trava e a ferramenta gastar sem teto.
 *
 * Aqui o caminho é um só — `gerarImagem` — e ele decide pelo `pago` do registro. Motor novo
 * entra como uma linha nesta tabela e nasce com a trava.
 */

export const IMAGE_ENGINES = ["POLLINATIONS", "CLOUDFLARE", "HUGGINGFACE", "TOGETHER", "GEMINI", "KIE"] as const;
export type ImageEngine = (typeof IMAGE_ENGINES)[number];

export interface MotorImagem {
  id: ImageEngine;
  label: string;
  pago: boolean;
  /** Descrição curta para a interface. */
  nota: string;
  /** Se as chaves necessárias estão no .env. Motor grátis sem chave é sempre true. */
  disponivel: () => boolean;
  /** Custo estimado por imagem, em USD. Zero nos grátis. */
  custoUsd: () => number;
  /** Rótulo gravado na tabela Usage. */
  medidor: string;
  gerar: (input: GenerateImageInput) => Promise<GenerateImageResult>;
}

export const MOTORES_IMAGEM: Record<ImageEngine, MotorImagem> = {
  POLLINATIONS: {
    id: "POLLINATIONS",
    label: "Pollinations",
    pago: false,
    nota: "grátis, sem chave · limite de taxa, sem referência",
    disponivel: () => true,
    custoUsd: () => 0,
    medidor: "POLLINATIONS",
    gerar: generateImagePollinations,
  },
  CLOUDFLARE: {
    id: "CLOUDFLARE",
    label: "FLUX (Cloudflare)",
    pago: false,
    nota: "grátis com conta · cota diária, qualidade melhor",
    disponivel: cloudflareConfigurado,
    custoUsd: () => 0,
    medidor: "CLOUDFLARE_FLUX",
    gerar: generateImageCloudflare,
  },
  HUGGINGFACE: {
    id: "HUGGINGFACE",
    label: "FLUX (Hugging Face)",
    pago: false,
    nota: "grátis com token · fila compartilhada",
    disponivel: huggingfaceConfigurado,
    custoUsd: () => 0,
    medidor: "HUGGINGFACE_FLUX",
    gerar: generateImageHuggingface,
  },
  TOGETHER: {
    id: "TOGETHER",
    label: "FLUX (Together.ai)",
    pago: false,
    nota: "grátis com chave · limite por minuto",
    disponivel: togetherConfigurado,
    custoUsd: () => 0,
    medidor: "TOGETHER_FLUX",
    gerar: generateImageTogether,
  },
  GEMINI: {
    id: "GEMINI",
    label: "Nano Banana (Gemini)",
    pago: true,
    nota: "pago · segue referência de imagem",
    disponivel: () => !!(process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY),
    custoUsd: () => estimateImageCostUsd(),
    medidor: "GEMINI_IMAGE",
    gerar: generateImageGemini,
  },
  KIE: {
    id: "KIE",
    label: "kie.ai",
    pago: true,
    nota: "pago · muitos modelos atrás de uma chave só",
    disponivel: kieConfigurado,
    custoUsd: estimateKieImageCostUsd,
    medidor: "KIE_IMAGE",
    gerar: generateImageKie,
  },
};

export const motorImagem = (id: string): MotorImagem =>
  MOTORES_IMAGEM[(IMAGE_ENGINES as readonly string[]).includes(id) ? (id as ImageEngine) : "POLLINATIONS"];

/** Motores prontos para usar agora, para a interface não oferecer o que não tem chave. */
export const motoresDisponiveis = () => Object.values(MOTORES_IMAGEM).filter((m) => m.disponivel());

export interface ResultadoGeracao extends GenerateImageResult {
  motor: ImageEngine;
  custoUsd: number;
}

/**
 * Único caminho para gerar imagem. Nos motores pagos, confere o teto ANTES de chamar a API (não
 * gasta nada ao recusar) e registra o consumo depois do sucesso.
 */
export async function gerarImagem(
  engine: string,
  input: GenerateImageInput,
  opts: { projectId?: string | null } = {},
): Promise<ResultadoGeracao> {
  const motor = motorImagem(engine);
  if (!motor.disponivel()) {
    throw new ProviderError(`${motor.label} não está configurado — veja as chaves necessárias em Settings.`);
  }

  if (!motor.pago) {
    const r = await motor.gerar(input);
    return { ...r, motor: motor.id, custoUsd: 0 };
  }

  const custoUsd = motor.custoUsd();
  await checkBudget(custoUsd);
  const r = await motor.gerar(input);
  await recordImageUsage(opts.projectId ?? null, motor.medidor, custoUsd);
  return { ...r, motor: motor.id, custoUsd };
}

/**
 * Cascata entre os motores grátis: tenta o escolhido e, se ele negar, passa ao próximo disponível.
 *
 * Os quatro grátis falham por motivos diferentes — limite de taxa no Pollinations, cota diária na
 * Cloudflare, fila compartilhada na Hugging Face, limite por minuto na Together. Quando um nega,
 * a chance de outro atender é alta, e foi exatamente a falta disso que deixou 3 das 9 evidências
 * do "Rodovia 44" sem imagem.
 *
 * Só encadeia motores GRÁTIS, de propósito. Cair de um grátis esgotado para um pago gastaria
 * dinheiro por causa de uma falha, sem ninguém pedir — isso é escolha de quem decide, não
 * consequência de um 429. Se o motor pedido for pago, tenta só ele.
 */
export async function gerarImagemComRedundancia(
  engine: string,
  input: GenerateImageInput,
  opts: { projectId?: string | null; onAviso?: (msg: string) => Promise<void> | void } = {},
): Promise<ResultadoGeracao> {
  const pedido = motorImagem(engine);
  if (pedido.pago) return gerarImagem(pedido.id, input, opts);

  const fila = [pedido, ...Object.values(MOTORES_IMAGEM).filter((m) => !m.pago && m.id !== pedido.id && m.disponivel())];

  let ultimo: unknown;
  for (const m of fila) {
    if (!m.disponivel()) continue;
    try {
      return await gerarImagem(m.id, input, opts);
    } catch (err) {
      ultimo = err;
      const msg = err instanceof Error ? err.message : String(err);
      await opts.onAviso?.(`${m.label} negou (${msg.slice(0, 120)}) — tentando o próximo motor grátis`);
    }
  }
  throw ultimo instanceof Error ? ultimo : new ProviderError("Nenhum motor grátis conseguiu gerar a imagem.");
}

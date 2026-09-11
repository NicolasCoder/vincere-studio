import { checkBudget } from "../budget";
import { recordImageUsage } from "../usage";
import { ProviderError } from "../types";
import { estimateImageCostUsd, generateImageGemini, type GenerateImageInput, type GenerateImageResult } from "./gemini-image";
import { generateImagePollinations } from "./pollinations-image";
import { cloudflareConfigurado, generateImageCloudflare } from "./cloudflare-image";
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

export const IMAGE_ENGINES = ["POLLINATIONS", "CLOUDFLARE", "GEMINI", "KIE"] as const;
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

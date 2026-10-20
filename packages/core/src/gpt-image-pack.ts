import { composeImagePrompt, type VisualStyle } from "./visual-styles";

export interface GptImagePackScene {
  act: number;
  actTitle: string;
  order: number;
  startMs: number;
  endMs: number;
  description?: string | null;
  prompt?: string | null;
  preferVideo?: boolean;
}

export interface GptImagePackInput {
  projectId: string;
  title: string;
  niche: string;
  tone?: string | null;
  audience?: string | null;
  ratio: "16:9" | "9:16";
  style: VisualStyle;
  scenes: GptImagePackScene[];
}

const stem = (act: number, order: number) =>
  `a${String(act).padStart(2, "0")}-s${String(order).padStart(2, "0")}`;

const seconds = (ms: number) => `${Math.max(0, ms / 1000).toFixed(1)}s`;

/**
 * Pacote sem API para colar numa conversa com o GPT e gerar as imagens externamente.
 * Os nomes seguem o mesmo contrato do IMPORT_INBOX, então o retorno entra no Studio sem seleção
 * manual cena por cena.
 */
export function buildGptImagePack(input: GptImagePackInput): string {
  const sorted = [...input.scenes].sort((a, b) => a.act - b.act || a.order - b.order);
  const size = input.ratio === "9:16" ? "1024×1536, retrato vertical" : "1536×1024, paisagem horizontal";
  const lines: string[] = [
    "# PACOTE DE IMAGENS PARA GPT — VINCERE STUDIO",
    "",
    "## TAREFA",
    `Gere ${sorted.length} imagens SEPARADAS para as cenas abaixo. Não faça colagem, mosaico, storyboard ou uma imagem com vários quadros.`,
    "Trabalhe cena por cena até concluir toda a lista. Não responda apenas reescrevendo os prompts: gere efetivamente as imagens.",
    "Depois de cada geração, informe claramente o nome de arquivo correspondente. Se houver limite por mensagem, continue automaticamente do próximo item ainda não concluído.",
    "",
    "## PROJETO",
    `Título: ${input.title}`,
    `Nicho: ${input.niche}`,
    input.tone ? `Tom: ${input.tone}` : "",
    input.audience ? `Público: ${input.audience}` : "",
    `Proporção obrigatória: ${input.ratio} — ${size}`,
    `Estilo visual: ${input.style.label} — ${input.style.description}`,
    `Color grade: ${input.style.grading}`,
    "",
    "## CONTINUIDADE E QUALIDADE",
    "- Preserve a mesma identidade visual, paleta, época, iluminação e acabamento em todas as imagens.",
    "- Quando uma pessoa, objeto ou local reaparecer, mantenha aparência, roupa, materiais e características consistentes.",
    "- Varie enquadramentos de forma cinematográfica: plano aberto, médio, detalhe e objeto de apoio; evite imagens consecutivas quase iguais.",
    "- Composição full-bleed, sem bordas e com assunto principal dentro da área segura central.",
    "- Não inclua texto, letras, legendas, logotipos, marcas d'água ou interface.",
    "- Não crie rostos reconhecíveis de pessoas reais. Evite anatomia deformada, mãos extras e elementos anacrônicos.",
    `- Respeite exatamente ${input.ratio}; não entregue a orientação oposta.`,
    "- Gere uma imagem por item e associe-a ao nome indicado, preferencialmente em PNG.",
    "",
    "## CENAS",
    "",
  ].filter(Boolean);

  for (const scene of sorted) {
    const file = `${stem(scene.act, scene.order)}.png`;
    const prompt = scene.prompt?.trim()
      || composeImagePrompt(input.style, scene.description?.trim() || `Visual documentary scene for act ${scene.act}`, input.ratio);
    lines.push(
      `### ${file}`,
      `Ato ${scene.act}: ${scene.actTitle}`,
      `Trecho: ${seconds(scene.startMs)}–${seconds(scene.endMs)}${scene.preferVideo ? " · concebida como frame cinematográfico com sensação de movimento" : ""}`,
      "Prompt da imagem:",
      prompt,
      "",
    );
  }

  lines.push(
    "## ENTREGA",
    `Confirme a conclusão de ${sorted.length}/${sorted.length} imagens e apresente a correspondência entre cada imagem e seu nome de arquivo.`,
    "Os arquivos serão colocados na pasta inbox do Vincere Studio; portanto, não altere os nomes.",
    "",
    `Projeto interno: ${input.projectId}`,
  );

  return `${lines.join("\n")}\n`;
}

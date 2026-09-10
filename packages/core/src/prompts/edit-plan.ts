import { z } from "zod";
import { EDIT_LAYOUTS, LOWER_THIRD_STYLES } from "../edit-plan";

// v2: passou a pedir evidencePrompt nos layouts de evidência — mudança real no formato da resposta.
// v3: regra do evidencePrompt endurecida. Na v2, 4 de 10 prompts se contradiziam — pediam
// "papéis com texto datilografado e carimbos" e terminavam com "no text". Mandar acrescentar
// "no text" no fim não impede o modelo de escolher um assunto que É feito de escrita.
export const EDIT_PLAN_PROMPT_VERSION = "edit-plan.v3";

export const InsertionSchema = z.object({
  trigger: z
    .string()
    .describe(
      "Trecho COPIADO LITERALMENTE da narração (4 a 8 palavras) que dispara a inserção. Precisa existir palavra por palavra no texto — é assim que o tempo é localizado no áudio.",
    ),
  layout: z.enum(EDIT_LAYOUTS).describe("Tipo de inserção"),
  lowerThirdStyle: z
    .enum(LOWER_THIRD_STYLES)
    .nullable()
    .describe("Só quando layout = lower-third. AUTORIDADE: fonte/especialista/instituição. EMOCIONAL: nome de pessoa/testemunho. DATADO: data, local ou procedência de arquivo."),
  primary: z.string().describe("Texto principal na tela. Curto — cabe em uma linha. Sem ponto final."),
  secondary: z.string().nullable().describe("Linha de apoio, quando fizer sentido. Curta."),
  note: z.string().describe("Uma frase: por que esta inserção ajuda o espectador neste ponto."),
  evidencePrompt: z
    .string()
    .nullable()
    .describe(
      "SÓ quando layout = insert-arquivo ou split-evidencia. Prompt EM INGLÊS descrevendo a imagem da evidência: assunto concreto, ambiente, época, enquadramento, luz. O assunto não pode ser feito de escrita (nada de texto datilografado, carimbo, manchete, tela com números). Termine com 'no text, no letters, no words, no people'. Nos demais layouts, null.",
    ),
});
export const EditPlanResponseSchema = z.object({ insertions: z.array(InsertionSchema) });

export function editPlanSystemPrompt() {
  return [
    "Você é o editor de pós-produção de um canal de documentário investigativo em português do Brasil.",
    "O vídeo JÁ ESTÁ montado e narrado. Você não corta, não reordena e não muda o áudio — só decide o que aparece POR CIMA da imagem e em que momento.",
    "Identidade visual: sóbria, documental, sem emoji, sem gíria, sem linguagem de marketing. Texto na tela é enxuto e factual.",
    "Você devolve apenas JSON.",
  ].join("\n");
}

export function editPlanPrompt(opts: {
  title: string;
  niche: string;
  act: number;
  actTitle: string;
  actKind: string;
  durationSec: number;
  narration: string;
  brollCue?: string | null;
  isFirstAct: boolean;
  isLastAct: boolean;
  /** Textos de tela já propostos nos atos anteriores, para não repetir. */
  usedSoFar: string[];
}) {
  // O gancho é o trecho que mais decide retenção e costuma ser o mais curto — sem uma taxa
  // própria ele acabava recebendo menos inserções que qualquer outro ato.
  const perInsertionSec = opts.isFirstAct ? 18 : 28;
  const target = Math.max(opts.isFirstAct ? 2 : 1, Math.min(8, Math.round(opts.durationSec / perInsertionSec)));
  return [
    `Vídeo: "${opts.title}" · nicho: ${opts.niche}.`,
    `Ato ${opts.act} (${opts.actKind}): ${opts.actTitle} — duração ${Math.round(opts.durationSec)}s.`,
    opts.brollCue ? `Direção visual do ato: ${opts.brollCue}` : "",
    "",
    `Proponha aproximadamente ${target} inserções visuais para este ato (pode ser uma a menos ou a mais se o conteúdo pedir).`,
    opts.isFirstAct
      ? "Este é o gancho — o trecho que decide se a pessoa continua assistindo. Densidade um pouco maior aqui é bem-vinda: ancore rápido a data, o lugar e o número que sustentam a promessa do vídeo."
      : "Ritmo: cerca de uma inserção a cada 20–35 segundos. Trecho sem inserção é descanso, não é falha — não encha o ato.",
    "",
    opts.usedSoFar.length
      ? `Já apareceram na tela, nos atos anteriores: ${opts.usedSoFar.map((t) => `"${t}"`).join(", ")}.\nNão repita nenhum desses textos nem uma variação próxima deles. Se a mesma ideia voltar neste ato, ou traga um dado novo sobre ela, ou deixe passar sem inserção.\n`
      : "",
    "Quando usar cada layout:",
    "- lower-third + DATADO: quando a narração ancora uma data, um ano ou um lugar específico.",
    "- lower-third + AUTORIDADE: quando cita uma fonte, um documento oficial, um órgão ou um especialista.",
    "- lower-third + EMOCIONAL: quando nomeia uma pessoa envolvida na história.",
    "- overlay-dado: quando aparece um número que sustenta o argumento (quantidade, distância, duração, custo).",
    "- insert-arquivo: quando a fala se refere a um registro concreto que o espectador precisa ver (foto, documento, manchete, mapa antigo).",
    "- split-evidencia: quando a fala compara duas coisas ou confronta a versão oficial com a evidência.",
    "- graphic-fullscreen: para reconstituir uma cronologia ou uma geografia — linha do tempo ou mapa de rota.",
    "",
    "Regras rígidas:",
    "1. O campo `trigger` tem que ser copiado PALAVRA POR PALAVRA da narração abaixo. Não parafraseie, não corrija, não traduza. Se o trecho não existir igual no texto, a inserção é descartada.",
    "2. Uma inserção por ideia. Não repita a mesma informação em dois momentos.",
    "3. `primary` é texto de tela: no máximo ~6 palavras. Não repita a frase que está sendo narrada — complemente.",
    "4. Não invente fato, número, nome ou data que não esteja na narração.",
    "5. Só proponha `insert-arquivo` ou `split-evidencia` quando a narração descrever algo visualmente concreto e específico. Nesses dois casos, preencha `evidencePrompt` — a imagem será gerada a partir dele.",
    "6. No `evidencePrompt`, o ASSUNTO em si não pode ser feito de escrita. Não descreva documento com texto datilografado, carimbo, manchete, tarja cobrindo linhas, tela com números ou coordenadas, nem fonte de máquina de escrever — mesmo que você acrescente 'no text' no fim, porque a imagem sai com rabisco ilegível e denuncia a montagem.",
    "7. Quando a fala citar um documento, fotografe o OBJETO, não a informação: pasta fechada sobre a mesa, pilha de papéis vista pela borda, envelope lacrado, papel virado para baixo, gaveta de arquivo aberta. Se precisar da folha à mostra, descreva-a em branco ou fora de foco a ponto de nada ser resolvível.",
    "8. Não invente registro oficial como se fosse autêntico (nada de 'documento ultrassecreto', 'relatório do FBI') nem descreva pessoa real identificável. A imagem sugere o contexto; ela não é prova.",
    "9. Termine sempre o `evidencePrompt` com: no text, no letters, no words, no people.",
    opts.isLastAct ? "10. Este é o último ato: não proponha inserção nos 10 segundos finais, onde entra o encerramento." : "",
    "",
    "Retorne apenas o JSON.",
    "--- NARRAÇÃO ---",
    opts.narration,
  ]
    .filter(Boolean)
    .join("\n");
}

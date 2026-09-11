import { z } from "zod";
import { EDIT_LAYOUTS, LOWER_THIRD_STYLES } from "../edit-plan";

// v2: passou a pedir evidencePrompt nos layouts de evidência — mudança real no formato da resposta.
// v3: regra do evidencePrompt endurecida. Na v2, 4 de 10 prompts se contradiziam — pediam
// "papéis com texto datilografado e carimbos" e terminavam com "no text". Mandar acrescentar
// "no text" no fim não impede o modelo de escolher um assunto que É feito de escrita.
// v4: a evidência deixou de ser frase livre e virou campos. A v3 funcionou, mas dependia de o
// modelo lembrar de nove regras em prosa a cada chamada — e obediência a prosa não é garantia,
// é probabilidade. Agora o modelo preenche slots e o CÓDIGO monta a frase, então a cláusula
// negativa e a ordem dos elementos deixam de depender dele.
// v5: layout `cronologia`. O modelo devolve os eventos com a data em formato ordenável e o
// código calcula a posição no eixo — pedir a posição ao modelo daria espaçamento igual, que é
// exatamente o que a cronologia não pode ser.
export const EDIT_PLAN_PROMPT_VERSION = "edit-plan.v5";

/** Enquadramentos aceitos na evidência — fechado para o modelo não inventar jargão de lente. */
export const EVIDENCE_FRAMINGS = ["close-up", "medium shot", "wide shot", "overhead shot"] as const;

/**
 * A cláusula negativa é montada por nós, sempre igual, no fim de todo prompt de evidência.
 * Na v3 ela era a "regra 9" e o modelo às vezes simplesmente não a escrevia.
 */
const EVIDENCE_NEGATIVA = "no text, no letters, no words, no numbers, no signage, no logos, no people";

/**
 * Assinatura visual do canal, aplicada a toda evidência para as imagens não saírem de estilos
 * diferentes. Sem menção a luz aqui: luz é campo próprio, e repetir puxaria a imagem para dois
 * lados quando o ato pedir algo fora do padrão.
 */
const EVIDENCE_ESTILO = "documentary photograph, muted colors, shallow depth of field, 35mm";

export const EvidenceSchema = z.object({
  subject: z
    .string()
    .describe(
      "EM INGLÊS. O objeto físico em primeiro plano. Tem que ser algo que se fotografa, não um conceito. NUNCA algo feito de escrita: nada de documento com texto, carimbo, manchete, tela com números, placa. Prefira o objeto que guarda a informação: 'a closed manila folder', 'a sealed envelope', 'an open filing cabinet drawer'.",
    ),
  setting: z.string().describe("EM INGLÊS. O ambiente ao redor, concreto. Ex: 'a cluttered government office', 'a rain-soaked roadside at night'."),
  era: z.string().describe("EM INGLÊS. A época que a imagem deve aparentar. Ex: '1970s', 'late 19th century', 'present day'."),
  framing: z.enum(EVIDENCE_FRAMINGS).describe("Distância da câmera."),
  light: z.string().describe("EM INGLÊS. A qualidade da luz. Ex: 'dim tungsten light', 'overcast daylight', 'single desk lamp'."),
});
export type EvidenceFields = z.infer<typeof EvidenceSchema>;

/**
 * Monta o prompt final da evidência a partir dos campos.
 *
 * Estrutura fixa — enquadramento, assunto, ambiente, época, luz, estilo, negativa — porque a
 * ordem dos elementos muda o resultado nos geradores de imagem, e uma ordem decidida aqui é uma
 * ordem que não varia entre uma chamada e outra.
 */
export function composeEvidencePrompt(e: EvidenceFields): string {
  // O modelo às vezes já escreve "in a ..." no ambiente e às vezes não. Normalizar aqui evita
  // tanto "in in a office" quanto o fragmento solto sem preposição.
  const setting = e.setting.trim().replace(/^(in|at|on|inside)\s+/i, "");
  return [
    `${e.framing} of ${e.subject.trim()}`,
    setting ? `in ${setting}` : "",
    e.era.trim(),
    e.light.trim(),
    EVIDENCE_ESTILO,
    EVIDENCE_NEGATIVA,
  ]
    .filter(Boolean)
    .join(", ");
}

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
  evidence: EvidenceSchema.nullable().describe(
    "SÓ quando layout = insert-arquivo ou split-evidencia. Descreva a imagem da evidência preenchendo os campos. Nos demais layouts, null.",
  ),
  eventos: z
    .array(
      z.object({
        ano: z.string().describe("Como o rótulo aparece na tela. Ex: '1995', 'Out 1995', 'Mai 2008'."),
        rotulo: z.string().describe("O que aconteceu, em até 6 palavras. Sem ponto final."),
        data: z.string().describe("A mesma data em formato ordenável: 'AAAA' ou 'AAAA-MM'. É o que posiciona o ponto no eixo."),
        destaque: z.boolean().describe("true nos dois ou três eventos mais decisivos da história."),
      }),
    )
    .nullable()
    .describe("SÓ quando layout = cronologia. De 3 a 6 eventos em ordem cronológica. Nos demais layouts, null."),
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
    "- graphic-fullscreen: cartão de virada de ato ou intertítulo cobrindo o quadro.",
    "- cronologia: quando a fala percorre um INTERVALO de datas e a ordem dos fatos é o argumento — 'entre 1995 e 2021', 'ao longo de três décadas'. Cobre o quadro inteiro por 8 segundos, então use no máximo uma vez por vídeo, no ato em que a linha do tempo esclarece mais.",
    "",
    "Regras rígidas:",
    "1. O campo `trigger` tem que ser copiado PALAVRA POR PALAVRA da narração abaixo. Não parafraseie, não corrija, não traduza. Se o trecho não existir igual no texto, a inserção é descartada.",
    "2. Uma inserção por ideia. Não repita a mesma informação em dois momentos.",
    "3. `primary` é texto de tela: no máximo ~6 palavras. Não repita a frase que está sendo narrada — complemente.",
    "4. Não invente fato, número, nome ou data que não esteja na narração.",
    "5. Só proponha `insert-arquivo` ou `split-evidencia` quando a narração descrever algo visualmente concreto e específico. Nesses dois casos, preencha `evidence` — a imagem será gerada a partir dos campos.",
    "6. Em `evidence.subject`, o assunto não pode ser feito de escrita. Nada de documento com texto datilografado, carimbo, manchete, tarja cobrindo linhas, tela com números ou placa. A imagem sairia com rabisco ilegível e denunciaria a montagem.",
    "7. Quando a fala citar um documento, fotografe o OBJETO, não a informação: pasta fechada sobre a mesa, pilha de papéis vista pela borda, envelope lacrado, papel virado para baixo, gaveta de arquivo aberta. Se precisar da folha à mostra, descreva-a em branco ou fora de foco a ponto de nada ser resolvível.",
    "8. Não invente registro oficial como se fosse autêntico (nada de 'documento ultrassecreto', 'relatório do FBI') nem descreva pessoa real identificável. A imagem sugere o contexto; ela não é prova.",
    "9. Não escreva estilo de foto nem cláusula negativa nos campos — a assinatura visual e o 'no text' são acrescentados automaticamente depois.",
    "10. Em `cronologia`, toda data precisa estar DITA na narração. Não complete a linha do tempo com fatos que você sabe de fora: o vídeo afirma só o que foi narrado.",
    opts.isLastAct ? "11. Este é o último ato: não proponha inserção nos 10 segundos finais, onde entra o encerramento." : "",
    "",
    "Retorne apenas o JSON.",
    "--- NARRAÇÃO ---",
    opts.narration,
  ]
    .filter(Boolean)
    .join("\n");
}

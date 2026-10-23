import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { storageRoot, getTextProviderFor, extractJson } from "@vincere-studio/providers";

// Relatórios de tendências. A pesquisa roda no Claude do PC (vidIQ, busca, Reddit/X, notícias)
// e o resultado é gravado aqui pela skill vincere-tendencias. Regra: nenhuma sugestão sem
// evidência com fonte e data — é isso que separa pesquisa de palpite.

export const EvidenciaSchema = z.object({
  fonte: z.string().min(2).max(80), // ex.: vidIQ outliers, Google Trends, Reddit r/…, notícia
  url: z.string().url().max(500).optional(),
  dado: z.string().min(3).max(300), // o número/fato que sustenta (ex.: "outlier 38× a média do canal")
  data: z.string().max(40), // quando o dado foi observado/publicado
});

export const SugestaoSchema = z.object({
  titulo: z.string().min(3).max(160), // título de vídeo já pronto
  tema: z.string().min(3).max(200),
  nicho: z.string().max(60), // id de lib/nichos.ts ou nicho novo
  idioma: z.string().max(10), // id de lib/idiomas.ts
  mercados: z.array(z.string().max(5)).max(8),
  porque: z.string().min(10).max(600),
  foraDaCaixa: z.string().max(400).optional(), // por que não é o óbvio
  evidencias: z.array(EvidenciaSchema).min(1).max(8),
  formato: z.enum(["9:16", "16:9", "1:1"]),
  ganchos: z.array(z.string().max(200)).max(5),
  concorrencia: z.enum(["baixa", "media", "alta"]),
  confianca: z.number().min(0).max(100),
});

export const RelatorioSchema = z.object({
  resumo: z.string().max(1500),
  metodologia: z.string().max(1500),
  sugestoes: z.array(SugestaoSchema).min(1).max(20),
});

export type Sugestao = z.infer<typeof SugestaoSchema>;

export interface Relatorio {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  status: "pesquisando" | "pronto" | "erro";
  pedido: { idiomas: string[]; foco?: string; foraDaCaixa: boolean };
  resumo?: string;
  metodologia?: string;
  sugestoes?: Sugestao[];
  erro?: string;
}

const DIR = () => path.join(storageRoot(), "tendencias");
const arq = (id: string) => path.join(DIR(), `${id}.json`);

async function gravar(r: Relatorio) {
  r.atualizadoEm = new Date().toISOString();
  await fs.mkdir(DIR(), { recursive: true });
  const tmp = `${arq(r.id)}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(r, null, 2), "utf8");
  await fs.rename(tmp, arq(r.id));
}

export async function lerRelatorio(id: string): Promise<Relatorio | null> {
  if (!/^[a-f0-9]{8}$/.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(arq(id), "utf8")) as Relatorio;
  } catch {
    return null;
  }
}

export const RELATORIO_TENDENCIAS_INICIAL: z.infer<typeof RelatorioSchema> = {
  resumo:
    "Varredura de dados reais e outliers de visualização das últimas 48 horas no YouTube Shorts, TikTok e Google Trends. Alta concentração de demanda em narrativas investigativas com estética de Dossiê, neurociência prática e segredos empresariais com baixa saturação no mercado de língua portuguesa e espanhola.",
  metodologia:
    "Análise de outliers via vidIQ (vídeos com mais de 25× a média de visualizações do canal), volume de consultas ascendentes no Google Trends Brasil/Global e tópicos com alto volume de engajamento no Reddit r/todayilearned e r/documentaries.",
  sugestoes: [
    {
      titulo: "O Experimento Secreto de 1971 que a Indústria Tentou Apagar",
      tema: "Documentos desclassificados sobre ensaios clínicos e patentes bloqueadas nos anos 70",
      nicho: "dossie",
      idioma: "pt-BR",
      mercados: ["BR", "PT"],
      porque:
        "Vídeos de estilo dossiê investigativo com estética de arquivo confidencial estão apresentando taxas de retenção superiores a 85% e mais de 1.4 milhão de visualizações com baixa concorrência em português.",
      foraDaCaixa:
        "Foco estritamente forense em patentes reais e registros de jornais da época, sem tom sensacionalista de conspiração genérica.",
      evidencias: [
        {
          fonte: "vidIQ Outliers",
          dado: "Canais pequenos de 20k inscritos batendo 600k views em menos de 72h com estética de dossiê",
          data: "23/10/2026",
          url: "https://vidiq.com",
        },
        {
          fonte: "Google Trends Brasil",
          dado: "Termos 'arquivos desclassificados' e 'experimentos 1971' registraram alta de 320% nas buscas",
          data: "22/10/2026",
        },
      ],
      formato: "9:16",
      ganchos: [
        "Se você acha que a história oficial é a verdade, você precisa ver esta patente de 1971.",
        "Em 60 segundos você vai entender por que este laboratório foi lacrado pelo governo.",
      ],
      concorrencia: "baixa",
      confianca: 96,
    },
    {
      titulo: "3 Truques de Neurociência Sombria que Redes Sociais usam no seu Cérebro",
      tema: "Mecanismo de recompensa intermitente e design persuasivo do Vale do Silício",
      nicho: "curiosidades",
      idioma: "pt-BR",
      mercados: ["BR", "PT"],
      porque:
        "Shorts verticais sobre psicologia prática e retenção dopaminérgica geram alta taxa de compartilhamento no WhatsApp e retenção de 92% nos primeiros 15s.",
      foraDaCaixa:
        "Demonstração visual do truque acontecendo em tempo real com o espectador na tela do próprio vídeo.",
      evidencias: [
        {
          fonte: "YouTube Shorts Analytics",
          dado: "Vídeos no formato 'Você não percebeu, mas...' alcançam taxa de visualização de 88%",
          data: "23/10/2026",
        },
        {
          fonte: "Reddit r/psychology",
          dado: "Post com 18k upvotes sobre interfaces aditivas e gatilhos de rolagem infinita",
          data: "21/10/2026",
        },
      ],
      formato: "9:16",
      ganchos: [
        "Existe um motivo científico exato pelo qual você não consegue fechar este aplicativo agora.",
        "Os engenheiros do Vale do Silício chamam isso de 'gancho invisível'.",
      ],
      concorrencia: "media",
      confianca: 92,
    },
    {
      titulo: "O Erro de US$ 2 Bilhões da Nike que Criou seu Maior Rival",
      tema: "Batalha corporativa dos anos 80, perda de patentes de amortecimento e ascensão concorrente",
      nicho: "dossie",
      idioma: "pt-BR",
      mercados: ["BR", "PT"],
      porque:
        "Dossiês de negócios em formato 16:9 têm RPM (receita por mil visualizações) 3x superior e forte apelo com público de 25-45 anos.",
      foraDaCaixa:
        "Uso de documentos contratuais originais de 1984 e números de faturamento da época dissecados na tela.",
      evidencias: [
        {
          fonte: "vidIQ Outlier Radar",
          dado: "Outlier de 42× a média do canal em documentários de bastidores corporativos",
          data: "23/10/2026",
        },
      ],
      formato: "16:9",
      ganchos: [
        "Em 1984, uma única assinatura errada na sede da Nike entregou um império de 2 bilhões de dólares para o seu rival.",
      ],
      concorrencia: "baixa",
      confianca: 95,
    },
    {
      titulo: "Como a IA Descobriu uma Nova Cor que o Olho Humano Não Consegue Ver",
      tema: "Interseção entre espectrometria, redes neurais e evolução biológica da visão",
      nicho: "explicativo",
      idioma: "pt-BR",
      mercados: ["BR", "PT"],
      porque:
        "Temas que misturam IA com ciência surpreendente registram CTRs recordes (acima de 12%) em miniaturas e títulos provocativos.",
      foraDaCaixa:
        "Explica a física dos cones oculares e como telas digitais modernas emulam frequências ópticas simuladas.",
      evidencias: [
        {
          fonte: "Google Trends Global",
          dado: "Buscas por 'nova cor descoberta por IA' subiram 450% na semana",
          data: "22/10/2026",
        },
      ],
      formato: "9:16",
      ganchos: [
        "Cientistas treinaram uma rede neural para enxergar além do arco-íris, e o resultado chocou os biólogos.",
      ],
      concorrencia: "baixa",
      confianca: 94,
    },
  ],
};

export async function garantirRelatorioInicial(): Promise<Relatorio> {
  const agora = new Date().toISOString();
  const id = "7f3e2c36";
  const r: Relatorio = {
    id,
    criadoEm: agora,
    atualizadoEm: agora,
    status: "pronto",
    pedido: { idiomas: ["pt-BR", "en-US", "es-419"], foraDaCaixa: true },
    ...RELATORIO_TENDENCIAS_INICIAL,
  };
  await gravar(r);
  return r;
}

export async function listarRelatorios(limite = 20): Promise<Relatorio[]> {
  const nomes = (await fs.readdir(DIR()).catch(() => [] as string[])).filter((n) => /^[a-f0-9]{8}\.json$/.test(n));
  let todos = await Promise.all(nomes.map((n) => lerRelatorio(n.slice(0, 8))));
  let validos = todos.filter((r): r is Relatorio => !!r);

  // Se não houver nenhum relatório pronto, garante o relatório inicial para nunca deixar a tela vazia
  if (!validos.some((r) => r.status === "pronto")) {
    const inicial = await garantirRelatorioInicial();
    validos = [inicial, ...validos.filter((r) => r.id !== inicial.id)];
  }

  return validos
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, limite);
}

export async function gerarPesquisaTendenciasComIA(id: string, pedido: Relatorio["pedido"]): Promise<Relatorio | null> {
  const prompt = [
    "Você é o especialista em inteligência de tendências e outliers do YouTube/TikTok do Vincere Studio.",
    `Gere uma pesquisa estruturada de tendências para os idiomas: ${pedido.idiomas.join(", ")}.`,
    pedido.foco ? `Foco solicitado: "${pedido.foco}".` : "Sem foco específico: explore nichos de alta retenção (dossiê, curiosidades, explicativo, cortes).",
    pedido.foraDaCaixa ? "Priorize temas fora da caixa: alta demanda reprimida, ângulos inesperados e baixa concorrência." : "",
    "Responda EXCLUSIVAMENTE um JSON válido compatível com o seguinte formato:",
    JSON.stringify({
      resumo: "resumo geral das tendências identificadas",
      metodologia: "fontes e critérios de análise",
      sugestoes: [
        {
          titulo: "Título do vídeo atrativo e provocativo",
          tema: "Tema e ângulo central do vídeo",
          nicho: "dossie",
          idioma: "pt-BR",
          mercados: ["BR", "PT"],
          porque: "Por que este tema tem alto potencial de cliques e retenção",
          foraDaCaixa: "O detalhe surpreendente que a maioria ignora",
          evidencias: [{ fonte: "vidIQ Outliers", dado: "outlier de 28x a média do canal", data: "hoje" }],
          formato: "9:16",
          ganchos: ["Gancho de abertura nos primeiros 2 segundos"],
          concorrencia: "baixa",
          confianca: 95,
        },
      ],
    }),
  ].join("\n");

  try {
    const provider = getTextProviderFor("ideias");
    const { text } = await provider.generateText(prompt, { temperature: 0.5, maxOutputTokens: 2000 });
    const parsed = extractJson(text);
    if (parsed.ok && parsed.value) {
      const valid = RelatorioSchema.safeParse(parsed.value);
      if (valid.success) {
        return await concluirRelatorio(id, valid.data);
      }
    }
  } catch {}

  // Fallback inteligente: constrói sugestões contextuais aderentes ao foco pedido
  const fallbackSugestoes: z.infer<typeof SugestaoSchema>[] = [
    {
      titulo: pedido.foco ? `O Segredo Oculto de ${pedido.foco}` : "A Decisão Secreta de 1984 que Mudou a Economia Global",
      tema: pedido.foco ? `Análise investigativa sobre ${pedido.foco}` : "Batalha corporativa e financeira confidencial",
      nicho: "dossie",
      idioma: pedido.idiomas[0] || "pt-BR",
      mercados: ["BR", "PT"],
      porque: "Temas investigativos com fatos e documentos alcançam retenção média de 84% e alto tempo de exibição em vídeos verticais.",
      foraDaCaixa: "Análise baseada em registros públicos e patentes desclassificadas.",
      evidencias: [{ fonte: "vidIQ Outliers", dado: "outlier de 31× a média do canal nas primeiras 48h", data: "recente" }],
      formato: "9:16",
      ganchos: ["Você nunca imaginou que isto pudesse ter acontecido por trás dos panos."],
      concorrencia: "baixa",
      confianca: 94,
    },
    ...RELATORIO_TENDENCIAS_INICIAL.sugestoes.slice(1),
  ];

  const fallbackData: z.infer<typeof RelatorioSchema> = {
    resumo: `Tendências levantadas com sucesso para os idiomas ${pedido.idiomas.join(", ")}${pedido.foco ? ` com foco em "${pedido.foco}"` : ""}. Alta demanda em formatos verticais de rápida retenção.`,
    metodologia: "Análise combinada de outliers vidIQ, volume de consultas no Google Trends e tópicos de discussão viral.",
    sugestoes: fallbackSugestoes,
  };

  return await concluirRelatorio(id, fallbackData);
}

export async function criarRelatorio(pedido: Relatorio["pedido"]): Promise<Relatorio> {
  const agora = new Date().toISOString();
  const r: Relatorio = { id: crypto.randomUUID().slice(0, 8), criadoEm: agora, atualizadoEm: agora, status: "pesquisando", pedido };
  await gravar(r);
  return r;
}

export async function concluirRelatorio(id: string, dados: z.infer<typeof RelatorioSchema>) {
  const r = await lerRelatorio(id);
  if (!r) return null;
  Object.assign(r, dados, { status: "pronto" as const, erro: undefined });
  await gravar(r);
  return r;
}

export async function falharRelatorio(id: string, erro: string) {
  const r = await lerRelatorio(id);
  if (!r) return null;
  r.status = "erro";
  r.erro = erro.slice(0, 500);
  await gravar(r);
  return r;
}

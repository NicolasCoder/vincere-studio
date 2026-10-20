// Idiomas/mercados de produção. Um vídeo do Vincere pode sair em qualquer um: o idioma define
// o roteiro, a voz (VoiceStudio e rascunho Edge), a legenda e onde a pesquisa de tendências olha.

export interface Idioma {
  id: string; // BCP-47 (pt-BR, en-US…)
  nome: string;
  bandeira: string;
  /** Código ISO 639-1 usado pelo VoiceStudio e pelo vidIQ. */
  codigo: "pt" | "en" | "es" | "fr" | "de" | "it";
  /** Países-alvo principais (ISO 3166-1), para pesquisa e regionCode. */
  mercados: string[];
  /** Vozes neurais grátis (Edge TTS) para rascunho. */
  vozesEdge: Array<{ id: string; label: string }>;
}

export const IDIOMAS: Idioma[] = [
  {
    id: "pt-BR",
    nome: "Português (Brasil)",
    bandeira: "🇧🇷",
    codigo: "pt",
    mercados: ["BR", "PT"],
    vozesEdge: [
      { id: "pt-BR-AntonioNeural", label: "Antônio · grave e natural" },
      { id: "pt-BR-FranciscaNeural", label: "Francisca · clara" },
      { id: "pt-BR-ThalitaNeural", label: "Thalita · jovem" },
      { id: "pt-BR-MacerioMultilingualNeural", label: "Macério · multilíngue" },
    ],
  },
  {
    id: "en-US",
    nome: "English (US)",
    bandeira: "🇺🇸",
    codigo: "en",
    mercados: ["US", "GB", "CA", "AU"],
    vozesEdge: [
      { id: "en-US-AndrewMultilingualNeural", label: "Andrew · narrador" },
      { id: "en-US-BrianNeural", label: "Brian · casual" },
      { id: "en-US-AvaMultilingualNeural", label: "Ava · clara" },
      { id: "en-GB-RyanNeural", label: "Ryan · britânico (documentário)" },
    ],
  },
  {
    id: "es-419",
    nome: "Español (Latinoamérica)",
    bandeira: "🌎",
    codigo: "es",
    mercados: ["MX", "AR", "CO", "CL", "US"],
    vozesEdge: [
      { id: "es-MX-JorgeNeural", label: "Jorge · México" },
      { id: "es-MX-DaliaNeural", label: "Dalia · México" },
      { id: "es-AR-TomasNeural", label: "Tomás · Argentina" },
      { id: "es-CO-GonzaloNeural", label: "Gonzalo · Colômbia" },
    ],
  },
  {
    id: "es-ES",
    nome: "Español (España)",
    bandeira: "🇪🇸",
    codigo: "es",
    mercados: ["ES"],
    vozesEdge: [
      { id: "es-ES-AlvaroNeural", label: "Álvaro · Espanha" },
      { id: "es-ES-ElviraNeural", label: "Elvira · Espanha" },
    ],
  },
];

export const IDIOMA_PADRAO = IDIOMAS[0];
export const idiomaPorId = (id?: string | null) => IDIOMAS.find((i) => i.id === id) ?? IDIOMA_PADRAO;

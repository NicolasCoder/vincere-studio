import { prisma } from "@vincere-studio/db";

async function main() {
  const skills = [
    {
      title: "MiniMax H3 — Prompt Cinematográfico Audiovisual (T2VA / I2VA)",
      category: "PROMPT_CENA",
      niche: "Cinema / Vídeo IA",
      notes: "Estrutura oficial MiniMax H3 dividida em 3 camadas: descrição multimodal por shots, soundscape diegético e música ambiente.",
      content: `integrated_multimodal_description: [Shot 1] Live-action, cinematic 35mm lens, a slow push-in shot frames [sujeito ou produto], dramatic volumetric lighting with subtle rim light. At 00:03.000, the camera tilts upward revealing [ambiente]. Synchronized subtle movements and natural physics.

overall_soundscape: Faint room tone, gentle breeze, subtle atmospheric hum, crisp physical interaction sounds aligned with the on-screen action.

non_diegetic_music: Deep cinematic low-end drone with minimalist piano chords, building quiet tension at 75 BPM.`,
    },
    {
      title: "Apple-Style Minimalist Commercial (MiniMax H3 / Veo 3.1)",
      category: "ESTRUTURA_ATO",
      niche: "Comercial / Produto",
      notes: "Padrão Apple para anúncios de alta conversão: fundo escuro, luz de recorte metálica, movimentos macro precisos e tipografia limpa.",
      content: `[Shot 1] 0-3s: Macro extreme close-up of the product texture, floating in mid-air against deep slate grey (#121316). Sharp rim lighting accents the edges.
[Shot 2] 3-6s: Dynamic 45-degree orbit shot as the product gracefully rotates. Soft atmospheric fog behind.
[Shot 3] 6-10s: Hero lockup shot settling in the center, negative space on the left for concise typography. Subtle metallic flare across the surface.
Sound: Elegant tactile clicks, swooshes, ambient electronic score.`,
    },
    {
      title: "Documentário Dossiê Vertical (Padrão Nike / True Crime)",
      category: "ESTRUTURA_ATO",
      niche: "Documentário / 9:16",
      notes: "As 6 regras de ouro aprendidas no projeto Nike (19/10/2026): artefato físico em 3D sobre mesa escura, sem sangrar a tela.",
      content: `1. ARTEFATO FÍSICO 3D: Foto, documento ou vídeo com borda branca de papel, inclinado em perspectiva 3D sobre mesa escura.
2. CÂMERA EM DERIVA CONTÍNUA: A câmera nunca para; parallax constante entre o plano de fundo e o cartão inclinado.
3. ANOTAÇÕES EM CARIMBO VERMELHO: Usar #c4302b ou #e5332b (nunca neon) para tarjas, etiquetas ou carimbos de data/fato.
4. FOTOS EM ESCALA DE CINZA: Aplicar grayscale(1) contrast(1.12) brightness(.92) para transformar fotos modernas em material de arquivo.
5. LEGENDA RAIL MONO NO RODAPÉ: Fonte monospace discreta no rodapé, fechando estritamente ao final de cada frase.
6. VINHETA PESADA E GRÃO: Camada de textura de arquivo sobreposta sempre ativa.`,
    },
    {
      title: "Documentário Narrado — Investigação & História com Fontes",
      category: "ESTRUTURA_ATO",
      niche: "Documentário Histórico",
      notes: "Receita validada para vídeos longos e curtos narrados com a voz clonada do Igor no VoiceStudio.",
      content: `ESTRUTURA EM 6 BEATS:
1. O Gancho (0:00-0:15): Apresente a anomalia ou o mistério central. Nenhuma data ou número sem fonte primária.
2. O Contexto Oculto (0:15-0:45): Mostre a versão oficial que todos acreditavam na época.
3. O Fato Desconhecido (0:45-1:30): O documento secreto ou evidência desclassificada que mudou tudo.
4. O Clímax / Ponto Sem Retorno (1:30-2:15): As consequências do acontecimento.
5. A Revelação Final (2:15-2:45): O que pouca gente percebeu até hoje.
6. Fechamento & Impacto: Conclusão memorável.
Marcações no roteiro: [imagem: fotos/arquivo.jpg moldura], [fx: tarja @palavra], [motion: carimbo].`,
    },
    {
      title: "Gancho Viral — Quebra de Expectativa em 3 Segundos",
      category: "GANCHO",
      niche: "Geral / Shorts & Longos",
      notes: "Taxa de retenção comprovada acima de 78% nos primeiros 5 segundos.",
      content: `Fórmula: [Afirmação Absurda mas Real] + [Contradição Visual Imediata] + [Promessa de Revelação]
Exemplo: "Em 1983, um único homem recebeu a ordem de disparar cinco mísseis nucleares. Ele recusou. E as próximas 24 horas foram o segredo mais bem guardado da Guerra Fria."`,
    },
    {
      title: "CTA Natural — Engajamento Sem Parecer Vendedor",
      category: "CTA",
      niche: "Documentário / YouTube",
      notes: "Converte inscritos ao final de documentários sem quebrar o clima cinematográfico.",
      content: `"Se você chegou até aqui, uma pergunta fica: você teria tomado a mesma decisão? Deixe sua visão nos comentários e inscreva-se para acompanhar os próximos dossiês que não aparecem nos livros de história."`,
    },
  ];

  console.log("Semeando catálogo de skills...");
  for (const s of skills) {
    const existing = await prisma.scriptSkill.findFirst({ where: { title: s.title } });
    if (!existing) {
      await prisma.scriptSkill.create({ data: s });
      console.log(`+ Skill criada: ${s.title}`);
    } else {
      console.log(`= Skill já existe: ${s.title}`);
    }
  }
  console.log("Concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

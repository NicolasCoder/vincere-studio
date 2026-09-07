/**
 * Seed: recria o projeto de exemplo do mock do Stitch
 * ("O Buraco Negro Oculto no Sistema Solar") em todos os estágios,
 * para navegarmos pelas telas com dados reais no banco.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const hooks = (a: string, b: string, c: string) => JSON.stringify([a, b, c]);

async function main() {
  await prisma.usage.deleteMany();
  await prisma.job.deleteMany();
  await prisma.project.deleteMany();

  // ---------- Projeto 1: em ideação (Passo 1) ----------
  const p1 = await prisma.project.create({
    data: {
      title: "Mistérios Ocultos da Antiguidade e Civilizações Perdidas",
      format: "LONG_16_9",
      costMode: "FREE",
      niche: "Mistérios Ocultos da Antiguidade e Civilizações Perdidas",
      tone: "Misterioso & Investigativo",
      targetDuration: 18 * 60,
      audience: "Audiência Curiosa & Dark Channel",
      hooks: JSON.stringify(["Clímax nos 30s", "Cliffhangers Triplos"]),
      stage: "IDEATION",
      status: "IN_PROGRESS",
      ideas: {
        create: [
          {
            title: "O Segredo Oculto que a História Escondeu por 500 Anos",
            category: "Mistério Histórico",
            synopsis:
              "A descoberta recente de pergaminhos criptografados nos subterrâneos de Florença que reescrevem o Renascimento.",
            hookLines: hooks(
              "Em 1524, um manuscrito foi selado com cera negra e ordem papal de destruição imediata.",
              "Por cinco séculos, historiadores acreditaram que ele havia virado cinzas...",
              "Até que uma reforma no arquivo secreto revelou que o pior medo ainda estava intacto.",
            ),
            ctrEstimate: 13.8,
            score: 94,
            retention30s: 68,
            editingPace: "Lento & Tenso",
          },
          {
            title: "O Buraco Negro Oculto no Sistema Solar: O Sinal Que a Ciência Ignorou",
            category: "Cosmologia Dark",
            synopsis:
              "Anomalias gravitacionais nas órbitas dos planetas exteriores sugerem que um micro buraco negro primordial pode estar orbitando o Sol.",
            hookLines: hooks(
              "Algo invisível está puxando os confins do nosso sistema solar há mais de quarenta anos.",
              "Nossos telescópios olharam para o vazio... e viram apenas a distorção da luz.",
              "Agora, astrofísicos admitem: ele está vindo na nossa direção.",
            ),
            ctrEstimate: 14.5,
            score: 97,
            retention30s: 74,
            editingPace: "Frenético & Imersivo",
            recommended: true,
          },
          {
            title: "A Cidade Subterrânea Esquecida que Ninguém Deveria Encontrar",
            category: "Exploração Urbana & Militar",
            synopsis:
              "Engenheiros militares escavaram uma rede secreta de bunkers durante a Guerra Fria que se estende por mais de 40 km.",
            hookLines: hooks(
              "A 60 metros sob o solo de Berlim, existe uma porta blindada sem registro militar.",
              "Quando espeleólogos forçaram a entrada em 2021, o ar ainda circulava.",
              "O Nível 4 prova que alguém continuou construindo muito depois do fim da guerra.",
            ),
            ctrEstimate: 12.2,
            score: 91,
            retention30s: 65,
            editingPace: "Suspense Investigativo",
          },
        ],
      },
    },
  });

  // ---------- Projeto 2: em roteiro (Passo 2) ----------
  const p2 = await prisma.project.create({
    data: {
      title: "O Buraco Negro Oculto no Sistema Solar: O Sinal Que a Ciência Ignorou",
      format: "LONG_16_9",
      costMode: "HYBRID",
      niche: "Cosmologia Dark",
      tone: "Misterioso & Investigativo",
      targetDuration: 21 * 60 + 15,
      audience: "Audiência Curiosa & Dark Channel",
      hooks: JSON.stringify(["Clímax nos 30s", "Cliffhangers Triplos", "Revelação Gradual"]),
      stage: "SCRIPT",
      status: "IN_PROGRESS",
      costUsd: 0.42,
    },
  });
  const script = await prisma.script.create({
    data: {
      projectId: p2.id,
      wordCount: 3420,
      estimatedDuration: 21 * 60 + 15,
      retentionCurve: JSON.stringify([98, 92, 88, 85, 90, 96, 93, 89, 94, 91, 87, 84]),
      blocks: {
        create: [
          {
            act: 1,
            order: 1,
            kind: "HOOK",
            title: "O Gancho Fatal",
            narration:
              "Algo invisível está puxando os confins do nosso sistema solar há mais de quarenta anos. Nossos telescópios olharam para o vazio... e viram apenas a distorção lenta e silenciosa da luz. [Pausa dramática 1.8s] Agora, astrofísicos admitem em documentos confidenciais: ele não está parado na Nuvem de Oort. Ele está acelerando na nossa direção.",
            wpm: 155,
            startMs: 0,
            endMs: 45_000,
            brollCue: "Render 3D fotorrealista da órbita de Netuno com efeito de lente gravitacional",
            soundCue: "Sub-bass drop aos 00:05 seguido por Trilha Dark Ambient Drone",
          },
          {
            act: 2,
            order: 2,
            kind: "CONTEXT",
            title: "Quebra de Padrão & Contexto",
            narration:
              "Para compreender a gravidade do que estamos enfrentando, precisamos voltar a dezembro de 1983. O satélite orbital IRAS detectou uma anomalia infravermelha de proporções titânicas nos limites de Orion. O jornal Washington Post estampou a manchete: \"Possível corpo celeste do tamanho de Júpiter encontrado no limiar do Sistema Solar\". Mas então, o inexplicável aconteceu. Vinte e quatro horas depois, relatórios militares foram classificados e o objeto desapareceu de todos os boletins científicos públicos.",
            wpm: 140,
            startMs: 45_000,
            endMs: 195_000,
            brollCue: "Montagem dinâmica de recortes de jornais de 1983, arquivo NASA/ESA IRAS",
            soundCue: "Pulsar sutil de batimentos cardíacos sub-auriculares (62 BPM)",
          },
          {
            act: 3,
            order: 3,
            kind: "ESCALATION",
            title: "A Primeira Anomalia",
            narration:
              "Quando a sonda New Horizons ultrapassou Plutão em 2015, seus sensores de telemetria registraram uma discrepância angular de 0,004 graus. Para o público leigo, um número insignificante. Para quem conhece mecânica orbital de precisão, uma sentença assustadora: [Pausa dramática 1.5s] existia uma massa de densidade quase infinita puxando a trajetória da sonda.",
            wpm: 150,
            startMs: 195_000,
            endMs: 480_000,
            brollCue: "Trajetória vetorial 3D da sonda New Horizons saindo da rota",
            soundCue: "Efeito Shepard Tone ascendente contínuo",
          },
          { act: 4, order: 4, kind: "ESCALATION", title: "Escalada & Revelações", narration: "(a gerar na Sprint 2)", startMs: 480_000, endMs: 800_000 },
          { act: 5, order: 5, kind: "CLIMAX", title: "Clímax", narration: "(a gerar na Sprint 2)", startMs: 800_000, endMs: 1_130_000 },
          { act: 6, order: 6, kind: "RESOLUTION", title: "Resolução & Próximo Mistério", narration: "(a gerar na Sprint 2)", startMs: 1_130_000, endMs: 1_275_000 },
        ],
      },
    },
  });

  await prisma.usage.createMany({
    data: [
      { projectId: p2.id, provider: "GEMINI", unit: "TOKENS_IN", quantity: 48_000, costUsd: 0.036 },
      { projectId: p2.id, provider: "GEMINI", unit: "TOKENS_OUT", quantity: 26_000, costUsd: 0.1 },
      { projectId: p2.id, provider: "NANO_BANANA", unit: "IMAGES", quantity: 3, costUsd: 0.28 },
    ],
  });

  // ---------- Projeto 3: publicado (Conclusão) ----------
  const p3 = await prisma.project.create({
    data: {
      title: "Eles Detectaram um Sinal Secreto nos Confins do Sistema Solar",
      format: "LONG_16_9",
      costMode: "PREMIUM",
      niche: "Cosmologia Dark",
      tone: "Misterioso & Investigativo",
      targetDuration: 21 * 60 + 15,
      stage: "PUBLISH",
      status: "PUBLISHED",
      costUsd: 9.8,
      renderJobs: {
        create: {
          profile: "YOUTUBE_1080",
          progress: 100,
          outputPath: "storage/demo/master.mp4",
          startedAt: new Date(Date.now() - 20 * 60_000),
          finishedAt: new Date(Date.now() - 5 * 60_000),
        },
      },
      publications: {
        create: {
          videoId: "dQw4w9WgXcQ",
          url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
          title: "Eles Detectaram um Sinal Secreto nos Confins do Sistema Solar",
          description:
            "Uma nova anomalia nas órbitas transnetunianas pode finalmente comprovar a hipótese mais perturbadora da astrofísica moderna.",
          tags: JSON.stringify(["astronomia", "buraconegro", "sistemasolar", "espaco", "documentario", "misterio"]),
          chapters: JSON.stringify([{ t: 0, title: "O Gancho" }, { t: 45, title: "1983" }, { t: 195, title: "New Horizons" }]),
          publishedAt: new Date(Date.now() - 4 * 60_000),
          stats: JSON.stringify({ views: 12840, ctr: 16.8, avgViewDuration: 612 }),
        },
      },
    },
  });

  // ---------- Projeto 4: um Short ----------
  await prisma.project.create({
    data: {
      title: "O Sinal de 1983 que a NASA Apagou",
      format: "SHORT_9_16",
      costMode: "FREE",
      niche: "Cosmologia Dark",
      tone: "Frenético & Imersivo",
      targetDuration: 60,
      stage: "IDEATION",
      status: "DRAFT",
    },
  });

  // Job de exemplo concluído para a fila
  await prisma.job.create({
    data: {
      type: "DEMO",
      projectId: p3.id,
      status: "DONE",
      progress: 100,
      message: "Render concluído",
      finishedAt: new Date(),
    },
  });


  // ---------- Workflow Studio: campanha de exemplo (Aura Serum, 9:16) ----------
  await prisma.workflow.deleteMany();
  const graph = {
    nodes: [
      { id: "n1", type: "AVATAR", position: { x: 80, y: 80 }, data: { kind: "AVATAR", name: "Aria v3.4", role: "Digital Creator · Beauty & Tech", faceConsistency: 96, gaze: "Direct-to-Camera (9:16)", expression: "Conversational & Hook", headPose: "Natural Micro-Nod" } },
      { id: "n2", type: "PRODUCT", position: { x: 80, y: 560 }, data: { kind: "PRODUCT", name: "Aura Night Serum", description: "Cosmetic Matte Black 30ml", fidelity: 0.94, lighting: "Studio Dark Rim Light", interaction: "Product In-Hand Reveal", reflection: "HDRI Studio Velvet" } },
      { id: "n3", type: "PROMPT", position: { x: 720, y: 80 }, data: { kind: "PROMPT", format: "9:16 UGC Commercial", fps: 60, positive: "Criação de comercial vertical 9:16 viral para TikTok e Reels. Influencer digital Aria segura o frasco do Sérum Aura em estúdio minimalista, demonstrando aplicação suave com iluminação cinematográfica macro, 60fps, estilo UGC autêntico de alta conversão.", negative: "texto, marca d'água, mãos deformadas, baixa qualidade", engine: "Veo / Wan 2.1", motionStrength: 0.78, steps: 35 } },
      { id: "n4", type: "VOICE", position: { x: 720, y: 560 }, data: { kind: "VOICE", provider: "Gemini TTS", voiceId: "Clara - Conversational", script: "Se você quer transformar a sua rotina de skincare com resultados visíveis em 7 noites...", durationSec: 15, lipSync: "LivePortrait", latencyMs: 42 } },
      { id: "n5", type: "RENDER", position: { x: 1360, y: 300 }, data: { kind: "RENDER", title: "Comercial Aura Night", width: 1080, height: 1920, fps: 60, bitrate: "24 Mbps H.265", captions: true, status: "READY" } },
    ],
    edges: [
      { id: "e1-3", source: "n1", target: "n3" },
      { id: "e2-3", source: "n2", target: "n3" },
      { id: "e1-4", source: "n1", target: "n4" },
      { id: "e3-5", source: "n3", target: "n5" },
      { id: "e4-5", source: "n4", target: "n5" },
    ],
  };
  await prisma.workflow.create({ data: { name: "Campanha Aura Serum (9:16 UGC + IA)", kind: "VERTICAL_COMMERCIAL", status: "READY", graph: JSON.stringify(graph) } });

  await prisma.setting.deleteMany();
  await prisma.setting.createMany({
    data: [
      { key: "defaultCostMode", value: "FREE" },
      { key: "defaultVoice", value: "gemini:Charon" },
    ],
  });

  console.log("Seed OK:", { p1: p1.id, p2: p2.id, script: script.id, p3: p3.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

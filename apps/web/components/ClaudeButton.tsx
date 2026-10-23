"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, cn } from "@vincere-studio/ui";
import { PainelVincularCerebro } from "./PainelVincularCerebro";

// Vince: o assistente flutuante ativo do Vincere Studio.
//   Conversar: guia contextual na tela atual, sugere skills na hora certa e executa ações de edição diretamente no projeto;
//   Pedidos:   caixa de pedidos para o agente local (Antigravity agy / Claude Code);
//   Memória:   aprendizado contínuo de preferências de estilo, formato, nicho e voz.

interface Pedido {
  id: string;
  createdAt: string;
  status: "pendente" | "fazendo" | "feito" | "erro";
  pedido: string;
  resposta?: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  irPara?: string | null;
  acaoClaude?: string | null;
  acaoStudio?: {
    action: string;
    label: string;
    payload?: Record<string, unknown>;
  } | null;
  skillSugerida?: {
    nome: string;
    comando: string;
    motivo: string;
  } | null;
  lembrou?: string | null;
  nota?: 1 | -1;
}

interface SugestaoItem {
  rotulo: string;
  texto?: string;
  acaoStudio?: string;
  labelStudio?: string;
  payloadStudio?: Record<string, unknown>;
}

export const CLAUDE_EVENT = "vincere:chamar-claude";
export const HF_PROJECT_KEY = "vincere.hfProject";
const CHAT_KEY = "vincere.vince.chat";
const VOZ_KEY = "vincere.vince.voz";

export function chamarClaude(detail: { pedido: string; anexo?: string; projetoId?: string }) {
  window.dispatchEvent(new CustomEvent(CLAUDE_EVENT, { detail }));
}

const STATUS_LABEL: Record<Pedido["status"], { label: string; cls: string }> = {
  pendente: { label: "Na fila", cls: "border-warning/40 text-warning" },
  fazendo: { label: "Agente operando", cls: "border-primary/50 text-primary-bright" },
  feito: { label: "Feito", cls: "border-success/40 text-success" },
  erro: { label: "Precisa de você", cls: "border-error/50 text-error" },
};

const BOAS_VINDAS: Msg = {
  role: "assistant",
  content:
    "Oi! Sou o Vince, seu assistente no Vincere Studio. Acompanho você em cada etapa: posso sugerir ideias, guiar edições, indicar skills na hora certa e disparar automações direto no seu projeto. O que vamos criar?",
};

function lerLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function salvarLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function falar(texto: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "pt-BR";
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
  if (voz) u.voice = voz;
  window.speechSynthesis.speak(u);
}

function VinceAvatar({ className, falando }: { className?: string; falando?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vince-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f6bff" />
          <stop offset="1" stopColor="#7a2cff" />
        </linearGradient>
      </defs>
      <path d="M20 4 L24 11 L28 4" fill="none" stroke="url(#vince-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="12" width="34" height="28" rx="11" fill="url(#vince-g)" />
      <rect x="12" y="18" width="24" height="15" rx="7" fill="#0a0b10" />
      <circle cx="19" cy="25.5" r="2.6" fill="#b3c0ff" className="vince-olho" />
      <circle cx="29" cy="25.5" r="2.6" fill="#b3c0ff" className="vince-olho" />
      <rect x="21" y="30" width="6" height={falando ? 2.6 : 1.2} rx="0.6" fill="#b3c0ff" />
    </svg>
  );
}

function obterSugestoesContextuais(pathname: string): SugestaoItem[] {
  if (pathname.includes("/ideation")) {
    return [
      { rotulo: "💡 3 Ideias Virais", texto: "Sugira 3 ideias de temas com ganchos de alta retenção para este nicho." },
      { rotulo: "⚡ Auto-Produce Completo", acaoStudio: "auto_produce", labelStudio: "Auto-Produce (Roteiro ao Render)" },
    ];
  }
  if (pathname.includes("/script")) {
    return [
      { rotulo: "📝 Roteiro em 4 Atos", texto: "Estruture o roteiro do vídeo em 4 atos com ritmo acelerado para alta retenção." },
      { rotulo: "🎙️ Sintetizar Voz (Edge TTS)", acaoStudio: "sintetizar_voz", labelStudio: "Sintetizar Voz dos Roteiros" },
    ];
  }
  if (pathname.includes("/media") || pathname.includes("/scenes")) {
    return [
      { rotulo: "🖼️ Gerar Imagens IA", acaoStudio: "gerar_imagens", labelStudio: "Preencher Imagens de Todas as Cenas" },
      { rotulo: "🛡️ Validar Safe-Zones 9:16", acaoStudio: "validar_safe_zones", labelStudio: "Auditar Safe-Zones" },
      { rotulo: "🎬 Montar no HyperFrames", acaoStudio: "exportar_hyperframes", labelStudio: "Exportar para o HyperFrames" },
    ];
  }
  if (pathname.includes("/render") || pathname.includes("/edit-plan")) {
    return [
      { rotulo: "🛡️ Auditar Safe-Zones", acaoStudio: "validar_safe_zones", labelStudio: "Auditar Safe-Zones" },
      { rotulo: "🎥 Renderizar Prova 1080p", acaoStudio: "renderizar_video", labelStudio: "Renderizar Prova de Vídeo" },
      { rotulo: "⚡ Auto-Produce Completo", acaoStudio: "auto_produce", labelStudio: "Auto-Produce (Roteiro ao Render)" },
    ];
  }
  if (pathname.startsWith("/projects/")) {
    return [
      { rotulo: "⚡ Auto-Produce Completo", acaoStudio: "auto_produce", labelStudio: "Auto-Produce (Roteiro ao Render)" },
      { rotulo: "🖼️ Gerar Imagens IA", acaoStudio: "gerar_imagens", labelStudio: "Preencher Imagens IA" },
      { rotulo: "🎙️ Sintetizar Voz", acaoStudio: "sintetizar_voz", labelStudio: "Sintetizar Voz (Edge TTS)" },
      { rotulo: "🎬 Montar no HyperFrames", acaoStudio: "exportar_hyperframes", labelStudio: "Exportar para o HyperFrames" },
    ];
  }
  if (pathname === "/studio") {
    return [
      { rotulo: "🔧 Corrigir Lint GSAP", texto: "Corrija os avisos de lint do HyperFrames neste projeto (anime apenas transform e opacity)." },
      { rotulo: "✨ Sugerir Motion", texto: "Qual motion da MotionDex combina com este estilo de vídeo?" },
      { rotulo: "🎨 Dicas de Tipografia", texto: "Qual combinação de fontes e cores destaca melhor este estilo?" },
    ];
  }
  if (pathname === "/workflow") {
    return [
      { rotulo: "🤖 Descrever Fluxo para IA", texto: "Como descrevo um fluxo para a IA montar os nodes do ComfyUI?" },
      { rotulo: "📂 Como salvar e rodar?", texto: "Como executo um fluxo nodal depois de montado?" },
    ];
  }
  if (pathname === "/skills") {
    return [
      { rotulo: "🔄 Atualizar Skills", texto: "Como funciona a atualização automática de skills na minha máquina?" },
      { rotulo: "🎯 Qual skill usar?", texto: "Qual skill você recomenda para vídeos de alta retenção no Reels/TikTok?" },
    ];
  }
  return [
    { rotulo: "🎬 Por onde começo?", texto: "Por onde eu começo a criar um vídeo no Vincere Studio?" },
    { rotulo: "⚡ O que você faz?", texto: "O que o Vince e o Vincere Studio podem fazer por mim?" },
    { rotulo: "🎯 Sugerir Nicho Viral", texto: "Quais são os nichos com maior retenção e engajamento no momento?" },
  ];
}

function identificarContextoTela(pathname: string): string {
  if (pathname.includes("/ideation")) return "📍 Etapa 1: Ideação";
  if (pathname.includes("/script")) return "📍 Etapa 2: Roteiro";
  if (pathname.includes("/media") || pathname.includes("/scenes")) return "📍 Etapa 3: Mídia & Cenas";
  if (pathname.includes("/edit-plan")) return "📍 Plano de Edição";
  if (pathname.includes("/render")) return "📍 Etapa 4: Renderização";
  if (pathname.includes("/published")) return "📍 Publicação";
  if (pathname === "/studio") return "📍 HyperFrames Studio";
  if (pathname === "/workflow") return "📍 Copiloto & Fluxo Nodal";
  if (pathname === "/skills") return "📍 Catálogo de Skills";
  if (pathname === "/tendencias") return "📍 Tendências";
  if (pathname === "/projects") return "📍 Quadro de Projetos";
  if (pathname === "/dashboard") return "📍 Início";
  return "📍 Vincere Studio";
}

export function ClaudeButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"conversar" | "claude" | "memoria">("conversar");

  // Conversa com o Vince
  const [msgs, setMsgs] = useState<Msg[]>([BOAS_VINDAS]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [vozLigada, setVozLigada] = useState(false);
  const [executandoStudio, setExecutandoStudio] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  // Pedidos ao Claude
  const [pedido, setPedido] = useState("");
  const [anexo, setAnexo] = useState<string | undefined>();
  const [overrideProjetoId, setOverrideProjetoId] = useState<string | undefined>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [enviando, setEnviando] = useState(false);

  // IA vinculada
  const [precisaVincular, setPrecisaVincular] = useState(false);
  const [motor, setMotor] = useState<string | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const projetoId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const ativos = pedidos.filter((i) => i.status === "pendente" || i.status === "fazendo").length;
  const contextoTela = identificarContextoTela(pathname);
  const sugestoesContextuais = obterSugestoesContextuais(pathname);

  useEffect(() => {
    if (!open) return;
    fetch("/api/cerebro", { cache: "no-store" })
      .then((x) => x.json())
      .then((r) => {
        if (!r?.ok) return;
        setPrecisaVincular(!r.ativo);
        const o = (r.opcoes as { tipo: string; id: string; nome: string }[]).find(
          (x) => x.tipo === r.ativo?.tipo && x.id === r.ativo?.id,
        );
        setMotor(o?.nome ?? null);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    setMsgs(lerLocal<Msg[]>(CHAT_KEY, [BOAS_VINDAS]));
    setVozLigada(lerLocal<boolean>(VOZ_KEY, false));
  }, []);

  useEffect(() => {
    salvarLocal(CHAT_KEY, msgs.slice(-30));
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  const atualizarPedidos = useCallback(async () => {
    const r = await fetch("/api/claude", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setPedidos(r.items.slice(0, 30));
  }, []);

  useEffect(() => {
    atualizarPedidos();
    const t = setInterval(atualizarPedidos, open ? 4000 : 20000);
    return () => clearInterval(t);
  }, [open, atualizarPedidos]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ pedido: string; anexo?: string; projetoId?: string }>).detail;
      setPedido(d?.pedido ?? "");
      setAnexo(d?.anexo);
      setOverrideProjetoId(d?.projetoId);
      setAba("claude");
      setOpen(true);
    };
    window.addEventListener(CLAUDE_EVENT, onOpen);
    return () => window.removeEventListener(CLAUDE_EVENT, onOpen);
  }, []);

  const perguntar = async (conteudo: string) => {
    const pergunta = conteudo.trim();
    if (pergunta.length < 2 || pensando) return;
    const historico: Msg[] = [...msgs, { role: "user", content: pergunta }];
    setMsgs(historico);
    setTexto("");
    setPensando(true);
    setErro(null);
    const r = await fetch("/api/assistente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagina: pathname, mensagens: historico.map(({ role, content }) => ({ role, content })) }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setPensando(false);
    if (!r?.ok) {
      if (r?.precisaVincular) {
        setPrecisaVincular(true);
        return;
      }
      setErro(r?.error ?? "Sem resposta do assistente.");
      return;
    }
    if (r.motor) setMotor(r.motor);
    setMsgs((m) => [
      ...m,
      {
        role: "assistant",
        content: r.resposta,
        irPara: r.irPara,
        acaoClaude: r.acaoClaude,
        acaoStudio: r.acaoStudio,
        skillSugerida: r.skillSugerida,
        lembrou: r.lembrou,
      },
    ]);
    if (vozLigada) falar(r.resposta);
  };

  const avaliar = (indice: number, nota: 1 | -1) => {
    const resposta = msgs[indice];
    const pergunta = [...msgs.slice(0, indice)].reverse().find((m) => m.role === "user")?.content ?? "";
    setMsgs((ms) => ms.map((m, j) => (j === indice ? { ...m, nota } : m)));
    fetch("/api/vince", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback", pergunta, resposta: resposta.content, nota }),
    }).catch(() => {});
  };

  const enviarPedido = async (texto = pedido, extra = anexo) => {
    setEnviando(true);
    setErro(null);
    let projetoHf: string | undefined;
    try {
      projetoHf = localStorage.getItem(HF_PROJECT_KEY) || undefined;
    } catch {}
    const r = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: texto, pagina: pathname, projetoHf, projetoId: overrideProjetoId || projetoId, anexo: extra }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setEnviando(false);
    if (!r?.ok) return setErro(r?.error ?? "Não foi possível enviar.");
    setPedido("");
    setAnexo(undefined);
    setAba("claude");
    atualizarPedidos();
  };

  const excluirPedido = async (id: string) => {
    await fetch(`/api/claude?id=${id}`, { method: "DELETE" }).catch(() => {});
    atualizarPedidos();
  };

  const limparPedidos = async (filtro: "all" | "feito") => {
    await fetch(`/api/claude?filtro=${filtro}`, { method: "DELETE" }).catch(() => {});
    atualizarPedidos();
  };

  const executarAcaoStudio = async (action: string, payload?: Record<string, unknown>, labelCustom?: string) => {
    const idAlvo = overrideProjetoId || projetoId;
    if (!idAlvo) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: "Abra ou crie um projeto primeiro (em /projects ou /dashboard) para executar esta ação diretamente.",
        },
      ]);
      return;
    }
    setExecutandoStudio(true);
    const rotulo = labelCustom || action;
    setMsgs((m) => [
      ...m,
      {
        role: "assistant",
        content: `⚡ Iniciando ação **${rotulo}** no projeto... Aguarde.`,
      },
    ]);

    try {
      const res = await fetch(`/api/v1/projects/${idAlvo}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      setExecutandoStudio(false);
      if (data.ok) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: `✅ Ação **${rotulo}** concluída com sucesso! ${data.jobId ? `(Job ID: \`${data.jobId}\`)` : ""} ${data.mensagem ?? ""}`,
            irPara: action === "exportar_hyperframes" ? "/studio" : undefined,
          },
        ]);
      } else {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: `❌ Não foi possível executar **${rotulo}**: ${data.error || "Erro no servidor"}.`,
          },
        ]);
      }
    } catch {
      setExecutandoStudio(false);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `❌ Falha na conexão com o servidor ao executar **${rotulo}**.`,
        },
      ]);
    }
  };

  const alternarMic = (destino: "conversar" | "claude") => {
    if (ouvindo) return recRef.current?.stop();
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) return setErro("Ditado por voz não é suportado neste navegador (use o Chrome).");
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.continuous = destino === "claude";
    rec.onresult = (ev: any) => {
      const fala = Array.from(ev.results as ArrayLike<any>)
        .slice(ev.resultIndex)
        .map((res) => res[0].transcript)
        .join(" ");
      if (destino === "conversar") perguntar(fala);
      else setPedido((p) => (p ? `${p} ${fala}` : fala).trim());
    };
    rec.onend = () => setOuvindo(false);
    rec.start();
    recRef.current = rec;
    setOuvindo(true);
  };

  const alternarVoz = () => {
    const v = !vozLigada;
    setVozLigada(v);
    salvarLocal(VOZ_KEY, v);
    if (!v && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="vince-fab fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-line bg-surface-elevated/95 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-fg shadow-2xl backdrop-blur hover:border-primary/60 sm:bottom-6 sm:right-6"
        aria-expanded={open}
        aria-label="Abrir o assistente Vince"
      >
        <VinceAvatar className="size-9" falando={pensando || executandoStudio} />
        <span className="hidden sm:inline">Vince</span>
        {ativos > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-void">{ativos}</span>}
      </button>

      {open && (
        <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl border border-line bg-surface-low shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[620px] sm:w-[440px] sm:rounded-2xl">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3 bg-surface-mid/40">
            <VinceAvatar className="size-9 shrink-0" falando={pensando || executandoStudio} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-fg">Vince</span>
                <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.2 text-[10px] font-medium text-primary-bright">
                  {contextoTela}
                </span>
              </div>
              <p className="truncate text-[11px] text-muted">{motor ? `IA ativa: ${motor}` : "Assistente Agente-Primeiro"}</p>
            </div>
            <button
              onClick={alternarVoz}
              className={cn("grid size-8 place-items-center rounded", vozLigada ? "text-primary-bright" : "text-muted hover:text-fg")}
              title={vozLigada ? "Desligar voz" : "Ler respostas em voz alta"}
            >
              <Icon name={vozLigada ? "volume_up" : "volume_off"} className="text-[18px]" />
            </button>
            <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded text-muted hover:bg-line/40 hover:text-fg" aria-label="Fechar">
              <Icon name="close" className="text-[18px]" />
            </button>
          </header>

          <nav className="grid grid-cols-3 border-b border-line text-xs bg-void/30">
            {(["conversar", "claude", "memoria"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={cn("py-2.5 font-semibold transition-colors", aba === a ? "border-b-2 border-primary text-fg bg-surface-low/80" : "text-muted hover:text-fg")}
              >
                {a === "conversar" ? "Conversar & Ações" : a === "memoria" ? "Memória" : `Pedidos${ativos ? ` (${ativos})` : ""}`}
              </button>
            ))}
          </nav>

          {aba === "conversar" ? (
            precisaVincular ? (
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="mb-2 font-display text-sm font-bold text-fg">Vincule a sua IA ao Vince</h3>
                <PainelVincularCerebro
                  onVinculado={(texto, nome) => {
                    setMsgs([{ role: "assistant", content: texto }]);
                    setMotor(nome);
                    setPrecisaVincular(false);
                  }}
                  aoMudar={() => {}}
                />
              </div>
            ) : (
            <>
              {/* Sugestões Rápidas da Tela Atual */}
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line/40 bg-surface-mid/20 px-3 py-2 text-xs">
                <span className="text-[10px] text-muted shrink-0 font-medium">Sugestões:</span>
                {sugestoesContextuais.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={executandoStudio || pensando}
                    onClick={() => {
                      if (s.acaoStudio) {
                        executarAcaoStudio(s.acaoStudio, s.payloadStudio, s.labelStudio);
                      } else if (s.texto) {
                        perguntar(s.texto);
                      }
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface-low px-2.5 py-1 text-[11px] text-fg-secondary hover:border-primary/50 hover:text-fg hover:bg-primary/5 transition-colors disabled:opacity-40"
                  >
                    <span>{s.rotulo}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[88%] space-y-2 rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm",
                        m.role === "user" ? "rounded-br-sm bg-primary text-void" : "rounded-bl-sm border border-line bg-void/60 text-fg",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>

                      {/* Skill Sugerida */}
                      {m.skillSugerida && (
                        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary-bright flex items-center gap-1">
                              <Icon name="psychology" className="text-[14px]" />
                              Skill: <code>{m.skillSugerida.comando}</code>
                            </span>
                            <button
                              type="button"
                              onClick={() => enviarPedido(`Execute a skill ${m.skillSugerida!.comando} no projeto`)}
                              className="text-[10px] font-semibold text-primary-bright hover:underline"
                            >
                              Mandar executar
                            </button>
                          </div>
                          {m.skillSugerida.motivo && <p className="text-fg-secondary text-[10px]">{m.skillSugerida.motivo}</p>}
                        </div>
                      )}

                      {/* Execução de Ação Direta no Studio */}
                      {m.acaoStudio && (
                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={executandoStudio}
                            onClick={() => executarAcaoStudio(m.acaoStudio!.action, m.acaoStudio!.payload, m.acaoStudio!.label)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:opacity-90 disabled:opacity-40"
                          >
                            <Icon name={executandoStudio ? "sync" : "bolt"} className={executandoStudio ? "animate-spin text-[14px]" : "text-[14px] text-amber-300"} />
                            <span>{m.acaoStudio.label || "Executar no Projeto"}</span>
                          </button>
                        </div>
                      )}

                      {m.lembrou && (
                        <p className="flex items-center gap-1 text-[11px] text-success">
                          <Icon name="bookmark_added" className="text-[14px]" /> Anotei: {m.lembrou}
                        </p>
                      )}

                      {(m.irPara || m.acaoClaude) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {m.irPara && (
                            <button
                              onClick={() => router.push(m.irPara!)}
                              className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-secondary hover:text-fg"
                            >
                              Ir para {m.irPara}
                            </button>
                          )}
                          {m.acaoClaude && (
                            <button
                              onClick={() => enviarPedido(m.acaoClaude!, undefined)}
                              className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary-bright hover:bg-primary/30"
                            >
                              Mandar o agente fazer
                            </button>
                          )}
                        </div>
                      )}

                      {m.role === "assistant" && i > 0 && (
                        <div className="flex gap-1 pt-0.5">
                          {([1, -1] as const).map((n) => (
                            <button
                              key={n}
                              onClick={() => avaliar(i, n)}
                              disabled={!!m.nota}
                              className={cn(
                                "grid size-6 place-items-center rounded text-muted hover:text-fg disabled:cursor-default",
                                m.nota === n && (n === 1 ? "text-success" : "text-error"),
                              )}
                              title={n === 1 ? "Boa resposta" : "Resposta ruim (o Vince evita na próxima)"}
                            >
                              <Icon name={n === 1 ? "thumb_up" : "thumb_down"} className="text-[14px]" filled={m.nota === n} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {pensando && <p className="text-[11px] text-muted animate-pulse">Vince está pensando…</p>}
                {executandoStudio && <p className="text-[11px] text-primary-bright animate-pulse">Executando no projeto…</p>}
                <div ref={fimRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  perguntar(texto);
                }}
                className="flex items-center gap-2 border-t border-line p-3 bg-surface-mid/20"
              >
                <button
                  type="button"
                  onClick={() => alternarMic("conversar")}
                  className={cn("grid size-10 shrink-0 place-items-center rounded-full border", ouvindo ? "animate-pulse border-error bg-error/15 text-error" : "border-line text-fg-secondary hover:text-fg")}
                  title="Falar com o Vince"
                >
                  <Icon name={ouvindo ? "stop" : "mic"} className="text-[20px]" />
                </button>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={`Pergunte algo em ${contextoTela}…`}
                  className="field h-10 flex-1 px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={pensando || executandoStudio || texto.trim().length < 2}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-void disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Icon name="send" className="text-[18px]" />
                </button>
              </form>
              {erro && <p className="px-4 pb-2 text-[11px] text-error">{erro}</p>}
              <div className="flex items-center justify-between px-4 pb-2 text-[10px] text-muted">
                {msgs.length > 1 ? (
                  <button onClick={() => setMsgs([BOAS_VINDAS])} className="hover:text-fg">
                    Limpar conversa
                  </button>
                ) : <span />}
                <button onClick={() => setPrecisaVincular(true)} className="hover:text-fg">
                  Trocar IA ({motor || "Vincular"})
                </button>
              </div>
            </>
            )
          ) : aba === "claude" ? (
            <>
              <div className="space-y-2 border-b border-line p-4 bg-surface-mid/20">
                <p className="text-[11px] text-muted">
                  Os pedidos são executados pelo <strong className="text-primary-bright">agente local (Antigravity agy / Claude Code)</strong> nos arquivos do seu projeto.
                </p>
                {anexo && <span className="inline-block rounded border border-primary/40 px-1.5 py-0.5 font-mono text-[10px] text-primary-bright">+ anexo</span>}
                <textarea
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  rows={3}
                  placeholder='Ex.: "Na cena 2, aumente o título e aplique o motion abertura-impacto"'
                  className="field w-full p-2.5 text-sm"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alternarMic("claude")}
                    className={cn("grid size-10 place-items-center rounded border", ouvindo ? "animate-pulse border-error bg-error/15 text-error" : "border-line text-fg-secondary hover:text-fg")}
                    title="Ditar por voz"
                  >
                    <Icon name={ouvindo ? "stop" : "mic"} className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => enviarPedido()}
                    disabled={enviando || pedido.trim().length < 3}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded bg-primary text-sm font-bold text-void disabled:opacity-40"
                  >
                    <Icon name="send" className="text-[18px]" />
                    {enviando ? "Executando…" : "Executar com o agente"}
                  </button>
                </div>
                {erro && <p className="text-[11px] text-error">{erro}</p>}
              </div>

              {/* Toolbar de Limpeza de Pedidos */}
              <div className="flex items-center justify-between border-b border-line/40 px-4 py-2 text-xs bg-void/30">
                <span className="font-mono text-[11px] text-muted">
                  {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} na fila
                </span>
                <div className="flex items-center gap-3">
                  {pedidos.some((p) => p.status === "feito" || p.status === "erro") && (
                    <button
                      type="button"
                      onClick={() => limparPedidos("feito")}
                      className="text-[11px] text-fg-secondary hover:text-fg hover:underline"
                    >
                      Limpar concluídos
                    </button>
                  )}
                  {pedidos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Deseja apagar todos os pedidos da caixa?")) {
                          limparPedidos("all");
                        }
                      }}
                      className="text-[11px] text-muted hover:text-error hover:underline"
                    >
                      Limpar tudo
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {pedidos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted space-y-1">
                    <Icon name="inbox" className="text-[28px] mx-auto text-muted/50" />
                    <p>Caixa de pedidos limpa.</p>
                  </div>
                ) : (
                  pedidos.map((i) => (
                    <div key={i.id} className="group relative rounded-lg border border-line bg-void/50 p-3 text-xs">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", STATUS_LABEL[i.status].cls)}>{STATUS_LABEL[i.status].label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted">
                            {new Date(i.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                          <button
                            type="button"
                            onClick={() => excluirPedido(i.id)}
                            title="Excluir pedido"
                            className="rounded p-1 text-muted hover:text-error hover:bg-error/15 transition-colors"
                          >
                            <Icon name="delete" className="text-[13px]" />
                          </button>
                        </div>
                      </div>
                      <p className="text-fg">{i.pedido}</p>
                      {i.resposta && <p className="mt-2 whitespace-pre-wrap rounded border border-line/60 bg-surface-mid/40 p-2 text-fg-secondary">{i.resposta}</p>}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <MemoriaVince projetoId={projetoId} pathname={pathname} />
          )}
        </aside>
      )}
    </>
  );
}

/** Aba "Memória": o que o Vince aprende com você a cada edição e projeto. */
function MemoriaVince({ projetoId, pathname }: { projetoId?: string; pathname: string }) {
  const [itens, setItens] = useState<Array<{ id: string; texto: string; origem: string; criadoEm: string }>>([]);
  const [novo, setNovo] = useState("");
  const [notas, setNotas] = useState({ boas: 0, ruins: 0 });

  const carregar = useCallback(async () => {
    const r = await fetch("/api/vince", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setItens(r.itens);
      setNotas({
        boas: r.feedback.filter((f: { nota: number }) => f.nota === 1).length,
        ruins: r.feedback.filter((f: { nota: number }) => f.nota === -1).length,
      });
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const post = async (body: Record<string, unknown>) => {
    await fetch("/api/vince", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    carregar();
  };

  const aprenderDoContexto = () => {
    if (projetoId) {
      post({
        action: "lembrar",
        texto: `No projeto atual (${projetoId}), priorize legendas dinâmicas, ganchos nos primeiros 2s e formato 9:16 vertical`,
      });
    } else {
      post({
        action: "lembrar",
        texto: `Priorize vídeos verticais (Shorts/Reels) com narração em português, ritmo acelerado e B-roll denso`,
      });
    }
  };

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-[11px] leading-relaxed text-fg-secondary space-y-2">
        <p>
          O Vince aprende ativamente com suas decisões. As notas 👍 ({notas.boas}) e 👎 ({notas.ruins}) ensinam o que repetir ou evitar, e as regras abaixo entram no cérebro dele em toda conversa.
        </p>
        <button
          type="button"
          onClick={aprenderDoContexto}
          className="inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-1 text-[10px] font-semibold text-primary-bright hover:bg-primary/30"
        >
          <Icon name="auto_awesome" className="text-[12px]" />
          Aprender preferências desta tela
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.trim().length >= 4) post({ action: "lembrar", texto: novo.trim() }).then(() => setNovo(""));
        }}
        className="flex gap-2"
      >
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Ensine algo: ex.: sempre use fonte Sora e legendas amarelas"
          className="field h-9 flex-1 px-3 text-xs"
        />
        <button type="submit" className="rounded bg-primary px-3 text-xs font-semibold text-void">
          Anotar
        </button>
      </form>

      {itens.length === 0 ? (
        <p className="py-6 text-center text-muted">Nenhum aprendizado registrado ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((i) => (
            <li key={i.id} className="flex items-start gap-2 rounded border border-line bg-void/50 p-2">
              <Icon name={i.origem === "manual" ? "edit_note" : "bookmark_added"} className="mt-0.5 text-[14px] text-primary-bright" />
              <span className="flex-1 text-fg">{i.texto}</span>
              <button onClick={() => post({ action: "esquecer", id: i.id })} className="text-muted hover:text-error" title="Esquecer">
                <Icon name="close" className="text-[14px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

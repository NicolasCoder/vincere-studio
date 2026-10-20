"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, cn } from "@vincere-studio/ui";

// Vince: o assistente do canto. Duas abas —
//   Conversar: guia na ferramenta (LLM de texto do servidor, grátis) com voz do navegador;
//   Claude:    caixa de pedidos que o Claude Code no PC executa (skill vincere-pedidos).

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
  lembrou?: string | null;
  nota?: 1 | -1;
}

/** Outras telas abrem a aba do Claude já preenchida: chamarClaude({ pedido, anexo }). */
export const CLAUDE_EVENT = "vincere:chamar-claude";
export const HF_PROJECT_KEY = "vincere.hfProject";
const CHAT_KEY = "vincere.vince.chat";
const VOZ_KEY = "vincere.vince.voz";

export function chamarClaude(detail: { pedido: string; anexo?: string }) {
  window.dispatchEvent(new CustomEvent(CLAUDE_EVENT, { detail }));
}

const STATUS_LABEL: Record<Pedido["status"], { label: string; cls: string }> = {
  pendente: { label: "Na fila", cls: "border-warning/40 text-warning" },
  fazendo: { label: "Claude trabalhando", cls: "border-primary/50 text-primary-bright" },
  feito: { label: "Feito", cls: "border-success/40 text-success" },
  erro: { label: "Precisa de você", cls: "border-error/50 text-error" },
};

const BOAS_VINDAS: Msg = {
  role: "assistant",
  content:
    "Oi, Igor! Sou o Vince. Posso te explicar qualquer tela, sugerir o nicho e a skill certos e mandar o Claude editar para você. O que vamos fazer?",
};

const SUGESTOES = ["Por onde eu começo um vídeo?", "Qual skill uso agora?", "Como copio o estilo de um vídeo?", "O que esta tela faz?"];

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

/** Mascote: um pequeno robô com o "V" da marca na antena. */
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
  const fimRef = useRef<HTMLDivElement>(null);

  // Pedidos ao Claude
  const [pedido, setPedido] = useState("");
  const [anexo, setAnexo] = useState<string | undefined>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [enviando, setEnviando] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const projetoId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const ativos = pedidos.filter((i) => i.status === "pendente" || i.status === "fazendo").length;

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
    if (r?.ok) setPedidos(r.items.slice(0, 15));
  }, []);

  useEffect(() => {
    atualizarPedidos();
    const t = setInterval(atualizarPedidos, open ? 4000 : 20000);
    return () => clearInterval(t);
  }, [open, atualizarPedidos]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ pedido: string; anexo?: string }>).detail;
      setPedido(d?.pedido ?? "");
      setAnexo(d?.anexo);
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
      setErro(r?.error ?? "Sem resposta do assistente.");
      return;
    }
    setMsgs((m) => [...m, { role: "assistant", content: r.resposta, irPara: r.irPara, acaoClaude: r.acaoClaude, lembrou: r.lembrou }]);
    if (vozLigada) falar(r.resposta);
  };

  // 👍/👎: a pergunta que originou a resposta vai junto, para o Vince saber o que evitar.
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
      body: JSON.stringify({ pedido: texto, pagina: pathname, projetoHf, projetoId, anexo: extra }),
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
        <VinceAvatar className="size-9" falando={pensando} />
        <span className="hidden sm:inline">Vince</span>
        {ativos > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-void">{ativos}</span>}
      </button>

      {open && (
        <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl border border-line bg-surface-low shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:w-[420px] sm:rounded-2xl">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <VinceAvatar className="size-9 shrink-0" falando={pensando} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-bold text-fg">Vince</div>
              <p className="truncate text-[11px] text-muted">Seu guia no Vincere Studio · edições pelo Claude</p>
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

          <nav className="grid grid-cols-3 border-b border-line text-xs">
            {(["conversar", "claude", "memoria"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={cn("py-2.5 font-semibold", aba === a ? "border-b-2 border-primary text-fg" : "text-muted hover:text-fg")}
              >
                {a === "conversar" ? "Conversar" : a === "memoria" ? "Memória" : `Pedidos${ativos ? ` (${ativos})` : ""}`}
              </button>
            ))}
          </nav>

          {aba === "conversar" ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[88%] space-y-2 rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                        m.role === "user" ? "rounded-br-sm bg-primary text-void" : "rounded-bl-sm border border-line bg-void/60 text-fg",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
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
                              Mandar o Claude fazer
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
                {pensando && <p className="text-[11px] text-muted">Vince está pensando…</p>}
                {msgs.length <= 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {SUGESTOES.map((s) => (
                      <button key={s} onClick={() => perguntar(s)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-secondary hover:border-primary/50 hover:text-fg">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={fimRef} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  perguntar(texto);
                }}
                className="flex items-center gap-2 border-t border-line p-3"
              >
                <button
                  type="button"
                  onClick={() => alternarMic("conversar")}
                  className={cn("grid size-10 shrink-0 place-items-center rounded-full border", ouvindo ? "animate-pulse border-error bg-error/15 text-error" : "border-line text-fg-secondary hover:text-fg")}
                  title="Falar com o Vince"
                >
                  <Icon name={ouvindo ? "stop" : "mic"} className="text-[20px]" />
                </button>
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pergunte qualquer coisa…" className="field h-10 flex-1 px-3 text-sm" />
                <button type="submit" disabled={pensando || texto.trim().length < 2} className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-void disabled:opacity-40" aria-label="Enviar">
                  <Icon name="send" className="text-[18px]" />
                </button>
              </form>
              {erro && <p className="px-4 pb-3 text-[11px] text-error">{erro}</p>}
              {msgs.length > 1 && (
                <button onClick={() => setMsgs([BOAS_VINDAS])} className="pb-3 text-[10px] text-muted hover:text-fg">
                  Limpar conversa
                </button>
              )}
            </>
          ) : aba === "claude" ? (
            <>
              <div className="space-y-2 border-b border-line p-4">
                <p className="text-[11px] text-muted">
                  O Claude no seu PC executa e responde aqui. Deixe rodando <code className="text-fg-secondary">/loop 1m /vincere-pedidos</code>.
                </p>
                {anexo && <span className="inline-block rounded border border-primary/40 px-1.5 py-0.5 font-mono text-[10px] text-primary-bright">+ anexo</span>}
                <textarea
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  rows={3}
                  placeholder='Ex.: "Na cena 2, deixe o título maior e troque o destaque para amarelo"'
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
                    {enviando ? "Enviando…" : "Enviar ao Claude"}
                  </button>
                </div>
                {erro && <p className="text-[11px] text-error">{erro}</p>}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {pedidos.length === 0 ? (
                  <p className="text-center text-xs text-muted">Nenhum pedido ainda.</p>
                ) : (
                  pedidos.map((i) => (
                    <div key={i.id} className="rounded-lg border border-line bg-void/50 p-3 text-xs">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", STATUS_LABEL[i.status].cls)}>{STATUS_LABEL[i.status].label}</span>
                        <span className="font-mono text-[10px] text-muted">
                          {new Date(i.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <p className="text-fg">{i.pedido}</p>
                      {i.resposta && <p className="mt-2 whitespace-pre-wrap rounded border border-line/60 bg-surface-mid/40 p-2 text-fg-secondary">{i.resposta}</p>}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <MemoriaVince />
          )}
        </aside>
      )}
    </>
  );
}


/** Aba "Memória": o que o Vince sabe do Igor. Tudo aqui entra no prompt de cada conversa. */
function MemoriaVince() {
  const [itens, setItens] = useState<Array<{ id: string; texto: string; origem: string; criadoEm: string }>>([]);
  const [novo, setNovo] = useState("");
  const [notas, setNotas] = useState({ boas: 0, ruins: 0 });

  const carregar = useCallback(async () => {
    const r = await fetch("/api/vince", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setItens(r.itens);
      setNotas({ boas: r.feedback.filter((f: { nota: number }) => f.nota === 1).length, ruins: r.feedback.filter((f: { nota: number }) => f.nota === -1).length });
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const post = async (body: Record<string, unknown>) => {
    await fetch("/api/vince", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    carregar();
  };

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
      <p className="text-muted">
        O Vince não treina um modelo: ele lê esta lista em toda conversa. Ele anota sozinho quando você conta uma preferência, e as respostas com 👎 ({notas.ruins}) viram exemplos do que evitar
        {notas.boas ? `; as com 👍 (${notas.boas}), do que repetir` : ""}.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.trim().length >= 4) post({ action: "lembrar", texto: novo.trim() }).then(() => setNovo(""));
        }}
        className="flex gap-2"
      >
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Ensine algo: ex. meu público principal é do México" className="field h-9 flex-1 px-3 text-xs" />
        <button type="submit" className="rounded bg-primary px-3 text-xs font-semibold text-void">
          Anotar
        </button>
      </form>
      {itens.length === 0 ? (
        <p className="py-6 text-center text-muted">Nada anotado ainda.</p>
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

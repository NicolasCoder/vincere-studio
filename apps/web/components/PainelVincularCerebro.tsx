"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon, cn } from "@vincere-studio/ui";

interface Opcao {
  tipo: "agente" | "llm";
  id: string;
  nome: string;
  disponivel: boolean;
  detalhe: string;
}

interface Estado {
  cerebro: { tipo: string; id: string; modelo?: string; esforco?: string } | null;
  ativo: { tipo: string; id: string; modelo?: string; esforco?: string } | null;
  opcoes: Opcao[];
}

/**
 * Vincular a IA da própria pessoa ao Vince. Ao vincular, a IA lê o manual da ferramenta (/AGENTES.md) e se apresenta;
 * dali em diante ela é o cérebro do Vince. Usado no Vince (primeiro acesso) e em Configurações.
 */
export function PainelVincularCerebro({
  onVinculado,
  aoMudar,
}: {
  onVinculado?: (apresentacao: string, motor: string, conversaId?: string | null) => void;
  aoMudar?: () => void;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/cerebro", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setEstado({ cerebro: r.cerebro, ativo: r.ativo, opcoes: r.opcoes });
    else setErro("Não consegui consultar as IAs disponíveis.");
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const vincular = async (o: Opcao) => {
    setVinculando(o.id);
    setErro(null);
    const v = await fetch("/api/cerebro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "vincular", tipo: o.tipo, id: o.id }),
    }).then((x) => x.json()).catch(() => null);
    if (!v?.ok) {
      setVinculando(null);
      return setErro(v?.error ?? "Não foi possível vincular.");
    }
    // A primeira coisa depois de vincular: a IA lê o manual e se apresenta.
    const a = await fetch("/api/cerebro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "apresentar" }),
    }).then((x) => x.json()).catch(() => null);
    setVinculando(null);
    setTrocando(false);
    await carregar();
    aoMudar?.();
    if (a?.ok) onVinculado?.(a.resposta, a.motor, a.conversaId ?? null);
    else setErro(`Vinculei, mas a IA não respondeu agora: ${a?.error ?? "sem resposta"}. Você pode tentar conversar com o Vince mesmo assim.`);
  };

  const desvincular = async () => {
    await fetch("/api/cerebro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "desvincular" }) }).catch(() => {});
    await carregar();
    aoMudar?.();
  };

  if (!estado) return <p className="text-[11px] text-muted">{erro ?? "Procurando as IAs disponíveis…"}</p>;

  const nomeVinculado = estado.opcoes.find((o) => o.tipo === estado.cerebro?.tipo && o.id === estado.cerebro?.id)?.nome;
  const mostrarLista = !estado.cerebro || trocando;
  const grupo = (tipo: Opcao["tipo"], titulo: string) => {
    const itens = estado.opcoes.filter((o) => o.tipo === tipo);
    return (
      <div className="space-y-1.5">
        <div className="font-mono text-[10px] uppercase tracking-wide text-muted">{titulo}</div>
        {itens.map((o) => (
          <div key={o.id} className={cn("flex items-center gap-2 rounded-lg border p-2.5", o.disponivel ? "border-line bg-void/40" : "border-line/60 bg-void/20 opacity-80")}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                {o.nome}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", o.disponivel ? "bg-success/15 text-success" : "bg-line/60 text-muted")}>
                  {o.disponivel ? "disponível" : "não encontrada"}
                </span>
              </div>
              <div className="break-words font-mono text-[10px] text-muted">{o.detalhe}</div>
            </div>
            <button
              type="button"
              disabled={!o.disponivel || vinculando !== null}
              onClick={() => vincular(o)}
              className="shrink-0 rounded bg-primary px-2.5 py-1.5 text-[11px] font-bold text-void disabled:opacity-40"
            >
              {vinculando === o.id ? "Vinculando…" : "Vincular"}
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {estado.cerebro && !trocando ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-2.5 text-[12px] text-success">
          <Icon name="check_circle" className="text-[16px]" />
          <span className="min-w-0 flex-1">
            IA vinculada ao Vince: <strong>{nomeVinculado ?? estado.cerebro.id}</strong>
            {estado.cerebro.modelo ? ` · ${estado.cerebro.modelo}` : ""}
            {estado.cerebro.esforco ? ` (${estado.cerebro.esforco})` : ""}
          </span>
          <button type="button" onClick={() => setTrocando(true)} className="underline">trocar</button>
          <button type="button" onClick={desvincular} className="underline">desvincular</button>
        </div>
      ) : (
        <p className="text-[12px] leading-relaxed text-fg-secondary">
          Escolha a IA que você já usa. Ela lê o manual da ferramenta e passa a ser o cérebro do Vince: guia você, sugere skills e prompts e
          ajuda a editar. Tudo fica só nesta instância; nada vai para o servidor de ninguém.
        </p>
      )}
      {mostrarLista && (
        <>
          {grupo("agente", "Agentes no seu computador")}
          {grupo("llm", "Por chave de API")}
          <p className="text-[10px] text-muted">
            Para usar uma IA por chave, salve a chave em <Link href="/settings#chaves" className="underline">Configurações → Chaves de API</Link>.
          </p>
        </>
      )}
      {erro && <p className="text-[11px] text-error">{erro}</p>}
    </div>
  );
}

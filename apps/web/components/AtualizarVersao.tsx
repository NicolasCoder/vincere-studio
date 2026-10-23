"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@vincere-studio/ui";

interface Item { id: string; nome: string; atual: string | null; ultima: string | null; disponivel: boolean; automatico: boolean; manual: string | null }

/**
 * Botão "Atualizar versão" de um componente (HyperFrames, VoiceStudio…). Mostra a versão instalada
 * e a última publicada; atualiza no servidor com o token de admin, que fica só na memória da aba.
 */
export function AtualizarVersao({ id, compacto = false }: { id: string; compacto?: boolean }) {
  const [item, setItem] = useState<Item | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = () =>
    fetch("/api/atualizar", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { itens: Item[] }) => setItem(j.itens.find((i) => i.id === id) ?? null))
      .catch(() => setItem(null));
  useEffect(() => { void carregar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const atualizar = async () => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/atualizar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, token }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "Sem resposta do servidor." }));
    setBusy(false);
    setToken("");
    if (r.ok) { setMsg(`Atualizado${r.atual ? ` para ${r.atual}` : ""}.`); setPedindo(false); void carregar(); }
    else setMsg(r.error ?? "Falha ao atualizar.");
  };

  const rotulo = item.disponivel ? `Atualizar versão (${item.atual} → ${item.ultima})` : item.atual ? `Atualizar versão (v${item.atual})` : "Atualizar versão";

  return (
    <div className="relative inline-block z-50">
      <Button size="sm" variant={item.disponivel ? "primary" : "outline"} icon="system_update_alt" onClick={() => { setPedindo((v) => !v); setMsg(item.manual); }}>
        {compacto ? "Atualizar" : rotulo}
      </Button>
      {pedindo && (
        <div className="absolute right-0 z-50 mt-2 w-80 space-y-3 rounded-xl border border-white/[0.18] bg-void/95 backdrop-blur-2xl p-4 text-xs shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-fg">{item.nome}{item.atual ? ` · v${item.atual}` : ""}</p>
            <button
              type="button"
              onClick={() => setPedindo(false)}
              className="text-muted hover:text-fg p-0.5 rounded transition-colors"
              title="Fechar"
            >
              <Icon name="close" className="text-[14px]" />
            </button>
          </div>
          {item.ultima && item.ultima !== item.atual && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary-bright">
              Nova versão disponível: <strong>{item.ultima}</strong>
            </div>
          )}
          {item.automatico ? (
            <div className="space-y-2 pt-1">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token de admin"
                className="w-full rounded-lg border border-white/[0.12] bg-surface-low px-2.5 py-1.5 text-fg text-xs focus:outline-none focus:border-primary"
              />
              <Button size="sm" variant="primary" icon="download" disabled={busy || token.length < 12} onClick={atualizar} className="w-full justify-center">
                {busy ? "Atualizando…" : "Atualizar agora"}
              </Button>
            </div>
          ) : null}
          {msg && <p className="text-fg-secondary text-[11px] leading-relaxed"><Icon name="info" className="mr-1 align-[-3px] text-[13px] text-primary-bright" />{msg}</p>}
        </div>
      )}
      {!pedindo && msg && <p className="absolute right-0 z-50 mt-1 w-64 text-[11px] text-emerald-300 bg-void/90 px-2 py-1 rounded border border-emerald-500/30">{msg}</p>}
    </div>
  );
}

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
    <div className="relative inline-block">
      <Button size="sm" variant={item.disponivel ? "primary" : "outline"} icon="system_update_alt" onClick={() => { setPedindo((v) => !v); setMsg(item.manual); }}>
        {compacto ? "Atualizar" : rotulo}
      </Button>
      {pedindo && (
        <div className="absolute right-0 z-30 mt-2 w-72 space-y-2 rounded border border-line bg-surface p-3 text-xs shadow-xl">
          <p className="font-semibold">{item.nome}{item.atual ? ` · instalada ${item.atual}` : ""}{item.ultima ? ` · última ${item.ultima}` : ""}</p>
          {item.automatico ? (
            <>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de admin" className="w-full rounded border border-line bg-surface-low px-2 py-1.5 text-fg" />
              <Button size="sm" variant="primary" icon="download" disabled={busy || token.length < 12} onClick={atualizar}>{busy ? "Atualizando…" : "Atualizar agora"}</Button>
            </>
          ) : null}
          {msg && <p className="text-fg-secondary"><Icon name="info" className="mr-1 align-[-3px] text-[14px]" />{msg}</p>}
        </div>
      )}
      {!pedindo && msg && <p className="absolute right-0 mt-1 w-64 text-[11px] text-emerald-300">{msg}</p>}
    </div>
  );
}

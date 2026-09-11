"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, Icon } from "@docupulse/ui";
import { aplicarThumbnail } from "./actions";

interface Variante {
  sceneId: string;
  src: string;
}

/**
 * Ajuste de thumbnail na própria tela, com três variações.
 *
 * O ciclo antigo era: enfileirar um job, esperar o worker, procurar o arquivo, não gostar,
 * repetir. Como a composição é um ffmpeg sobre um quadro só, a prévia sai em fração de segundo —
 * então ela acompanha o controle enquanto você mexe, e só a escolhida vira a thumbnail do projeto.
 */
export function ThumbnailStudio({
  projectId,
  tituloInicial,
  subInicial,
}: {
  projectId: string;
  tituloInicial: string;
  subInicial: string;
}) {
  const [titulo, setTitulo] = useState(tituloInicial);
  const [sub, setSub] = useState(subInicial);
  const [escuridao, setEscuridao] = useState(0.5);
  const [halo, setHalo] = useState(0.8);

  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aplicada, setAplicada] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  // Cada pedido carrega um número de série. Respostas de pedidos antigos que chegam atrasadas são
  // descartadas — senão, arrastar o controle rápido faz a tela voltar para um estado anterior.
  const serie = useRef(0);

  const gerar = useCallback(async () => {
    if (!titulo.trim()) return;
    const meu = ++serie.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/thumbnail`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titulo, sub, escuridao, halo }),
      });
      const data = await r.json();
      if (meu !== serie.current) return;
      if (!r.ok) {
        setErro(String(data.error ?? "não consegui gerar a prévia"));
        setVariantes([]);
      } else {
        setVariantes(data.variantes ?? []);
      }
    } catch {
      if (meu === serie.current) setErro("falha ao falar com o servidor");
    } finally {
      if (meu === serie.current) setCarregando(false);
    }
  }, [projectId, titulo, sub, escuridao, halo]);

  // Espera a mão parar antes de compor: sem isso, arrastar um controle dispara uma dúzia de
  // renders que serão todos descartados menos o último.
  useEffect(() => {
    const t = setTimeout(gerar, 450);
    return () => clearTimeout(t);
  }, [gerar]);

  function usar(sceneId: string) {
    startSalvar(async () => {
      await aplicarThumbnail(projectId, { sceneId, titulo, sub, escuridao, halo });
      setAplicada(sceneId);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">
          <Icon name="image" className="mr-1 align-middle text-primary-bright" />
          Thumbnail
        </h3>
        <span className="font-mono text-[11px] text-muted">
          {carregando ? "compondo…" : `${variantes.length} variação(ões) · ajuste e escolha`}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label-mono text-muted">Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="field mt-1 w-full px-3 py-2 text-sm"
            placeholder="A linha grande"
          />
        </label>
        <label className="block">
          <span className="label-mono text-muted">Subtítulo</span>
          <input
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            className="field mt-1 w-full px-3 py-2 text-sm"
            placeholder="A linha fina, espaçada (opcional)"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Controle rotulo="Escuridão da foto" valor={escuridao} aoMudar={setEscuridao} />
        <Controle rotulo="Brilho do texto" valor={halo} aoMudar={setHalo} />
      </div>

      {erro && <p className="mt-3 rounded border border-dashed border-line p-3 text-xs text-fg-secondary">{erro}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {variantes.map((v) => (
          <div key={v.sceneId} className="space-y-2">
            <img
              src={v.src}
              alt="Variação de thumbnail"
              className={`w-full rounded border transition-opacity ${carregando ? "opacity-50" : ""} ${
                aplicada === v.sceneId ? "border-primary" : "border-line"
              }`}
            />
            <Button
              size="sm"
              variant={aplicada === v.sceneId ? "primary" : undefined}
              icon={aplicada === v.sceneId ? "check" : "download_done"}
              disabled={salvando}
              onClick={() => usar(v.sceneId)}
              className="w-full"
            >
              {aplicada === v.sceneId ? "Em uso" : "Usar esta"}
            </Button>
          </div>
        ))}
        {!variantes.length && !erro && (
          <div className="rounded border border-dashed border-line p-6 text-center text-[11px] text-muted sm:col-span-3">
            {carregando ? "compondo as variações…" : "escreva um título para ver as variações"}
          </div>
        )}
      </div>
    </Card>
  );
}

function Controle({ rotulo, valor, aoMudar }: { rotulo: string; valor: number; aoMudar: (v: number) => void }) {
  return (
    <label className="block">
      <span className="label-mono flex items-center justify-between text-muted">
        {rotulo}
        <span className="font-mono text-[11px]">{Math.round(valor * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
    </label>
  );
}

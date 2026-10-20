"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { PageHeader } from "@/components/PageHeader";
import { chamarClaude } from "@/components/ClaudeButton";
import { Button, Card, Icon } from "@vincere-studio/ui";
import { NICHOS, pedidoDoNicho } from "@/lib/nichos";
import { IDIOMAS, idiomaPorId } from "@/lib/idiomas";

interface Beat {
  id: number;
  fala: string;
  imagemPrompt: string;
  efeitoOuMotion: string;
  fonte: string;
}

const ESTILOS = NICHOS.map((n) => ({ id: n.id, label: `${n.nome} (${n.formato})`, skill: n.skill, nicho: n }));

const EXEMPLO: Beat[] = [
  {
    id: 1,
    fala: "Em 1964, um ex-corredor e seu treinador decidiram desafiar as gigantes alemãs de calçados esportivos.",
    imagemPrompt: "foto de arquivo dos fundadores, moldura",
    efeitoOuMotion: "[fx: tarja @1964 cor=#c4302b]",
    fonte: "Shoe Dog, Phil Knight",
  },
  {
    id: 2,
    fala: "Eles começaram vendendo pares importados no porta-malas de um carro, em pistas universitárias.",
    imagemPrompt: "carro anos 60 com porta-malas aberto",
    efeitoOuMotion: "[motion: carimbo-data texto='1964 ORIGEM']",
    fonte: "Arquivo histórico de Beaverton",
  },
];

const STORE = "vincere.copiloto.v1";

export default function CopilotPage() {
  const router = useRouter();
  const [tema, setTema] = useState("A história oculta da fundação da Nike");
  const [estilo, setEstilo] = useState<string>(ESTILOS[0].id);
  const [idiomaId, setIdiomaId] = useState("pt-BR");
  const [beats, setBeats] = useState<Beat[]>(EXEMPLO);
  const [loaded, setLoaded] = useState(false);

  // Rascunho fica no navegador: fechar a aba não perde o roteiro.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved?.beats?.length) {
        setTema(saved.tema);
        setEstilo(saved.estilo);
        if (saved.idiomaId) setIdiomaId(saved.idiomaId);
        setBeats(saved.beats);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ tema, estilo, idiomaId, beats }));
    } catch {}
  }, [loaded, tema, estilo, idiomaId, beats]);

  const update = (id: number, field: keyof Beat, val: string) =>
    setBeats((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: val } : b)));

  const add = () =>
    setBeats((prev) => [
      ...prev,
      { id: Math.max(0, ...prev.map((b) => b.id)) + 1, fala: "", imagemPrompt: "", efeitoOuMotion: "", fonte: "" },
    ]);

  const remove = (id: number) => setBeats((prev) => prev.filter((b) => b.id !== id));

  const estiloAtual = ESTILOS.find((e) => e.id === estilo) ?? ESTILOS[0];
  const palavras = beats.reduce((n, b) => n + b.fala.split(/\s+/).filter(Boolean).length, 0);
  // ~2,5 palavras por segundo na narração em português.
  const segundos = Math.round(palavras / 2.5);

  const enviar = () =>
    chamarClaude({
      pedido: `${pedidoDoNicho(estiloAtual.nicho, tema, estiloAtual.nicho.formato, undefined, idiomaPorId(idiomaId))} Use os beats do anexo como roteiro.`,
      anexo: JSON.stringify({ tema, nicho: estiloAtual.id, idioma: idiomaId, beats }, null, 2),
    });

  // Leva as falas para a Central de Vozes (a página lê e limpa esta chave ao abrir).
  const narrar = () => {
    try {
      localStorage.setItem("vincere.voz.idioma", idiomaId);
      localStorage.setItem("vincere.voz.texto", beats.map((b) => b.fala.trim()).filter(Boolean).join("\n\n"));
    } catch {}
    router.push("/voice-studio");
  };

  return (
    <>
      <Topbar crumbs={["Criar", "Roteiro em beats"]} />
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader
          icon="edit_note"
          title="Roteiro em beats"
          subtitle="Escreva o vídeo em blocos curtos (5 a 15 s). Quando estiver bom, mande para o Claude montar no HyperFrames."
        />

        <ol className="grid gap-2 text-xs sm:grid-cols-3">
          {[
            ["1", "Escreva os beats", "Fala, mídia, efeito e fonte de cada trecho."],
            ["2", "Mande para o Claude", "Ele cria o projeto, gera a narração e monta as cenas."],
            ["3", "Revise no Studio", "Ajuste pedindo pelo botão Chamar o Claude."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-3 rounded-lg border border-line bg-surface-low p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-primary-bright">{n}</span>
              <span>
                <span className="block font-semibold text-fg">{t}</span>
                <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>

        <Card className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label className="label-mono mb-1 block text-muted">Tema do vídeo</label>
              <input value={tema} onChange={(e) => setTema(e.target.value)} className="field w-full px-3 py-2 text-base font-semibold" />
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Estilo</label>
              <select value={estilo} onChange={(e) => setEstilo(e.target.value)} className="field w-full px-3 py-2 text-sm">
                {ESTILOS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-mono mb-1 block text-muted">Idioma</label>
              <select value={idiomaId} onChange={(e) => setIdiomaId(e.target.value)} className="field w-full px-3 py-2 text-sm">
                {IDIOMAS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.bandeira} {i.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {beats.map((b, idx) => (
              <div key={b.id} className="space-y-2 rounded-lg border border-line bg-void/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary-bright">Beat {idx + 1}</span>
                  <button onClick={() => remove(b.id)} className="text-muted hover:text-error" title="Remover beat">
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={b.fala}
                  onChange={(e) => update(b.id, "fala", e.target.value)}
                  className="field w-full p-2 text-sm"
                  placeholder="O que o narrador fala neste trecho"
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={b.imagemPrompt} onChange={(e) => update(b.id, "imagemPrompt", e.target.value)} placeholder="Mídia: foto, clipe ou cena gerada" className="field px-2 py-1.5 text-xs" />
                  <input value={b.efeitoOuMotion} onChange={(e) => update(b.id, "efeitoOuMotion", e.target.value)} placeholder="Efeito: [fx: …] ou [motion: …]" className="field px-2 py-1.5 font-mono text-xs text-warning" />
                  <input value={b.fonte} onChange={(e) => update(b.id, "fonte", e.target.value)} placeholder="Fonte do fato" className="field px-2 py-1.5 text-xs" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" icon="add" onClick={add}>
                Adicionar beat
              </Button>
              <span className="text-xs text-muted">
                {beats.length} beats · {palavras} palavras · ~{segundos}s de narração
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" icon="graphic_eq" onClick={narrar} disabled={beats.every((b) => !b.fala.trim())}>
                Narrar no VoiceStudio
              </Button>
              <Button variant="primary" icon="forum" onClick={enviar} disabled={beats.every((b) => !b.fala.trim())}>
                Mandar para o Claude montar
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}

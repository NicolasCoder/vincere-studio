"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FORMATS, STAGES, STAGE_META, type Stage, type VideoFormat } from "@vincere-studio/core";
import { Badge, Card, Chip, Icon } from "@vincere-studio/ui";
import { deleteProject, moveProjectStage } from "./actions";

export interface KanbanProject {
  id: string;
  title: string;
  niche: string;
  format: string;
  stage: string;
  visualStyle?: string;
}

/**
 * Quadro de produção com arrastar e soltar.
 *
 * A etapa é uma coluna no banco, então mover é só gravar — nada do pipeline é refeito ou perdido.
 * Move otimista: a carta troca de coluna na hora e a gravação acontece atrás. Esperar o servidor
 * para só então mover deixa o arrasto com aquela borracha de meio segundo que faz o quadro
 * parecer quebrado.
 *
 * Arrastar é de mouse (a API de drag do HTML não vale para toque). No celular o quadro continua
 * navegável pelo clique, que é o que ele já fazia antes.
 */
export function KanbanBoard({ projects }: { projects: KanbanProject[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [etapas, setEtapas] = useState<Record<string, string>>({});
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Stage | null>(null);

  const etapaDe = (p: KanbanProject) => etapas[p.id] ?? p.stage;

  function soltar(stage: Stage) {
    const id = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!id) return;
    const atual = projects.find((p) => p.id === id);
    if (!atual || etapaDe(atual) === stage) return;

    setEtapas((e) => ({ ...e, [id]: stage }));
    startTransition(async () => {
      try {
        await moveProjectStage(id, stage);
      } catch {
        // Desfaz o move otimista: melhor a carta voltar para onde estava do que o quadro mostrar
        // uma etapa que o banco não tem.
        setEtapas((e) => {
          const { [id]: _, ...resto } = e;
          return resto;
        });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
      {STAGES.map((stageKey) => {
        const meta = STAGE_META[stageKey];
        const col = projects.filter((p) => etapaDe(p) === stageKey);
        const realcada = alvo === stageKey && arrastando !== null;
        return (
          <div
            key={stageKey}
            className="min-w-0"
            onDragOver={(e) => {
              e.preventDefault();
              if (alvo !== stageKey) setAlvo(stageKey);
            }}
            onDragLeave={(e) => {
              // Só limpa quando o ponteiro sai da coluna inteira, não ao cruzar as cartas dentro.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAlvo((a) => (a === stageKey ? null : a));
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltar(stageKey);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="label-mono flex items-center gap-1.5 text-fg-secondary">
                <Icon name={meta.step === 5 ? "task_alt" : "radio_button_unchecked"} className="text-[13px] text-primary-bright" />
                {meta.short}
              </span>
              <Badge tone="neutral">{col.length}</Badge>
            </div>
            <div
              className={`flex min-h-24 flex-col gap-2 rounded transition-colors ${
                realcada ? "bg-primary/10 outline outline-1 outline-dashed outline-primary/50" : ""
              }`}
            >
              {col.length === 0 && (
                <div className="rounded border border-dashed border-line p-4 text-center text-[11px] text-muted">
                  {realcada ? "soltar aqui" : "vazio"}
                </div>
              )}
              {col.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    // Alguns navegadores cancelam o arrasto sem nada no dataTransfer.
                    e.dataTransfer.setData("text/plain", p.id);
                    setArrastando(p.id);
                  }}
                  onDragEnd={() => {
                    setArrastando(null);
                    setAlvo(null);
                  }}
                  onClick={() => router.push(`/projects/${p.id}/${STAGE_META[etapaDe(p) as Stage].href}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/projects/${p.id}/${STAGE_META[etapaDe(p) as Stage].href}`);
                    }
                  }}
                  className={`cursor-grab active:cursor-grabbing ${arrastando === p.id ? "opacity-40" : ""}`}
                >
                  <Card className="group relative h-full p-3 hover:border-line-glow" accent={p.format === "SHORT_9_16" ? "violet" : "cyan"}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Chip active tone={p.format === "SHORT_9_16" ? "violet" : "cyan"}>
                        {FORMATS[p.format as VideoFormat].ratio}
                      </Chip>
                      <Badge tone={p.visualStyle === "TALKING_HEAD" ? "success" : "neutral"}>
                        {p.visualStyle === "TALKING_HEAD" ? "Talking Head" : "Dark / Doc"}
                      </Badge>
                    </div>
                    {/* Apagar fica escondido até o ponteiro chegar na carta: é irreversível e leva
                        os arquivos junto, então não deve estar no caminho de um clique distraído. */}
                    <button
                      type="button"
                      title="Apagar projeto"
                      aria-label={`Apagar ${p.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`Apagar "${p.title}"?\n\nIsto remove o projeto e TODOS os arquivos dele no disco — roteiro, locução, cenas, renders e miniaturas. Não tem como desfazer.`)) return;
                        startTransition(() => deleteProject(p.id));
                      }}
                      className="absolute right-1.5 top-1.5 hidden rounded p-1 text-muted hover:bg-error/15 hover:text-error group-hover:block"
                    >
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                    <div className="mt-2 line-clamp-3 font-display text-sm font-semibold leading-snug">{p.title}</div>
                    <div className="mt-1.5 line-clamp-1 text-[11px] text-fg-secondary">{p.niche}</div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

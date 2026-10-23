"use client";

import { useTransition } from "react";
import { Icon } from "@vincere-studio/ui";
import { deleteWorkflow } from "./actions";

export function BotaoApagarWorkflow({ workflowId, workflowName }: { workflowId: string; workflowName: string }) {
  const [pendente, startTransition] = useTransition();

  const handleExcluir = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Apagar o fluxo "${workflowName}"?\n\nEsta ação remove o grafo nodal e as conexões salvas.`)) {
      return;
    }

    startTransition(async () => {
      await deleteWorkflow(workflowId);
    });
  };

  return (
    <button
      type="button"
      title="Excluir fluxo"
      aria-label={`Excluir ${workflowName}`}
      disabled={pendente}
      onClick={handleExcluir}
      className="rounded p-1 text-muted transition-colors hover:bg-error/20 hover:text-error disabled:opacity-40"
    >
      <Icon name={pendente ? "sync" : "delete"} className={`text-[14px] ${pendente ? "animate-spin" : ""}`} />
    </button>
  );
}

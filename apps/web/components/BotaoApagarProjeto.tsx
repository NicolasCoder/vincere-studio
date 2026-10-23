"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@vincere-studio/ui";
import { deleteProject } from "@/app/(studio)/projects/actions";

interface BotaoApagarProjetoProps {
  projectId: string;
  projectTitle: string;
  compacto?: boolean;
  redirecionarPara?: string;
  className?: string;
}

export function BotaoApagarProjeto({
  projectId,
  projectTitle,
  compacto = true,
  redirecionarPara,
  className = "",
}: BotaoApagarProjetoProps) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  const handleExcluir = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !confirm(
        `Apagar "${projectTitle}"?\n\nEsta ação remove o projeto e TODOS os seus arquivos gerados (áudios, imagens, renders e roteiros). Não é possível desfazer.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      await deleteProject(projectId);
      if (redirecionarPara) {
        router.push(redirecionarPara);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      title="Excluir projeto permanentemente"
      aria-label={`Excluir ${projectTitle}`}
      disabled={pendente}
      onClick={handleExcluir}
      className={`inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5 text-muted transition-colors hover:border-error/40 hover:bg-error/15 hover:text-error disabled:opacity-40 ${className}`}
    >
      <Icon name={pendente ? "sync" : "delete"} className={`text-[15px] ${pendente ? "animate-spin" : ""}`} />
      {!compacto && <span className="text-xs font-medium">Excluir</span>}
    </button>
  );
}

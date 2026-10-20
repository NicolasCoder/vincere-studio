"use client";
import { useState } from "react";
import { Button } from "@vincere-studio/ui";

/**
 * Abre o Remotion Studio numa aba nova, subindo o processo sozinho se ainda não estiver rodando.
 *
 * Com `projectId`: antes de abrir, manda o vídeo e o plano de edição REAIS deste projeto pro
 * Remotion (composição "Revisao") — sem isso, o botão só abria o Studio como ele estava, sem
 * ligação com o projeto da tela (reportado pelo usuário: abriu um projeto e viu o vídeo de outro).
 * Sem `projectId`, abre o Studio genérico, na composição que estava aberta por último.
 */
export function OpenRemotionStudio({ projectId }: { projectId?: string }) {
  const [estado, setEstado] = useState<"idle" | "abrindo" | "erro">("idle");
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  async function abrir() {
    setEstado("abrindo");
    setErroMsg(null);
    try {
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}/remotion-props`, { method: "POST" });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setErroMsg(data.error ?? "Não consegui preparar este projeto para o Remotion.");
          setEstado("erro");
          return;
        }
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        const res = await fetch("/api/remotion-studio");
        const data = (await res.json()) as { url?: string };
        window.open(data.url ?? "http://localhost:3001", "_blank", "noopener,noreferrer");
      }
      setEstado("idle");
    } catch {
      setErroMsg("Não abriu — tente de novo.");
      setEstado("erro");
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        icon={estado === "abrindo" ? "hourglass_top" : "movie_filter"}
        onClick={abrir}
        disabled={estado === "abrindo"}
      >
        {estado === "abrindo" ? "Abrindo Remotion Studio…" : "Abrir Remotion Studio"}
      </Button>
      {estado === "erro" && erroMsg && <span className="text-[11px] text-warning">{erroMsg}</span>}
    </div>
  );
}

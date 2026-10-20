"use client";

import { useState } from "react";
import { Icon } from "@vincere-studio/ui";

export function SceneFlowButton({
  projectId,
  sceneId,
  prompt,
  preferVideo,
  format,
}: {
  projectId: string;
  sceneId: string;
  prompt?: string | null;
  preferVideo?: boolean;
  format?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) {
      alert("Esta cena ainda não tem prompt gerado. Clique em 'Planejar cenas' no topo primeiro.");
      return;
    }
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enqueue",
          tipo: preferVideo ? "video" : "imagem",
          prompt,
          proporcao: format === "SHORT_9_16" ? "9:16" : "16:9",
          targetProjectId: projectId,
          targetSceneId: sceneId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
      } else {
        alert("Erro ao disparar para o Flow: " + (data.error || "Verifique o daemon"));
      }
    } catch (e: any) {
      alert("Falha: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading || !prompt}
      className={`inline-flex items-center gap-1 font-mono text-[9px] ${
        loading
          ? "text-primary-bright animate-pulse"
          : success
          ? "text-success"
          : "text-warning hover:text-warning font-semibold"
      }`}
      title="Gerar com IA no Google Flow (Nano Banana Pro / Veo 3.1) usando sua conta Google PRO"
    >
      <Icon name={loading ? "hourglass_top" : success ? "check_circle" : "bolt"} className="text-[12px]" />
      {loading ? "gerando no Flow…" : success ? "na fila do Flow" : "gerar no Flow"}
    </button>
  );
}

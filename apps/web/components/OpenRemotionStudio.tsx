"use client";
import { useState } from "react";
import { Button } from "@docupulse/ui";

/**
 * Abre o Remotion Studio numa aba nova, subindo o processo sozinho se ainda não estiver rodando.
 *
 * Sem isto, "abrir o Remotion" significava sair da ferramenta, achar o atalho na área de trabalho
 * (ou lembrar do comando `npx remotion studio`) e só depois voltar pra comparar com o projeto —
 * três passos manuais pra uma coisa que devia ser um clique.
 */
export function OpenRemotionStudio() {
  const [estado, setEstado] = useState<"idle" | "abrindo" | "erro">("idle");

  async function abrir() {
    setEstado("abrindo");
    try {
      const res = await fetch("/api/remotion-studio");
      const data = (await res.json()) as { url?: string };
      window.open(data.url ?? "http://localhost:3001", "_blank", "noopener,noreferrer");
      setEstado("idle");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      icon={estado === "abrindo" ? "hourglass_top" : "movie_filter"}
      onClick={abrir}
      disabled={estado === "abrindo"}
    >
      {estado === "abrindo" ? "Abrindo Remotion Studio…" : estado === "erro" ? "Não abriu — tentar de novo" : "Abrir Remotion Studio"}
    </Button>
  );
}

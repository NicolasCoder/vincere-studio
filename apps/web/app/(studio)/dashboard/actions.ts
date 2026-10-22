"use server";
import { createProject } from "../projects/actions";

/**
 * "Criar" do Início sem agente vinculado: abre o projeto direto no pipeline (ideias → roteiro → voz → render).
 * Reaproveita a criação de projeto da tela de Projetos, então o resultado é o mesmo.
 */
export async function criarProjetoDoInicio(dados: { formato: "9:16" | "16:9"; nichoId: string; tema: string; notas?: string }) {
  const fd = new FormData();
  fd.set("format", dados.formato === "9:16" ? "SHORT_9_16" : "LONG_16_9");
  fd.set("niche", dados.tema.trim().slice(0, 120));
  fd.set("costMode", "FREE");
  if (dados.notas?.trim()) fd.set("tone", dados.notas.trim().slice(0, 200));
  fd.set("visualStyle", dados.nichoId === "fala" ? "TALKING_HEAD" : "DARK_DOC");
  return createProject(fd);
}

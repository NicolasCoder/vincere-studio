"use server";
import { prisma } from "@vincere-studio/db";
import { createProject } from "../projects/actions";

/**
 * Cria o projeto no banco e devolve o id gerado (usado tanto pelo agente quanto pelo pipeline visual).
 */
export async function criarProjetoRetornandoId(dados: {
  formato: "9:16" | "16:9";
  nichoId: string;
  tema: string;
  notas?: string;
}): Promise<{ id: string }> {
  const p = await prisma.project.create({
    data: {
      title: dados.tema.trim().slice(0, 120),
      format: dados.formato === "9:16" ? "SHORT_9_16" : "LONG_16_9",
      costMode: "FREE",
      niche: dados.tema.trim().slice(0, 120),
      tone: dados.notas?.trim().slice(0, 200),
      targetDuration: dados.formato === "9:16" ? 60 : 900,
      visualStyle: dados.nichoId === "fala" ? "TALKING_HEAD" : "DARK_DOC",
      status: "IN_PROGRESS",
    },
  });
  return { id: p.id };
}

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

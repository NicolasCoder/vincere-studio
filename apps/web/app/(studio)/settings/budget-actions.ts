"use server";
import { revalidatePath } from "next/cache";
import { setBudgetCapUsd } from "@docupulse/providers";

/** Atualiza o teto mensal (USD) de gasto com geração paga de imagem/vídeo por IA. */
export async function updateBudget(formData: FormData) {
  const raw = String(formData.get("budgetUsd") ?? "0").replace(",", ".");
  const value = Number(raw);
  await setBudgetCapUsd(Number.isFinite(value) && value >= 0 ? value : 0);
  revalidatePath("/settings");
}

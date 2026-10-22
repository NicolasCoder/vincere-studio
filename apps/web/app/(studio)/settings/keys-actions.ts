"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { carregarChavesSalvas, removerChave, salvarChave, testarChaveGemini } from "@vincere-studio/providers";

// Nenhuma ação devolve ou repete o valor da chave: o resultado vai para a tela só como aviso curto.
function voltar(resultado: "salva" | "removida" | "teste_ok" | "erro", name: string, msg?: string): never {
  const q = new URLSearchParams({ chave: resultado, n: name });
  if (msg) q.set("cmsg", msg);
  revalidatePath("/settings");
  redirect(`/settings?${q.toString()}#chaves`);
}

export async function salvarChaveAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  try {
    await salvarChave(name, String(formData.get("value") ?? ""));
  } catch (err) {
    voltar("erro", name, err instanceof Error ? err.message : "Não foi possível salvar.");
  }
  voltar("salva", name);
}

export async function removerChaveAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  try {
    await removerChave(name);
  } catch (err) {
    voltar("erro", name, err instanceof Error ? err.message : "Não foi possível remover.");
  }
  voltar("removida", name);
}

/** Testa a chave do Gemini já salva (a chave nunca passa pela tela de novo). */
export async function testarChaveAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  if (name !== "GEMINI_API_KEY") voltar("erro", name, "Esta chave ainda não tem teste automático.");
  const chave = process.env.GEMINI_API_KEY || (await carregarChavesSalvas()).GEMINI_API_KEY;
  if (!chave) voltar("erro", name, "Salve a chave antes de testar.");
  const r = await testarChaveGemini(chave as string);
  voltar(r.ok ? "teste_ok" : "erro", name, r.mensagem);
}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { lerAlvoHyperframes, salvarAlvoHyperframes, testarHyperframes, type HfModo } from "@/lib/hyperframes-config";

function voltar(resultado: "salvo" | "teste_ok" | "erro", msg?: string): never {
  const q = new URLSearchParams({ hf: resultado });
  if (msg) q.set("hfmsg", msg);
  revalidatePath("/settings");
  revalidatePath("/studio");
  redirect(`/settings?${q.toString()}#hyperframes`);
}

export async function salvarHyperframesAction(formData: FormData) {
  const modo = String(formData.get("modo") ?? "") as HfModo;
  try {
    await salvarAlvoHyperframes(modo, String(formData.get("url") ?? ""));
  } catch (err) {
    voltar("erro", err instanceof Error ? err.message : "Não foi possível salvar.");
  }
  voltar("salvo", modo === "remoto" ? "Agora o Vincere usa o HyperFrames do seu servidor." : "Agora o Vincere usa o HyperFrames deste computador.");
}

/** Testa o endereço digitado (ou, se vazio, o que está salvo). */
export async function testarHyperframesAction(formData: FormData) {
  const digitado = String(formData.get("url") ?? "").trim();
  const alvo = await lerAlvoHyperframes();
  const url = digitado || alvo.urls[0] || "";
  const r = await testarHyperframes(url);
  const detalhe = r.ok ? ` Versão ${r.versao ?? "?"}${r.projeto ? `, projeto ${r.projeto}` : ""}.` : "";
  voltar(r.ok ? "teste_ok" : "erro", `${r.mensagem}${detalhe}`);
}

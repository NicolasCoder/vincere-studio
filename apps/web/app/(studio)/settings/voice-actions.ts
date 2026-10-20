"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@vincere-studio/db";

const EQUIVALENTS: Record<string, string> = {
  // voz Gemini → equivalente Edge (mesmo gênero/energia)
  Charon: "pt-BR-AntonioNeural", Orus: "pt-BR-AntonioNeural", Fenrir: "pt-BR-MacerioMultilingualNeural", Enceladus: "pt-BR-AntonioNeural", Puck: "pt-BR-MacerioMultilingualNeural",
  Kore: "pt-BR-FranciscaNeural", Aoede: "pt-BR-ThalitaNeural", Leda: "pt-BR-ThalitaNeural",
};

export async function createVoiceProfile(formData: FormData) {
  const provider = String(formData.get("provider") ?? "GEMINI_TTS");
  const voiceId = String(formData.get("voiceId") ?? "Charon");
  const fallbackVoice = String(formData.get("fallbackVoiceId") ?? "").trim();
  const fallbacks =
    provider === "GEMINI_TTS" ? [{ provider: "EDGE_TTS", voiceId: fallbackVoice || EQUIVALENTS[voiceId] || "pt-BR-AntonioNeural" }]
    : provider === "ELEVENLABS" ? [{ provider: "GEMINI_TTS", voiceId: fallbackVoice || "Charon" }, { provider: "EDGE_TTS", voiceId: "pt-BR-AntonioNeural" }]
    : [{ provider: "GEMINI_TTS", voiceId: fallbackVoice || "Charon" }];
  const isDefault = formData.get("isDefault") === "on";
  if (isDefault) await prisma.voiceProfile.updateMany({ data: { isDefault: false } });
  await prisma.voiceProfile.create({
    data: { name: String(formData.get("name") ?? "Nova voz"), provider, voiceId, style: String(formData.get("style") ?? ""), rate: Number(formData.get("rate") ?? 1) || 1, fallbacks: JSON.stringify(fallbacks), isDefault },
  });
  revalidatePath("/settings");
}
export async function setDefaultVoiceProfile(id: string) {
  await prisma.voiceProfile.updateMany({ data: { isDefault: false } });
  await prisma.voiceProfile.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/settings");
}
export async function deleteVoiceProfile(id: string) {
  await prisma.project.updateMany({ where: { voiceProfileId: id }, data: { voiceProfileId: null } });
  await prisma.voiceProfile.delete({ where: { id } });
  revalidatePath("/settings");
}

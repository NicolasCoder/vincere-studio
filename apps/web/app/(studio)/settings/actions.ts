"use server";
import { revalidatePath } from "next/cache";
import { disconnectYoutube } from "@vincere-studio/providers";

export async function disconnectYoutubeAction() {
  await disconnectYoutube();
  revalidatePath("/settings");
}

"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@docupulse/db";

/** Tenta extrair nome/avatar do canal via meta tags og: da própria página pública — sem API/chave. */
async function fetchChannelMeta(url: string): Promise<{ name?: string; avatarUrl?: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) });
    const html = await res.text();
    const name = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    const avatarUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    return { name: name ? decodeHtml(name) : undefined, avatarUrl };
  } catch {
    return {};
  }
}
function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function addReference(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const niche = String(formData.get("niche") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!url || !niche) return;
  const meta = await fetchChannelMeta(url);
  await prisma.referenceChannel.create({ data: { url, niche, notes, name: meta.name ?? null, avatarUrl: meta.avatarUrl ?? null } });
  revalidatePath("/references");
}

export async function deleteReference(id: string) {
  await prisma.referenceChannel.delete({ where: { id } });
  revalidatePath("/references");
}

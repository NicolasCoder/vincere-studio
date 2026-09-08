import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { storageRoot, relPath } from "@docupulse/providers";

/** Upload de imagem de referência para um node do Workflow Studio (Avatar/Produto). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  const nodeId = String(form.get("nodeId") ?? "node");
  if (!(file instanceof File)) return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "envie uma imagem" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const dir = path.join(storageRoot(), "workflows", id, "refs");
  await mkdir(dir, { recursive: true });
  const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(dir, `${safeNodeId}-${Date.now()}.${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buf);

  return NextResponse.json({ imageUrl: relPath(filePath) });
}

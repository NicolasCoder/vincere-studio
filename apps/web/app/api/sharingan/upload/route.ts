import path from "node:path";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { storageRoot } from "@vincere-studio/providers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const uploadDir = path.join(storageRoot(), "sharingan-uploads", `batch-${Date.now()}`);
    await fs.mkdir(uploadDir, { recursive: true });

    const savedFiles: { name: string; path: string; type: string; size: number }[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fullPath = path.join(uploadDir, safeName);
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(fullPath, buf);
      savedFiles.push({
        name: file.name,
        path: fullPath,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
    }

    return NextResponse.json({
      ok: true,
      uploadDir,
      files: savedFiles,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Falha ao salvar arquivos." },
      { status: 500 },
    );
  }
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { gerarEnvExemploZerado } from "@vincere-studio/providers";

export const dynamic = "force-dynamic";

function localizarEnvExample(): string | null {
  const candidatos = [
    path.resolve(process.cwd(), ".env.example"),
    path.resolve(process.cwd(), "..", "..", ".env.example"),
  ];
  for (const c of candidatos) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function GET() {
  const arquivo = localizarEnvExample();
  const bruto = arquivo
    ? readFileSync(arquivo, "utf8")
    : [
        '# Configuração inicial zerada — Vincere Studio',
        'DATABASE_URL="file:../../../storage/docupulse.db"',
        'STORAGE_DIR="./storage"',
        'GEMINI_API_KEY=""',
        'PEXELS_API_KEY=""',
        'PIXABAY_API_KEY=""',
        'ELEVENLABS_API_KEY=""',
        "",
      ].join("\n");

  const limpo = gerarEnvExemploZerado(bruto);

  return new NextResponse(limpo, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename=".env.example"',
      "Cache-Control": "no-store",
    },
  });
}

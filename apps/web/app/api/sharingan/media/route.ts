import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { pastaReelsTools } from "@/lib/pastas";

export const dynamic = "force-dynamic";

// Pastas de onde esta rota pode servir arquivos. REELS_TOOLS_DIR aponta para a pasta do reels_tools da instância.
const ALLOWED_ROOTS = [
  ...[pastaReelsTools(), process.env.REELS_TOOLS_DIR]
    .filter((d): d is string => Boolean(d) && fs.existsSync(d as string))
    .map((d) => d.replace(/\\/g, "/")),
  path.resolve(process.cwd(), "../../storage").replace(/\\/g, "/"),
  path.resolve(process.cwd(), "storage").replace(/\\/g, "/"),
];

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function isAllowedFile(resolvedPath: string): boolean {
  const normalized = path.resolve(resolvedPath).replace(/\\/g, "/").toLowerCase();
  return ALLOWED_ROOTS.some((root) => normalized.startsWith(root.toLowerCase()));
}

/**
 * Rewrites relative asset links inside standalone HTML stage files (such as
 * `assets/london_trip.jpg`) so they resolve cleanly via `/api/sharingan/media?path=...`
 * when rendered inside an iframe in Vincere Studio.
 */
function rewriteStageHtmlAssets(html: string, htmlFilePath: string): string {
  const htmlDir = path.dirname(htmlFilePath);
  const projectRoot = htmlDir.includes("style_lib")
    ? htmlDir.replace(/([\\/]+style_lib[\\/]+[^\\/]+).*$/i, "$1")
    : htmlDir;

  return html.replace(
    /(src|href)=["'](?!https?:\/\/|data:|\/|#)([^"']+)["']/gi,
    (fullMatch, attr: string, relUrl: string) => {
      const candidateA = path.resolve(htmlDir, relUrl);
      const candidateB = path.resolve(projectRoot, relUrl);
      const target = fs.existsSync(candidateA)
        ? candidateA
        : fs.existsSync(candidateB)
          ? candidateB
          : candidateA;
      if (!isAllowedFile(target)) {
        return fullMatch;
      }
      return `${attr}="/api/sharingan/media?path=${encodeURIComponent(target.replace(/\\/g, "/"))}"`;
    },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path");

  if (!rawPath) {
    return NextResponse.json({ error: "Parâmetro 'path' é obrigatório." }, { status: 400 });
  }

  const resolved = path.resolve(rawPath);
  if (!isAllowedFile(resolved)) {
    return NextResponse.json({ error: "Caminho fora dos diretórios permitidos." }, { status: 403 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: "Arquivo de mídia não encontrado." }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const stat = fs.statSync(resolved);

  if (ext === ".html") {
    const rawHtml = fs.readFileSync(resolved, "utf-8");
    const rewritten = rewriteStageHtmlAssets(rawHtml, resolved);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader && (ext === ".mp4" || ext === ".webm" || ext === ".wav" || ext === ".mp3")) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = Number.parseInt(match[1] ?? "0", 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const fd = fs.openSync(resolved, "r");
      const buffer = Buffer.alloc(chunkSize);
      fs.readSync(fd, buffer, 0, chunkSize, start);
      fs.closeSync(fd);

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
        },
      });
    }
  }

  const fileBuffer = fs.readFileSync(resolved);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=60",
    },
  });
}

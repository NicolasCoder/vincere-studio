import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { storageRoot } from "@vincere-studio/providers";

const TYPES: Record<string, string> = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".srt": "application/x-subrip; charset=utf-8" };

/** Serve arquivos da pasta storage (mídia gerada) com suporte a Range para áudio/vídeo. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const root = storageRoot();
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(path.resolve(root))) return new NextResponse("forbidden", { status: 403 });
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(file);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");
  const download = new URL(req.url).searchParams.get("download");
  const headers: Record<string, string> = { "content-type": type, "accept-ranges": "bytes", "cache-control": "no-cache" };
  if (download) headers["content-disposition"] = `attachment; filename="${path.basename(file)}"`;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Number(m[2]) : st.size - 1;
    headers["content-range"] = `bytes ${start}-${end}/${st.size}`;
    headers["content-length"] = String(end - start + 1);
    return new NextResponse(Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream, { status: 206, headers });
  }
  headers["content-length"] = String(st.size);
  return new NextResponse(Readable.toWeb(createReadStream(file)) as unknown as ReadableStream, { status: 200, headers });
}

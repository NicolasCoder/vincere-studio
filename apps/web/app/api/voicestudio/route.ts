import { NextResponse } from "next/server";

const VOICESTUDIO_URL = process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900";
// A chave fica só no .env (nunca no código): OMNIVOICE_API_KEY.
const OMNIVOICE_API_KEY = process.env.OMNIVOICE_API_KEY || "";

async function postRpc(
  endpoint: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const rawText = await res.text();
  const sessionId = res.headers.get("mcp-session-id");

  if (!res.ok) {
    throw new Error(`VoiceStudio ${res.status}: ${rawText.slice(0, 300)}`);
  }

  const dataLine = rawText.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const json = JSON.parse(dataLine ? dataLine.slice(5).trim() : rawText);

  if (json.error) {
    throw new Error(`Erro do VoiceStudio: ${JSON.stringify(json.error)}`);
  }

  return { json, sessionId };
}

function parsePythonDictList(raw: string) {
  try {
    // Procura por blocos que parecem dicionários Python
    const matches = raw.match(/'id':\s*'([^']+)'/g);
    if (!matches) return [];

    // Extrai propriedades conhecidas com regex segura
    const items = raw.split(/,\s*\{'id':/);
    return items.map((chunk, idx) => {
      const fixedChunk = idx > 0 ? "{'id':" + chunk : chunk;
      const getId = fixedChunk.match(/'id':\s*'([^']+)'/)?.[1] || "";
      const getName = fixedChunk.match(/'name':\s*'([^']+)'/)?.[1] || "Sem Nome";
      const getRefText = fixedChunk.match(/'ref_text':\s*['"](.+?)['"],\s*'instruct'/s)?.[1] || "";
      const getLang = fixedChunk.match(/'language':\s*'([^']+)'/)?.[1] || "pt";
      const getAudioUrl = fixedChunk.match(/'audio_url':\s*'([^']+)'/)?.[1] || "";
      const getKind = fixedChunk.match(/'kind':\s*'([^']+)'/)?.[1] || "clone";

      return {
        id: getId,
        name: getName,
        ref_text: getRefText,
        language: getLang,
        kind: getKind,
        audio_url: getAudioUrl,
        // O navegador não alcança a porta 3900; o áudio passa pelo proxy desta rota.
        full_audio_url: getAudioUrl ? `/api/voicestudio?audio=${encodeURIComponent(getAudioUrl)}` : null,
      };
    }).filter((v) => v.id);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const audio = new URL(req.url).searchParams.get("audio");
  if (audio) return proxyAudio(audio);
  if (!OMNIVOICE_API_KEY) {
    return NextResponse.json(
      { ok: false, tunnelOnline: false, error: "OMNIVOICE_API_KEY ausente no .env do servidor." },
      { status: 500 }
    );
  }
  try {
    const baseHeaders = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${OMNIVOICE_API_KEY}`,
      host: "127.0.0.1:3900",
    };

    // 1. Handshake Initialize
    const initRes = await postRpc(
      `${VOICESTUDIO_URL}/mcp/`,
      baseHeaders,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vincere-studio-web", version: "2.0.0" },
        },
      }
    );

    const sessionId = initRes.sessionId;
    const callHeaders: Record<string, string> = { ...baseHeaders };
    if (sessionId) {
      callHeaders["mcp-session-id"] = sessionId;
    }

    // 2. Notificação Initialized
    await fetch(`${VOICESTUDIO_URL}/mcp/`, {
      method: "POST",
      headers: callHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }),
      cache: "no-store",
    });

    // 3. Chamada da ferramenta list_voices
    const callRes = await postRpc(
      `${VOICESTUDIO_URL}/mcp/`,
      callHeaders,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "list_voices",
          arguments: {},
        },
      }
    );

    const textContent = (callRes.json.result?.content || [])
      .filter((c: { type: string; text?: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text)
      .join("\n");

    const voices = parsePythonDictList(textContent);

    return NextResponse.json({
      ok: true,
      tunnelOnline: true,
      voices,
      vps: "143.95.167.129",
      tunnelPort: 3900,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        tunnelOnline: false,
        error: message,
        vps: "143.95.167.129",
        tunnelPort: 3900,
      },
      { status: 502 }
    );
  }
}

async function proxyAudio(audioPath: string) {
  // Só caminhos relativos do próprio VoiceStudio; nada de URL arbitrária.
  if (!audioPath.startsWith("/") || audioPath.startsWith("//") || audioPath.includes("..")) {
    return new NextResponse("Caminho de áudio inválido", { status: 400 });
  }
  const res = await fetch(`${VOICESTUDIO_URL}${audioPath}`, {
    headers: { authorization: `Bearer ${OMNIVOICE_API_KEY}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok || !res.body) {
    return new NextResponse("Áudio indisponível no VoiceStudio", { status: res?.status ?? 502 });
  }
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "audio/wav",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// A síntese pelo VoiceStudio ainda não foi ligada aqui: responder claro em vez de 405 mudo.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Síntese pelo VoiceStudio ainda não está ligada nesta tela. Gere a narração pelo projeto (Projetos → Roteiro → Narração).",
    },
    { status: 501 }
  );
}

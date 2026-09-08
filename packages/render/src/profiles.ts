export interface RenderProfile {
  id: "YOUTUBE_1080" | "SHORTS_1080x1920" | "WEB_720";
  label: string;
  width: number;
  height: number;
  fps: number;
  crf: number;
  preset: string;
  audioBitrate: string;
  description: string;
}

export const PROFILES: Record<RenderProfile["id"], RenderProfile> = {
  YOUTUBE_1080: { id: "YOUTUBE_1080", label: "YouTube 1080p", width: 1920, height: 1080, fps: 30, crf: 20, preset: "medium", audioBitrate: "192k", description: "H.264 · 1080p30 · áudio -14 LUFS" },
  SHORTS_1080x1920: { id: "SHORTS_1080x1920", label: "Shorts 1080×1920", width: 1080, height: 1920, fps: 30, crf: 20, preset: "medium", audioBitrate: "192k", description: "H.264 · vertical · legendas grandes" },
  WEB_720: { id: "WEB_720", label: "Web 720p (rascunho)", width: 1280, height: 720, fps: 30, crf: 24, preset: "veryfast", audioBitrate: "128k", description: "Rápido, para revisão" },
};

export function profileFor(format: string, requested?: string | null): RenderProfile {
  if (requested && requested in PROFILES) return PROFILES[requested as RenderProfile["id"]];
  return format === "SHORT_9_16" ? PROFILES.SHORTS_1080x1920 : PROFILES.YOUTUBE_1080;
}

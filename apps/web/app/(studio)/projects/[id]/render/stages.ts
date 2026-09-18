export const RENDER_STAGES = [
  ["Áudio & Ducking", "Concatenação das locuções, trilha com ducking e normalização -14 LUFS", 68],
  ["Composição", "Ken Burns nas imagens, vídeos de acervo em loop, cartões de título e dissolves", 65],
  ["Legendas", "ASS gerado a partir das palavras alinhadas (rodapé no 16:9, karaokê no 9:16)", 80],
  ["Codificação", "H.264 via Intel QuickSync quando disponível, senão libx264 · MP4 faststart", 100],
] as const;

import { loadFont } from "@remotion/google-fonts/Poppins";

/**
 * Fonte embutida no bundle, não a do sistema operacional — "Segoe UI" só existe de verdade no
 * Windows; num servidor de render (ou no Mac de alguém) o texto sai com outra fonte qualquer e o
 * vídeo muda de cara sem ninguém pedir. Poppins Black é a família mais próxima do peso/geometria
 * que já estava cravado.
 */
export const { fontFamily: fonteClipe } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
});

// PIN de acesso pela rede Wi-Fi (LAN_PIN no .env). Compartilhado entre o middleware e /api/entrar.
export const LAN_COOKIE = "vincere_lan";

export async function pinHash(pin: string) {
  const data = new TextEncoder().encode(`vincere:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

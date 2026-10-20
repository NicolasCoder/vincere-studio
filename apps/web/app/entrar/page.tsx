import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string; volta?: string }> }) {
  const { erro, volta } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-void p-6">
      <form action="/api/entrar" method="post" className="w-full max-w-xs space-y-4 rounded-2xl border border-line bg-surface-low p-6 text-center">
        <Image src="/vincere-mark.png" alt="" width={48} height={48} className="mx-auto size-12 object-contain" />
        <div>
          <h1 className="font-display text-lg font-bold text-fg">Vincere Studio</h1>
          <p className="mt-1 text-xs text-muted">Acesso pela rede Wi-Fi. Digite o PIN do estúdio.</p>
        </div>
        <input type="hidden" name="volta" value={volta ?? "/dashboard"} />
        <input
          name="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder="PIN"
          className="field h-12 w-full text-center font-mono text-xl tracking-[0.4em]"
        />
        {erro && <p className="text-xs text-error">PIN incorreto.</p>}
        <button type="submit" className="gradient-cta h-11 w-full rounded font-display font-semibold text-fg">
          Entrar
        </button>
      </form>
    </main>
  );
}

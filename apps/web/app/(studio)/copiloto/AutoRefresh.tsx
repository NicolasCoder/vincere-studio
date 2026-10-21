"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarrega os dados da esteira enquanto algum job do projeto está rodando. */
export function AutoRefresh({ ativo, ms = 3000 }: { ativo: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [ativo, ms, router]);
  return null;
}

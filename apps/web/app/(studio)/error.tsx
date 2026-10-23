"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button, Card, Icon } from "@vincere-studio/ui";
import { acionarAutoHealing, AUTO_HEAL_RESOLVED_EVENT } from "@/components/AutoHealingMonitor";

export default function StudioErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    acionarAutoHealing({
      subsystem: pathname?.includes("/studio") ? "hyperframes" : "api_runtime",
      titulo: `Erro de renderização em ${pathname || "tela do estúdio"}`,
      detalheErro: error.message || "Falha inesperada na renderização da rota",
      pagina: pathname || "/dashboard",
    });

    const onResolved = () => {
      reset();
    };
    window.addEventListener(AUTO_HEAL_RESOLVED_EVENT, onResolved);
    return () => window.removeEventListener(AUTO_HEAL_RESOLVED_EVENT, onResolved);
  }, [error, pathname, reset]);

  return (
    <div className="grid min-h-[70vh] place-items-center p-6">
      <Card className="max-w-lg p-6 text-center space-y-4 border-primary/30" elevated>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/40 bg-primary/15 text-primary-bright">
          <Icon name="auto_fix_high" className="text-[28px] animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-bold text-fg">
            Auto-Healing ativado para esta tela
          </h2>
          <p className="text-xs text-muted leading-relaxed">
            Detectamos um problema inesperado ({error.message || "erro de execução"}). O sistema de Auto-Healing já acionou sua IA/Agente para diagnosticar e restaurar o estado.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="primary" size="sm" icon="refresh" onClick={() => reset()}>
            Recarregar Tela Agora
          </Button>
        </div>
      </Card>
    </div>
  );
}

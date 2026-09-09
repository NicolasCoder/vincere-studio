"use client";
import { useRef, useTransition } from "react";
import { Icon } from "@docupulse/ui";

/** Botão compacto: clica, escolhe o arquivo (imagem/vídeo do Flow) e sobe na hora, sem precisar da pasta inbox. */
export function SceneUpload({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form ref={formRef} action={(fd) => startTransition(() => action(fd))} className="inline-flex">
      <label className={`flex cursor-pointer items-center gap-1 font-mono text-[9px] ${pending ? "text-primary-bright" : "text-muted hover:text-primary-bright"}`}>
        <Icon name={pending ? "hourglass_top" : "upload"} className="text-[12px]" />
        {pending ? "enviando…" : "enviar imagem"}
        <input type="file" name="file" accept="image/*,video/*" className="hidden" disabled={pending} onChange={() => formRef.current?.requestSubmit()} />
      </label>
    </form>
  );
}

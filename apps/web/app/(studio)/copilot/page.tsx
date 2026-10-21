import { redirect } from "next/navigation";

// O antigo "Roteiro em beats" (protótipo com beats fixos) foi absorvido pela esteira do Copiloto.
export default function CopilotLegado() {
  redirect("/copiloto?etapa=2");
}

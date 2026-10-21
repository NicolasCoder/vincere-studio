import { redirect } from "next/navigation";

// A saúde da VPS e as rotinas de limpeza ficam no Console Admin (scripts/admin), fora da web.
export default function Saude() {
  redirect("/dashboard");
}

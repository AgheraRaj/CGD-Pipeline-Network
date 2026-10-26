import { requireSession } from "@/lib/session";

export async function SessionGate({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <>{children}</>;
}
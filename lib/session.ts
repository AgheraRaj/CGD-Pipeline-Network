import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Cached per request, so several components can call it without extra database reads.
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
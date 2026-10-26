import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

// If a valid session already exists, skip the form.
async function RedirectIfSignedIn() {
  const session = await getSession();
  if (session) redirect("/overview");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <LoginForm />
    </main>
  );
}
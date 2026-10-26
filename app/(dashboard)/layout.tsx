import { Suspense } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionGate } from "@/components/session-gate";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="md:h-[calc(100svh-1rem)] md:overflow-hidden">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <SessionGate>{children}</SessionGate>
          </Suspense>
        </main>
        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
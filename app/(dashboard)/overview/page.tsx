import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Network summary for all geographical areas"
      />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-xl border border-dashed p-10 text-sm">
        Network metrics and charts are added in the dashboard phase.
      </div>
    </>
  );
}
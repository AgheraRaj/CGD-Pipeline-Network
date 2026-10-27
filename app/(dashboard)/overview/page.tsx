import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { PageHeader } from "@/components/page-header";
import { PageNavLinks } from "@/components/page-nav-links";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Key figures, alerts and recent activity across the CGD network"
        actions={<PageNavLinks current="/overview" />}
      />
      <OverviewDashboard />
    </>
  );
}

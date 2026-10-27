import type { Metadata } from "next";
import { NetworkDashboard } from "@/components/network/network-dashboard";
import { PageHeader } from "@/components/page-header";
import { PageNavLinks } from "@/components/page-nav-links";

export const metadata: Metadata = { title: "Map view" };

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Map view"
        description="Geographical areas, pipeline routes and assets across the CGD network"
        actions={<PageNavLinks current="/map" />}
      />
      <NetworkDashboard />
    </>
  );
}
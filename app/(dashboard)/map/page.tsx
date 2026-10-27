import type { Metadata } from "next";
import { NetworkDashboard } from "@/components/network/network-dashboard";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Map view" };

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Map view"
        description="Geographical areas, pipeline routes and assets across the CGD network"
      />
      <NetworkDashboard />
    </>
  );
}
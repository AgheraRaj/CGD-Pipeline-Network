"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ReportFaultDialog } from "@/components/faults/report-fault-dialog";
import { AssetDetailCard } from "@/components/network/asset-detail-card";
import { NetworkSidePanel } from "@/components/network/network-side-panel";
import { NetworkStatsBar } from "@/components/network/network-stats-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFaults } from "@/hooks/use-faults";
import { faultToProperties } from "@/lib/faults/geojson";
import type { FaultReportDto } from "@/lib/faults/types";
import { getAssetDetails, type AssetDetails } from "@/lib/network/asset-details";
import { ALL_AREAS, getNetworkSummary } from "@/lib/network/dummy-data";
import type { NetworkLayerId } from "@/lib/network/types";

// MapLibre needs the browser, so it is loaded on the client only.
const NetworkMap = dynamic(
  () => import("@/components/network/network-map").then((module) => module.NetworkMap),
  { ssr: false, loading: () => <Skeleton className="absolute inset-0 rounded-none" /> }
);

const initialVisibleLayers: Record<NetworkLayerId, boolean> = {
  steel: true,
  mdpe: true,
  cgs: true,
  industrial: true,
  faults: true,
};

export type MapFocusRequest = {
  id: string;
  longitude: number;
  latitude: number;
};

export function NetworkDashboard() {
  const [selection, setSelection] = useState(ALL_AREAS);
  const [visibleLayers, setVisibleLayers] = useState(initialVisibleLayers);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetails | null>(null);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);

  const { faults, status: faultsStatus, retry: retryFaults, addFault } = useFaults();

  const summary = useMemo(() => getNetworkSummary(selection), [selection]);
  const openFaultCount = useMemo(
    () => faults.filter((fault) => fault.status !== "RESOLVED").length,
    [faults]
  );

  function handleLayerToggle(layerId: NetworkLayerId, isVisible: boolean) {
    setVisibleLayers((current) => ({ ...current, [layerId]: isVisible }));
  }

  // After reporting, make sure the fault layer is on, then fly to the new marker.
  function handleViewFaultOnMap(fault: FaultReportDto) {
    setVisibleLayers((current) => ({ ...current, faults: true }));
    setSelectedAsset(getAssetDetails("faults", { ...faultToProperties(fault) }));
    setFocusRequest({ id: fault.id, longitude: fault.longitude, latitude: fault.latitude });
  }

  return (
    <div className="flex min-h-[36rem] flex-1 flex-col overflow-hidden rounded-xl border lg:flex-row">
      <NetworkSidePanel
        selection={selection}
        onSelectionChange={setSelection}
        visibleLayers={visibleLayers}
        onLayerToggle={handleLayerToggle}
        summary={summary}
        openFaultCount={openFaultCount}
      />

      <div className="relative min-h-[28rem] flex-1">
        <NetworkMap
          selection={selection}
          visibleLayers={visibleLayers}
          faults={faults}
          focusRequest={focusRequest}
          onSelectAsset={setSelectedAsset}
        />

        <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2">
          <NetworkStatsBar summary={summary} />
          <ReportFaultDialog onReported={addFault} onViewOnMap={handleViewFaultOnMap} />
        </div>

        {selectedAsset ? (
          <AssetDetailCard asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
        ) : null}

        {faultsStatus === "error" ? (
          <Alert variant="destructive" className="absolute bottom-10 left-3 z-10 max-w-sm">
            <AlertDescription className="flex items-center justify-between gap-3">
              Reported faults could not be loaded.
              <Button size="sm" variant="outline" onClick={retryFaults}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
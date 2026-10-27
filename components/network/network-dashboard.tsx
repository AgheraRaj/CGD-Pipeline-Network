"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReportFaultDialog } from "@/components/faults/report-fault-dialog";
import { AssetDetailCard } from "@/components/network/asset-detail-card";
import { NetworkSidePanel } from "@/components/network/network-side-panel";
import { NetworkStatsBar } from "@/components/network/network-stats-bar";
import { DeletePipelineDialog } from "@/components/pipelines/delete-pipeline-dialog";
import { PipelineFormDialog } from "@/components/pipelines/pipeline-form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFaults } from "@/hooks/use-faults";
import { usePipelines } from "@/hooks/use-pipelines";
import { faultToProperties } from "@/lib/faults/geojson";
import type { FaultReportDto } from "@/lib/faults/types";
import {
  getAssetDetails,
  getPipelineDetails,
  type AssetDetails,
} from "@/lib/network/asset-details";
import type { DeviceLocation } from "@/hooks/use-device-location";
import { buildConsumerConnections } from "@/lib/network/connections";
import {
  ALL_AREAS,
  getIndustrialConsumers,
  getNetworkSummary,
  pipelineRoutes,
} from "@/lib/network/dummy-data";
import { getBounds } from "@/lib/network/geo";
import type { LngLat, NetworkLayerId } from "@/lib/network/types";
import { getPipelineSummary } from "@/lib/pipelines/summary";
import type { PipelineDto } from "@/lib/pipelines/types";

// MapLibre needs the browser, so it is loaded on the client only.
const NetworkMap = dynamic(
  () => import("@/components/network/network-map").then((module) => module.NetworkMap),
  { ssr: false, loading: () => <Skeleton className="absolute inset-0 rounded-none" /> }
);

const initialVisibleLayers: Record<NetworkLayerId, boolean> = {
  steel: true,
  mdpe: true,
  pipelines: true,
  flow: true,
  connections: true,
  cgs: true,
  industrial: true,
  faults: true,
};

export type MapFocusRequest = {
  id: string;
  longitude: number;
  latitude: number;
  bounds?: [LngLat, LngLat];
};

function pipelineFocusRequest(pipeline: PipelineDto): MapFocusRequest {
  return {
    // A fresh id each time, so asking to show the same pipeline twice still moves the map.
    id: `${pipeline.id}:${Date.now()}`,
    longitude: pipeline.startLongitude,
    latitude: pipeline.startLatitude,
    bounds: getBounds(pipeline.routeCoordinates),
  };
}

export function NetworkDashboard() {
  const [selection, setSelection] = useState(ALL_AREAS);
  const [visibleLayers, setVisibleLayers] = useState(initialVisibleLayers);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetails | null>(null);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const [isPipelineFormOpen, setIsPipelineFormOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineDto | null>(null);
  const [deletingPipeline, setDeletingPipeline] = useState<PipelineDto | null>(null);

  const { faults, status: faultsStatus, retry: retryFaults, addFault } = useFaults();
  const {
    pipelines,
    status: pipelinesStatus,
    retry: retryPipelines,
    createPipeline,
    updatePipeline,
    deletePipeline,
  } = usePipelines();

  const summary = useMemo(() => getNetworkSummary(selection), [selection]);
  const pipelineSummary = useMemo(
    () => getPipelineSummary(pipelines, selection),
    [pipelines, selection]
  );
  // Which line supplies each industrial consumer. Recalculated when pipelines change.
  const connections = useMemo(
    () => buildConsumerConnections(getIndustrialConsumers(), pipelineRoutes, pipelines),
    [pipelines]
  );
  const connectedConsumerCount = useMemo(() => {
    const counts = Object.entries(connections.summary)
      .filter(([code]) => selection === ALL_AREAS || code === selection)
      .map(([, area]) => area.connected + area.interrupted);
    return counts.reduce((total, count) => total + count, 0);
  }, [connections, selection]);
  const [userLocation, setUserLocation] = useState<DeviceLocation | null>(null);

  const openFaultCount = useMemo(
    () => faults.filter((fault) => fault.status !== "RESOLVED").length,
    [faults]
  );

  // A selected pipeline is always shown from the latest data, so edits made here or by
  // someone else update the open card, and a deleted pipeline closes it.
  const selectedPipeline = selectedAsset?.pipelineId
    ? (pipelines.find((pipeline) => pipeline.id === selectedAsset.pipelineId) ?? null)
    : null;
  const displayedAsset = selectedAsset?.pipelineId
    ? selectedPipeline
      ? getPipelineDetails(selectedPipeline)
      : null
    : selectedAsset;

  function handleLayerToggle(layerId: NetworkLayerId, isVisible: boolean) {
    setVisibleLayers((current) => ({ ...current, [layerId]: isVisible }));
  }

  // After reporting, make sure the fault layer is on, then fly to the new marker.
  function handleViewFaultOnMap(fault: FaultReportDto) {
    setVisibleLayers((current) => ({ ...current, faults: true }));
    setSelectedAsset(getAssetDetails("faults", { ...faultToProperties(fault) }));
    setFocusRequest({ id: fault.id, longitude: fault.longitude, latitude: fault.latitude });
  }

  function showPipeline(pipeline: PipelineDto) {
    setVisibleLayers((current) => ({ ...current, pipelines: true }));
    setSelectedAsset(getPipelineDetails(pipeline));
    setFocusRequest(pipelineFocusRequest(pipeline));
  }

  // Opened from the Pipelines page with ?pipeline=<id>: show it once the data has loaded.
  const handledLinkRef = useRef(false);
  useEffect(() => {
    if (handledLinkRef.current || pipelinesStatus !== "ready") return;
    handledLinkRef.current = true;
    const id = new URLSearchParams(window.location.search).get("pipeline");
    const pipeline = id ? pipelines.find((item) => item.id === id) : undefined;
    if (!pipeline) return;
    // Deferred so the map has mounted before it is asked to move.
    const timer = window.setTimeout(() => showPipeline(pipeline), 0);
    return () => window.clearTimeout(timer);
  }, [pipelinesStatus, pipelines]);

  function openAddPipeline() {
    setEditingPipeline(null);
    setIsPipelineFormOpen(true);
  }

  return (
    <div className="flex min-h-[36rem] flex-1 flex-col overflow-hidden rounded-xl border lg:flex-row">
      <NetworkSidePanel
        selection={selection}
        onSelectionChange={setSelection}
        visibleLayers={visibleLayers}
        onLayerToggle={handleLayerToggle}
        summary={summary}
        pipelineSummary={pipelineSummary}
        connectedConsumerCount={connectedConsumerCount}
        openFaultCount={openFaultCount}
      />

      <div className="relative min-h-[28rem] flex-1">
        <NetworkMap
          selection={selection}
          visibleLayers={visibleLayers}
          faults={faults}
          pipelines={pipelines}
          selectedPipelineId={selectedPipeline?.id ?? null}
          connections={connections}
          userLocation={userLocation}
          focusRequest={focusRequest}
          onSelectAsset={setSelectedAsset}
        />

        <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2">
          <NetworkStatsBar summary={summary} pipelineSummary={pipelineSummary} />
          <Button size="sm" variant="secondary" className="shadow-sm" onClick={openAddPipeline}>
            <Plus className="size-4" />
            Add pipeline
          </Button>
          <ReportFaultDialog
            pipelines={pipelines}
            onLocation={setUserLocation}
            onReported={addFault}
            onViewOnMap={handleViewFaultOnMap}
          />
        </div>

        {displayedAsset ? (
          <AssetDetailCard
            asset={displayedAsset}
            onClose={() => setSelectedAsset(null)}
            actions={
              selectedPipeline ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingPipeline(selectedPipeline);
                      setIsPipelineFormOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setDeletingPipeline(selectedPipeline)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </>
              ) : null
            }
          />
        ) : null}

        <div className="absolute bottom-10 left-3 z-10 flex max-w-sm flex-col gap-2">
          {faultsStatus === "error" ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                Reported faults could not be loaded.
                <Button size="sm" variant="outline" onClick={retryFaults}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {pipelinesStatus === "error" ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                Registered pipelines could not be loaded.
                <Button size="sm" variant="outline" onClick={retryPipelines}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      <PipelineFormDialog
        open={isPipelineFormOpen}
        onOpenChange={setIsPipelineFormOpen}
        pipeline={editingPipeline}
        defaultGaCode={selection === ALL_AREAS ? "" : selection}
        existingPipelines={pipelines}
        onCreate={createPipeline}
        onUpdate={updatePipeline}
        onSaved={(pipeline) => {
          setEditingPipeline(null);
          showPipeline(pipeline);
        }}
      />
      <DeletePipelineDialog
        pipeline={deletingPipeline}
        onOpenChange={(open) => {
          if (!open) setDeletingPipeline(null);
        }}
        onConfirm={deletePipeline}
        onDeleted={() => {
          setDeletingPipeline(null);
          setSelectedAsset(null);
        }}
      />
    </div>
  );
}

import type { FaultReportDto } from "@/lib/faults/types";
import {
  ALL_AREAS,
  cityGateStations,
  geographicalAreas,
  getGeographicalArea,
  getNetworkSummary,
} from "@/lib/network/dummy-data";
import { distanceKm } from "@/lib/network/geo";
import { pipelineStatuses, type PipelineStatusValue } from "@/lib/pipelines/constants";
import { filterPipelinesBySelection, getPipelineSummary } from "@/lib/pipelines/summary";
import type { PipelineDto } from "@/lib/pipelines/types";

// Faults are stored with coordinates only, so they are matched to the area they fall in.
// Areas are drawn as rough circles, so a small margin covers points near the boundary.
export function getAreaCodeForPoint(longitude: number, latitude: number): string | null {
  let best: { code: string; distance: number } | null = null;
  for (const area of geographicalAreas) {
    const distance = distanceKm(area.center, [longitude, latitude]);
    if (distance <= area.radiusKm * 1.15 && (!best || distance < best.distance)) {
      best = { code: area.code, distance };
    }
  }
  return best?.code ?? null;
}

export function filterFaultsBySelection(faults: FaultReportDto[], selection: string) {
  if (selection === ALL_AREAS) return faults;
  return faults.filter(
    (fault) => getAreaCodeForPoint(fault.longitude, fault.latitude) === selection
  );
}

export const isOpenFault = (fault: FaultReportDto) => fault.status !== "RESOLVED";

export type AreaBreakdown = {
  code: string;
  name: string;
  steelKm: number;
  mdpeKm: number;
  registeredKm: number;
  totalKm: number;
  domesticConnections: number;
  industrialUnits: number;
  commercialUnits: number;
  cgsCount: number;
  registeredCount: number;
  openFaults: number;
};

export function getAreaBreakdown(
  pipelines: PipelineDto[],
  faults: FaultReportDto[]
): AreaBreakdown[] {
  const openFaults = faults.filter(isOpenFault);
  return geographicalAreas.map((area) => {
    const network = getNetworkSummary(area.code);
    const registered = getPipelineSummary(pipelines, area.code);
    return {
      code: area.code,
      name: area.name,
      steelKm: network.steelKm,
      mdpeKm: network.mdpeKm,
      registeredKm: registered.totalKm,
      totalKm: network.totalKm + registered.totalKm,
      domesticConnections: area.domesticConnections,
      industrialUnits: area.industrialUnits,
      commercialUnits: area.commercialUnits,
      cgsCount: network.cgsCount,
      registeredCount: registered.count,
      openFaults: filterFaultsBySelection(openFaults, area.code).length,
    };
  });
}

export function getOverviewKpis(
  pipelines: PipelineDto[],
  faults: FaultReportDto[],
  selection: string
) {
  const network = getNetworkSummary(selection);
  const registered = getPipelineSummary(pipelines, selection);
  const selectedPipelines = filterPipelinesBySelection(pipelines, selection);
  const openFaults = filterFaultsBySelection(faults, selection).filter(isOpenFault);
  const stations = cityGateStations.filter(
    (station) => selection === ALL_AREAS || station.gaCode === selection
  );

  return {
    network,
    registered,
    notYetBuiltCount: selectedPipelines.filter(
      (pipeline) => pipeline.status === "PLANNED" || pipeline.status === "UNDER_CONSTRUCTION"
    ).length,
    totalKm: network.totalKm + registered.totalKm,
    cgsCapacityScmh: stations.reduce((total, station) => total + station.capacityScmh, 0),
    openFaultCount: openFaults.length,
    criticalFaultCount: openFaults.filter((fault) => fault.severity === "CRITICAL").length,
    highFaultCount: openFaults.filter((fault) => fault.severity === "HIGH").length,
  };
}

export function getPipelineStatusBreakdown(pipelines: PipelineDto[], selection: string) {
  const selected = filterPipelinesBySelection(pipelines, selection);
  return pipelineStatuses.map((status) => {
    const items = selected.filter((pipeline) => pipeline.status === status.value);
    return {
      status: status.value as PipelineStatusValue,
      label: status.label,
      count: items.length,
      km: items.reduce((total, pipeline) => total + pipeline.lengthKm, 0),
    };
  });
}

// ───────────── Alerts ─────────────

export type OverviewAlert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildAlerts(
  pipelines: PipelineDto[],
  faults: FaultReportDto[],
  selection: string,
  now: number
): OverviewAlert[] {
  const alerts: OverviewAlert[] = [];
  const openFaults = filterFaultsBySelection(faults, selection).filter(isOpenFault);
  const areaName = (longitude: number, latitude: number) => {
    const code = getAreaCodeForPoint(longitude, latitude);
    return code ? (getGeographicalArea(code)?.name ?? code) : "Outside GA boundaries";
  };

  for (const fault of openFaults) {
    if (fault.severity === "CRITICAL" || fault.severity === "HIGH") {
      alerts.push({
        id: `fault-${fault.id}`,
        level: fault.severity === "CRITICAL" ? "critical" : "warning",
        title: `${fault.severity === "CRITICAL" ? "Critical" : "High"} fault: ${fault.title}`,
        detail: `${areaName(fault.longitude, fault.latitude)} · reported by ${fault.reportedByName}`,
        href: "/map",
      });
    }
  }

  const unacknowledged = openFaults.filter(
    (fault) => fault.status === "REPORTED" && now - new Date(fault.createdAt).getTime() > DAY_MS
  );
  if (unacknowledged.length > 0) {
    alerts.push({
      id: "faults-unacknowledged",
      level: "warning",
      title: `${unacknowledged.length} fault ${unacknowledged.length === 1 ? "report has" : "reports have"} not been acknowledged for over 24 hours`,
      detail: "Review and acknowledge them so field teams know they are being handled.",
      href: "/map",
    });
  }

  const selected = filterPipelinesBySelection(pipelines, selection);
  const today = new Date(now).toISOString().slice(0, 10);
  for (const pipeline of selected) {
    if (pipeline.status === "UNDER_MAINTENANCE") {
      alerts.push({
        id: `maintenance-${pipeline.id}`,
        level: "info",
        title: `${pipeline.pipelineCode} is under maintenance`,
        detail: `${pipeline.name} · ${getGeographicalArea(pipeline.gaCode)?.name ?? pipeline.gaCode}`,
        href: `/map?pipeline=${encodeURIComponent(pipeline.id)}`,
      });
    }
    const notYetBuilt = pipeline.status === "PLANNED" || pipeline.status === "UNDER_CONSTRUCTION";
    if (notYetBuilt && pipeline.installationDate < today) {
      alerts.push({
        id: `overdue-${pipeline.id}`,
        level: "warning",
        title: `${pipeline.pipelineCode} is past its installation date`,
        detail: `Still marked ${pipeline.status === "PLANNED" ? "planned" : "under construction"}; due ${pipeline.installationDate}. Update the status if it is in service.`,
        href: "/pipelines",
      });
    }
  }

  for (const station of cityGateStations) {
    if (station.status !== "online" && (selection === ALL_AREAS || station.gaCode === selection)) {
      alerts.push({
        id: `cgs-${station.id}`,
        level: "warning",
        title: `${station.name} is under maintenance`,
        detail: `City Gate Station ${station.id}`,
        href: "/map",
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

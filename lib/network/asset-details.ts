import { formatKilometres, formatNumber } from "@/lib/format";
import {
  getFaultSeverityLabel,
  getFaultStatusLabel,
  getFaultTypeLabel,
} from "@/lib/faults/constants";
import {
  getPipelineFlowDirectionLabel,
  getPipelineMaterialLabel,
  getPipelineStatusLabel,
  getPipelineTypeLabel,
} from "@/lib/pipelines/constants";
import { pipelineToProperties } from "@/lib/pipelines/geojson";
import type { PipelineDto } from "@/lib/pipelines/types";
import { getGeographicalArea } from "./dummy-data";

export type AssetDetailRow = {
  label: string;
  value: string;
  tone?: "ok";
};

export type AssetDetails = {
  kindLabel: string;
  title: string;
  rows: AssetDetailRow[];
  photoUrl?: string;
  description?: string;
  // Set for registered pipelines, so the card can offer edit and delete.
  pipelineId?: string;
};

type FeatureProperties = Record<string, unknown> | null;

function areaName(properties: Record<string, unknown>) {
  return getGeographicalArea(String(properties.gaCode))?.name ?? "Unknown";
}

// Turns a clicked map feature into the rows shown in the detail card.
export function getAssetDetails(
  layerId: string,
  properties: FeatureProperties
): AssetDetails | null {
  if (!properties) return null;

  switch (layerId) {
    case "cgs":
      return {
        kindLabel: "CGS",
        title: String(properties.name),
        rows: [
          { label: "Asset ID", value: String(properties.id) },
          { label: "Geographical area", value: areaName(properties) },
          { label: "Capacity", value: `${formatNumber(Number(properties.capacityScmh))} SCMH` },
          { label: "Inlet pressure", value: `${properties.inletBar} bar` },
          { label: "Outlet pressure", value: `${properties.outletBar} bar` },
          { label: "Commissioned", value: String(properties.commissionedYear) },
          {
            label: "Status",
            value: String(properties.status),
            tone: properties.status === "online" ? "ok" : undefined,
          },
        ],
      };

    case "steel-hit":
    case "mdpe-hit":
      return {
        kindLabel: properties.material === "STEEL" ? "Steel trunk main" : "MDPE distribution",
        title: String(properties.name),
        rows: [
          { label: "Asset ID", value: String(properties.id) },
          { label: "Geographical area", value: areaName(properties) },
          { label: "Length", value: formatKilometres(Number(properties.lengthKm)) },
          { label: "Diameter", value: `${properties.diameterMm} mm` },
          { label: "Pressure rating", value: String(properties.pressureRating) },
          { label: "Installed", value: String(properties.installedYear) },
          { label: "Flow", value: "Outward from supply (configured)" },
          { label: "Status", value: "in service", tone: "ok" },
        ],
      };

    case "industrial-points":
      return {
        kindLabel: "Industrial consumer",
        title: String(properties.id),
        rows: [
          { label: "Geographical area", value: areaName(properties) },
          { label: "Connected load", value: `${formatNumber(Number(properties.loadScmh))} SCMH` },
          { label: "Status", value: "active", tone: "ok" },
        ],
      };

    case "faults": {
      const photoUrl = typeof properties.photoUrl === "string" ? properties.photoUrl : "";
      const description = typeof properties.description === "string" ? properties.description : "";
      const accuracy =
        typeof properties.accuracyMeters === "number"
          ? `±${Math.round(properties.accuracyMeters)} m`
          : "Not available";
      const reportedOn = new Date(String(properties.createdAt)).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      return {
        kindLabel: "Reported fault",
        title: String(properties.title),
        photoUrl: photoUrl || undefined,
        description: description || undefined,
        rows: [
          { label: "Report ID", value: `FR-${String(properties.id).slice(-6).toUpperCase()}` },
          { label: "Fault type", value: getFaultTypeLabel(String(properties.faultType)) },
          { label: "Severity", value: getFaultSeverityLabel(String(properties.severity)) },
          {
            label: "Status",
            value: getFaultStatusLabel(String(properties.status)),
            tone: properties.status === "RESOLVED" ? "ok" : undefined,
          },
          { label: "Reported by", value: String(properties.reportedByName) },
          { label: "Reported on", value: reportedOn },
          {
            label: "Location",
            value: `${Number(properties.latitude).toFixed(5)}, ${Number(properties.longitude).toFixed(5)}`,
          },
          { label: "GPS accuracy", value: accuracy },
        ],
      };
    }

    case "pipelines-hit": {
      const description = typeof properties.description === "string" ? properties.description : "";
      const route = typeof properties.routeDescription === "string" ? properties.routeDescription : "";
      const pressure = properties.pressureRatingBar;
      const coordinate = (lat: unknown, lng: unknown) =>
        `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
      return {
        kindLabel: "Registered pipeline",
        title: String(properties.name),
        pipelineId: String(properties.id),
        description: [route, description].filter(Boolean).join(" · ") || undefined,
        rows: [
          { label: "Pipeline ID", value: String(properties.pipelineCode) },
          { label: "Geographical area", value: areaName(properties) },
          { label: "Type", value: getPipelineTypeLabel(String(properties.pipelineType)) },
          { label: "Material", value: getPipelineMaterialLabel(String(properties.material)) },
          { label: "Length", value: formatKilometres(Number(properties.lengthKm)) },
          { label: "Diameter", value: `${formatNumber(Number(properties.diameterMm))} mm` },
          { label: "Depth of cover", value: `${properties.depthM} m` },
          {
            label: "Pressure rating",
            value: typeof pressure === "number" ? `${pressure} bar` : "Not recorded",
          },
          { label: "Installed", value: String(properties.installationDate) },
          { label: "Flow", value: getPipelineFlowDirectionLabel(String(properties.flowDirection)) },
          { label: "Start", value: coordinate(properties.startLatitude, properties.startLongitude) },
          { label: "End", value: coordinate(properties.endLatitude, properties.endLongitude) },
          { label: "Route points", value: String(properties.pointCount) },
          {
            label: "Status",
            value: getPipelineStatusLabel(String(properties.status)),
            tone: properties.status === "OPERATIONAL" ? "ok" : undefined,
          },
        ],
      };
    }

    default:
      return null;
  }
}
export function getPipelineDetails(pipeline: PipelineDto): AssetDetails | null {
  return getAssetDetails("pipelines-hit", { ...pipelineToProperties(pipeline) });
}

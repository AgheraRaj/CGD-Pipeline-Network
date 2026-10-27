import { formatKilometres, formatNumber } from "@/lib/format";
import {
  getFaultSeverityLabel,
  getFaultStatusLabel,
  getFaultTypeLabel,
} from "@/lib/faults/constants";
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

    default:
      return null;
  }
}
import type { Feature, FeatureCollection, Point } from "geojson";
import type { FaultReportDto } from "./types";

export type FaultProperties = {
  id: string;
  title: string;
  description: string;
  faultType: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  createdAt: string;
  reportedByName: string;
  photoUrl: string;
};

// Map feature properties can only hold simple values, so everything is flattened here.
export function faultToProperties(fault: FaultReportDto): FaultProperties {
  return {
    id: fault.id,
    title: fault.title,
    description: fault.description ?? "",
    faultType: fault.faultType,
    severity: fault.severity,
    status: fault.status,
    latitude: fault.latitude,
    longitude: fault.longitude,
    accuracyMeters: fault.accuracyMeters,
    createdAt: fault.createdAt,
    reportedByName: fault.reportedByName,
    photoUrl: fault.photoUrl ?? "",
  };
}

export function buildFaultGeoJson(
  faults: FaultReportDto[]
): FeatureCollection<Point, FaultProperties> {
  const features: Feature<Point, FaultProperties>[] = faults.map((fault) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [fault.longitude, fault.latitude] },
    properties: faultToProperties(fault),
  }));
  return { type: "FeatureCollection", features };
}
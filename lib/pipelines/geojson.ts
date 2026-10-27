import type { Feature, FeatureCollection, LineString } from "geojson";
import type { PipelineDto } from "./types";

export type PipelineProperties = {
  id: string;
  pipelineCode: string;
  name: string;
  description: string;
  material: string;
  pipelineType: string;
  status: string;
  diameterMm: number;
  lengthKm: number;
  depthM: number;
  pressureRatingBar: number | null;
  gaCode: string;
  installationDate: string;
  flowDirection: string;
  routeDescription: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  pointCount: number;
};

// Map feature properties can only hold simple values, so everything is flattened here.
export function pipelineToProperties(pipeline: PipelineDto): PipelineProperties {
  return {
    id: pipeline.id,
    pipelineCode: pipeline.pipelineCode,
    name: pipeline.name,
    description: pipeline.description ?? "",
    material: pipeline.material,
    pipelineType: pipeline.pipelineType,
    status: pipeline.status,
    diameterMm: pipeline.diameterMm,
    lengthKm: pipeline.lengthKm,
    depthM: pipeline.depthM,
    pressureRatingBar: pipeline.pressureRatingBar,
    gaCode: pipeline.gaCode,
    installationDate: pipeline.installationDate,
    flowDirection: pipeline.flowDirection,
    routeDescription: pipeline.routeDescription ?? "",
    startLatitude: pipeline.startLatitude,
    startLongitude: pipeline.startLongitude,
    endLatitude: pipeline.endLatitude,
    endLongitude: pipeline.endLongitude,
    pointCount: pipeline.routeCoordinates.length,
  };
}

export function buildPipelineGeoJson(
  pipelines: PipelineDto[]
): FeatureCollection<LineString, PipelineProperties> {
  const features: Feature<LineString, PipelineProperties>[] = pipelines
    .filter((pipeline) => pipeline.routeCoordinates.length >= 2)
    .map((pipeline) => ({
      type: "Feature",
      id: pipeline.id,
      geometry: { type: "LineString", coordinates: pipeline.routeCoordinates },
      properties: pipelineToProperties(pipeline),
    }));
  return { type: "FeatureCollection", features };
}

import type { Feature, FeatureCollection, LineString } from "geojson";
import type { PipelineDto } from "@/lib/pipelines/types";
import type { LngLat, NetworkGeoJson } from "./types";

export type FlowKind = "steel" | "mdpe" | "pipelines";

export type FlowProperties = { id: string; kind: FlowKind };

// Lines in the flow source always run in the direction gas travels, so arrows and the
// moving dashes can simply follow the line. This is the configured direction from the
// asset records; there is no live flow measurement behind it.
//
// Demo steel and MDPE routes are stored from their source (the City Gate Station or the
// area's supply point) outward, so their drawing order is the flow direction.
// Registered pipelines use their flow-direction setting. Bidirectional lines get no
// arrows, and only operational pipelines carry gas.
export function buildFlowGeoJson(
  routes: NetworkGeoJson["routes"],
  pipelines: PipelineDto[]
): FeatureCollection<LineString, FlowProperties> {
  const demo: Feature<LineString, FlowProperties>[] = routes.features.map((route) => ({
    type: "Feature",
    geometry: route.geometry,
    properties: {
      id: route.properties.id,
      kind: route.properties.material === "STEEL" ? "steel" : "mdpe",
    },
  }));

  const registered: Feature<LineString, FlowProperties>[] = pipelines
    .filter(
      (pipeline) =>
        pipeline.status === "OPERATIONAL" &&
        pipeline.flowDirection !== "BIDIRECTIONAL" &&
        pipeline.routeCoordinates.length >= 2
    )
    .map((pipeline) => {
      const coordinates: LngLat[] =
        pipeline.flowDirection === "REVERSE"
          ? [...pipeline.routeCoordinates].reverse()
          : pipeline.routeCoordinates;
      return {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { id: pipeline.id, kind: "pipelines" },
      };
    });

  return { type: "FeatureCollection", features: [...demo, ...registered] };
}

export function countFlowLines(pipelines: PipelineDto[]) {
  return pipelines.filter(
    (pipeline) => pipeline.status === "OPERATIONAL" && pipeline.flowDirection !== "BIDIRECTIONAL"
  ).length;
}

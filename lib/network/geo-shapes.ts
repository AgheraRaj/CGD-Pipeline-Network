import type { Feature, Polygon } from "geojson";
import { offsetByKm } from "./geo";
import type { LngLat } from "./types";

// A circle as a polygon, for accuracy rings and distance limits on the map.
export function circlePolygon(center: LngLat, radiusMeters: number, steps = 64): Feature<Polygon> {
  const radiusKm = radiusMeters / 1000;
  const ring: LngLat[] = [];
  for (let index = 0; index <= steps; index++) {
    const angle = (index / steps) * 2 * Math.PI;
    ring.push(offsetByKm(center, Math.cos(angle) * radiusKm, Math.sin(angle) * radiusKm));
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

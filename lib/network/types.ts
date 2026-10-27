import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";

export type LngLat = [longitude: number, latitude: number];

export type NetworkLayerId = "steel" | "mdpe" | "cgs" | "industrial" | "faults";

export type GeographicalArea = {
  code: string;
  name: string;
  color: string;
  center: LngLat;
  radiusKm: number;
  authorizationId: string;
  authorizedOn: string;
  domesticConnections: number;
  commercialUnits: number;
  industrialUnits: number;
};

export type CityGateStation = {
  id: string;
  name: string;
  gaCode: string;
  coordinates: LngLat;
  capacityScmh: number;
  inletBar: number;
  outletBar: number;
  commissionedYear: number;
  status: "online" | "maintenance";
};

export type PipelineMaterial = "STEEL" | "MDPE";

export type PipelineRoute = {
  id: string;
  name: string;
  material: PipelineMaterial;
  gaCode: string;
  coordinates: LngLat[];
  lengthKm: number;
  diameterMm: number;
  pressureRating: string;
  installedYear: number;
};

export type ConsumerProperties = {
  id: string;
  gaCode: string;
  loadScmh: number;
};

export type NetworkGeoJson = {
  areas: FeatureCollection<Polygon, { code: string; name: string; color: string }>;
  routes: FeatureCollection<LineString, Omit<PipelineRoute, "coordinates">>;
  stations: FeatureCollection<Point, Omit<CityGateStation, "coordinates">>;
  consumers: FeatureCollection<Point, ConsumerProperties>;
};

export type ConsumerFeature = Feature<Point, ConsumerProperties>;

export type NetworkSummary = {
  areaCount: number;
  cgsCount: number;
  cgsOnline: number;
  industrialConsumers: number;
  domesticConnections: number;
  commercialUnits: number;
  steelKm: number;
  mdpeKm: number;
  totalKm: number;
  steelSegments: number;
  mdpeSegments: number;
};
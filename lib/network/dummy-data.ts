import {
  createSeededRandom,
  getBounds,
  lineLengthKm,
  offsetByKm,
} from "./geo";
import type {
  CityGateStation,
  ConsumerFeature,
  GeographicalArea,
  LngLat,
  NetworkGeoJson,
  NetworkSummary,
  PipelineRoute,
} from "./types";

// Every value in this file is illustrative dummy data, not a real network.

export const ALL_AREAS = "ALL";

export const geographicalAreas: GeographicalArea[] = [
  {
    code: "AMD",
    name: "Ahmedabad",
    color: "#3b82f6",
    center: [72.5714, 23.0225],
    radiusKm: 14,
    authorizationId: "CGD/GJ/AMD/2008-01",
    authorizedOn: "Aug 2008",
    domesticConnections: 485200,
    commercialUnits: 1240,
    industrialUnits: 7500,
  },
  {
    code: "GNR",
    name: "Gandhinagar",
    color: "#8b5cf6",
    center: [72.6369, 23.2156],
    radiusKm: 10,
    authorizationId: "CGD/GJ/GNR/2008-02",
    authorizedOn: "Nov 2008",
    domesticConnections: 212400,
    commercialUnits: 640,
    industrialUnits: 2600,
  },
  {
    code: "AND",
    name: "Anand",
    color: "#22c55e",
    center: [72.9289, 22.5645],
    radiusKm: 8,
    authorizationId: "CGD/GJ/AND/2010-01",
    authorizedOn: "Mar 2010",
    domesticConnections: 96800,
    commercialUnits: 410,
    industrialUnits: 3100,
  },
  {
    code: "KHD",
    name: "Kheda",
    color: "#f59e0b",
    center: [72.6847, 22.7507],
    radiusKm: 6,
    authorizationId: "CGD/GJ/KHD/2010-02",
    authorizedOn: "Mar 2010",
    domesticConnections: 61300,
    commercialUnits: 275,
    industrialUnits: 1800,
  },
  // Added after the Gujarat areas on purpose: the seeded generators below run in this
  // order, so appending keeps every existing area's boundary, lines and consumers identical.
  {
    code: "SLP",
    name: "Solapur",
    color: "#ec4899",
    center: [75.9064, 17.6599],
    radiusKm: 11,
    authorizationId: "CGD/MH/SLP/2018-01",
    authorizedOn: "Jul 2018",
    domesticConnections: 58400,
    commercialUnits: 220,
    industrialUnits: 1400,
  },
];

export function getGeographicalArea(code: string) {
  return geographicalAreas.find((area) => area.code === code);
}

export const cityGateStations: CityGateStation[] = [
  {
    id: "CGS-01",
    name: "Naroda CGS",
    gaCode: "AMD",
    coordinates: [72.65, 23.08],
    capacityScmh: 120000,
    inletBar: 49,
    outletBar: 19,
    commissionedYear: 2012,
    status: "online",
  },
  {
    id: "CGS-02",
    name: "Gandhinagar CGS",
    gaCode: "GNR",
    coordinates: [72.58, 23.25],
    capacityScmh: 80000,
    inletBar: 49,
    outletBar: 19,
    commissionedYear: 2015,
    status: "online",
  },
  {
    id: "CGS-03",
    name: "Solapur CGS",
    gaCode: "SLP",
    coordinates: [75.835, 17.615],
    capacityScmh: 60000,
    inletBar: 49,
    outletBar: 19,
    commissionedYear: 2020,
    status: "online",
  },
];

// ───────────── Area boundaries ─────────────

function createAreaBoundary(area: GeographicalArea, seed: number): LngLat[] {
  const random = createSeededRandom(seed);
  const vertexCount = 12;
  const ring: LngLat[] = [];
  for (let index = 0; index < vertexCount; index++) {
    const angle = (index / vertexCount) * 2 * Math.PI;
    const radius = area.radiusKm * (0.9 + random() * 0.2);
    ring.push(
      offsetByKm(area.center, Math.cos(angle) * radius, Math.sin(angle) * radius)
    );
  }
  ring.push(ring[0]); // close the polygon
  return ring;
}

const areaBoundaries = new Map(
  geographicalAreas.map((area, index) => [
    area.code,
    createAreaBoundary(area, 100 + index),
  ])
);

// ───────────── Pipeline routes ─────────────

// Adds one gentle bend so trunk mains do not look like ruler-straight lines.
function bendBetween(from: LngLat, to: LngLat, bendKm: number): LngLat[] {
  const middle: LngLat = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const eastKm = (to[0] - from[0]) * 111.32 * Math.cos((from[1] * Math.PI) / 180);
  const northKm = (to[1] - from[1]) * 110.574;
  const length = Math.hypot(eastKm, northKm) || 1;
  const bent = offsetByKm(
    middle,
    (-northKm / length) * bendKm,
    (eastKm / length) * bendKm
  );
  return [from, bent, to];
}

function createRoute(
  details: Omit<PipelineRoute, "lengthKm">
): PipelineRoute {
  return {
    ...details,
    lengthKm: Math.round(lineLengthKm(details.coordinates) * 10) / 10,
  };
}

function areaCenter(code: string): LngLat {
  const area = getGeographicalArea(code);
  if (!area) throw new Error(`Unknown geographical area: ${code}`);
  return area.center;
}

function buildSteelRoutes(): PipelineRoute[] {
  const [narodaCgs, gandhinagarCgs, solapurCgs] = cityGateStations;
  const base = {
    material: "STEEL" as const,
    pressureRating: "MAOP ≥ 19 bar",
  };
  return [
    createRoute({
      ...base,
      id: "S-01",
      name: "Naroda – Gandhinagar trunk main",
      gaCode: "GNR",
      coordinates: bendBetween(narodaCgs.coordinates, gandhinagarCgs.coordinates, 1.2),
      diameterMm: 400,
      installedYear: 2015,
    }),
    createRoute({
      ...base,
      id: "S-02",
      name: "Naroda – Ahmedabad ring main",
      gaCode: "AMD",
      coordinates: bendBetween(narodaCgs.coordinates, areaCenter("AMD"), 1),
      diameterMm: 300,
      installedYear: 2012,
    }),
    createRoute({
      ...base,
      id: "S-03",
      name: "Ahmedabad – Kheda trunk main",
      gaCode: "KHD",
      coordinates: bendBetween(areaCenter("AMD"), areaCenter("KHD"), 2.5),
      diameterMm: 400,
      installedYear: 2016,
    }),
    createRoute({
      ...base,
      id: "S-04",
      name: "Kheda – Anand trunk main",
      gaCode: "AND",
      coordinates: bendBetween(areaCenter("KHD"), areaCenter("AND"), -2),
      diameterMm: 300,
      installedYear: 2018,
    }),
    createRoute({
      ...base,
      id: "S-05",
      name: "Gandhinagar ring main",
      gaCode: "GNR",
      coordinates: bendBetween(gandhinagarCgs.coordinates, areaCenter("GNR"), 0.8),
      diameterMm: 300,
      installedYear: 2015,
    }),
    createRoute({
      ...base,
      id: "S-06",
      name: "Solapur CGS – city ring main",
      gaCode: "SLP",
      coordinates: bendBetween(solapurCgs.coordinates, areaCenter("SLP"), 0.9),
      diameterMm: 300,
      installedYear: 2020,
    }),
    createRoute({
      ...base,
      id: "S-07",
      name: "Solapur – Chincholi MIDC trunk main",
      gaCode: "SLP",
      coordinates: bendBetween(
        areaCenter("SLP"),
        offsetByKm(areaCenter("SLP"), 7, 6),
        -0.8
      ),
      diameterMm: 250,
      installedYear: 2021,
    }),
  ];
}

const mdpeBranchCounts: Record<string, number> = {
  AMD: 9,
  GNR: 6,
  AND: 5,
  KHD: 4,
  SLP: 5,
};

function buildMdpeRoutes(): PipelineRoute[] {
  const random = createSeededRandom(11);
  const diameters = [110, 160, 200];

  return geographicalAreas.flatMap((area) => {
    const branchCount = mdpeBranchCounts[area.code] ?? 0;
    return Array.from({ length: branchCount }, (_, index) => {
      const angle = (index / branchCount) * 2 * Math.PI + random() * 0.4;
      const reachKm = area.radiusKm * (0.55 + random() * 0.3);
      const sideways = (random() - 0.5) * 1.5;
      const middle = offsetByKm(
        area.center,
        Math.cos(angle) * reachKm * 0.5 - Math.sin(angle) * sideways,
        Math.sin(angle) * reachKm * 0.5 + Math.cos(angle) * sideways
      );
      const end = offsetByKm(
        area.center,
        Math.cos(angle) * reachKm,
        Math.sin(angle) * reachKm
      );
      return createRoute({
        id: `M-${area.code}-${index + 1}`,
        name: `${area.name} distribution line ${index + 1}`,
        material: "MDPE",
        gaCode: area.code,
        coordinates: [area.center, middle, end],
        diameterMm: diameters[Math.floor(random() * diameters.length)],
        pressureRating: "≤ 4 bar (SDR-11)",
        installedYear: 2010 + Math.floor(random() * 14),
      });
    });
  });
}

export const pipelineRoutes: PipelineRoute[] = [
  ...buildSteelRoutes(),
  ...buildMdpeRoutes(),
];

// ───────────── Industrial consumers (about 16,400 points) ─────────────

export function buildIndustrialConsumerFeatures(): ConsumerFeature[] {
  const random = createSeededRandom(2024);
  const features: ConsumerFeature[] = [];

  for (const area of geographicalAreas) {
    for (let index = 0; index < area.industrialUnits; index++) {
      const angle = random() * 2 * Math.PI;
      // The exponent pulls points toward the centre, like a real industrial belt.
      const radius = area.radiusKm * 0.85 * Math.pow(random(), 0.75);
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: offsetByKm(
            area.center,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius
          ),
        },
        properties: {
          id: `IC-${String(features.length + 1).padStart(5, "0")}`,
          gaCode: area.code,
          loadScmh: 50 + Math.floor(random() * 1950),
        },
      });
    }
  }
  return features;
}

// The consumer set is large and never changes, so it is generated once and shared by the
// map and the connection calculation.
let industrialConsumerCache: ConsumerFeature[] | null = null;
export function getIndustrialConsumers(): ConsumerFeature[] {
  industrialConsumerCache ??= buildIndustrialConsumerFeatures();
  return industrialConsumerCache;
}

// ───────────── GeoJSON for the map ─────────────

export function buildNetworkGeoJson(): NetworkGeoJson {
  return {
    areas: {
      type: "FeatureCollection",
      features: geographicalAreas.map((area) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [areaBoundaries.get(area.code) ?? []],
        },
        properties: { code: area.code, name: area.name, color: area.color },
      })),
    },
    areaLabels: {
      type: "FeatureCollection",
      features: geographicalAreas.map((area) => {
        const ring = areaBoundaries.get(area.code) ?? [area.center];
        const top = ring.reduce((highest, point) => (point[1] > highest[1] ? point : highest));
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [area.center[0], top[1]] },
          properties: { code: area.code, name: `${area.name} GA` },
        };
      }),
    },
    routes: {
      type: "FeatureCollection",
      features: pipelineRoutes.map(({ coordinates, ...properties }) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties,
      })),
    },
    stations: {
      type: "FeatureCollection",
      features: cityGateStations.map(({ coordinates, ...properties }) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties,
      })),
    },
    consumers: {
      type: "FeatureCollection",
      features: getIndustrialConsumers(),
    },
  };
}

// ───────────── Summary and bounds ─────────────

export function getNetworkSummary(selection: string): NetworkSummary {
  const isAll = selection === ALL_AREAS;
  const areas = geographicalAreas.filter((area) => isAll || area.code === selection);
  const stations = cityGateStations.filter((station) => isAll || station.gaCode === selection);
  const routes = pipelineRoutes.filter((route) => isAll || route.gaCode === selection);

  const sumLength = (material: "STEEL" | "MDPE") =>
    routes
      .filter((route) => route.material === material)
      .reduce((total, route) => total + route.lengthKm, 0);

  const steelKm = sumLength("STEEL");
  const mdpeKm = sumLength("MDPE");

  return {
    areaCount: areas.length,
    cgsCount: stations.length,
    cgsOnline: stations.filter((station) => station.status === "online").length,
    industrialConsumers: areas.reduce((total, area) => total + area.industrialUnits, 0),
    domesticConnections: areas.reduce((total, area) => total + area.domesticConnections, 0),
    commercialUnits: areas.reduce((total, area) => total + area.commercialUnits, 0),
    steelKm,
    mdpeKm,
    totalKm: steelKm + mdpeKm,
    steelSegments: routes.filter((route) => route.material === "STEEL").length,
    mdpeSegments: routes.filter((route) => route.material === "MDPE").length,
  };
}

export function getSelectionBounds(selection: string) {
  const areaCodes =
    selection === ALL_AREAS
      ? geographicalAreas.map((area) => area.code)
      : [selection];
  const points = areaCodes.flatMap((code) => areaBoundaries.get(code) ?? []);
  return getBounds(points);
}
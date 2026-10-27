import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { PipelineDto } from "@/lib/pipelines/types";
import { getGeographicalArea } from "./dummy-data";
import type { ConsumerFeature, LngLat, PipelineRoute } from "./types";

// ───────────── Configuration ─────────────

// A consumer is only connected to a line in its own geographical area, and only if that
// line is within this distance. Anything further away is shown as "not connected"
// rather than being tied to an unrelated pipeline.
export const MAX_SERVICE_CONNECTION_KM = 4;

// Large industrial loads are normally fed from the steel (high-pressure) network.
// Consumers at or above this load may connect to a steel main when it is the closest
// suitable line; smaller consumers connect to distribution lines only.
export const HIGH_PRESSURE_LOAD_SCMH = 1500;

// ───────────── Types ─────────────

export type ConnectionLineKind = "steel" | "mdpe" | "registered";

export type ConnectionStatus = "CONNECTED" | "SUPPLY_INTERRUPTED" | "NOT_CONNECTED";

export type ConsumerConnection = {
  consumerId: string;
  gaCode: string;
  status: ConnectionStatus;
  lineKind: ConnectionLineKind | null;
  lineId: string | null; // demo route id or registered pipeline id
  lineCode: string | null;
  lineName: string | null;
  distanceM: number | null;
  tapPoint: LngLat | null;
};

export type ConnectionProperties = {
  consumerId: string;
  lineKind: ConnectionLineKind;
  lineCode: string;
  lineName: string;
  status: ConnectionStatus;
  distanceM: number;
};

export type ConsumerConnectionResult = {
  byConsumerId: Map<string, ConsumerConnection>;
  lines: FeatureCollection<LineString, ConnectionProperties>;
  tapPoints: FeatureCollection<Point, ConnectionProperties>;
  summary: Record<string, { connected: number; interrupted: number; notConnected: number }>;
};

type CandidateLine = {
  kind: ConnectionLineKind;
  id: string;
  code: string;
  name: string;
  gaCode: string;
  coordinates: LngLat[];
  isHighPressure: boolean;
  isInterrupted: boolean;
};

// ───────────── Geometry (local flat projection, accurate at service-line scale) ─────────────

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG_EQUATOR = 111.32;

export function nearestPointOnLine(point: LngLat, line: LngLat[]) {
  const cosLat = Math.cos((point[1] * Math.PI) / 180);
  const toKm = (p: LngLat) => [p[0] * KM_PER_DEG_LNG_EQUATOR * cosLat, p[1] * KM_PER_DEG_LAT];
  const [px, py] = toKm(point);
  let best = { distanceKm: Infinity, point: line[0] };
  for (let index = 1; index < line.length; index++) {
    const [ax, ay] = toKm(line[index - 1]);
    const [bx, by] = toKm(line[index]);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const distanceKm = Math.hypot(px - cx, py - cy);
    if (distanceKm < best.distanceKm) {
      best = {
        distanceKm,
        point: [cx / (KM_PER_DEG_LNG_EQUATOR * cosLat), cy / KM_PER_DEG_LAT],
      };
    }
  }
  return best;
}

// ───────────── Which lines can serve consumers ─────────────

const SERVING_TYPES = new Set(["DISTRIBUTION", "SERVICE_LINE"]);
const HIGH_PRESSURE_TYPES = new Set(["TRUNK_MAIN", "TRANSMISSION"]);

function getCandidateLines(routes: PipelineRoute[], pipelines: PipelineDto[]): CandidateLine[] {
  const demo: CandidateLine[] = routes.map((route) => ({
    kind: route.material === "STEEL" ? "steel" : "mdpe",
    id: route.id,
    code: route.id,
    name: route.name,
    gaCode: route.gaCode,
    coordinates: route.coordinates,
    isHighPressure: route.material === "STEEL",
    isInterrupted: false,
  }));

  // Registered pipelines only serve consumers once they are built and in use. Lines under
  // maintenance keep their consumers (shown as interrupted) rather than reassigning them.
  const registered: CandidateLine[] = pipelines
    .filter(
      (pipeline) =>
        (pipeline.status === "OPERATIONAL" || pipeline.status === "UNDER_MAINTENANCE") &&
        (SERVING_TYPES.has(pipeline.pipelineType) || HIGH_PRESSURE_TYPES.has(pipeline.pipelineType)) &&
        pipeline.routeCoordinates.length >= 2
    )
    .map((pipeline) => ({
      kind: "registered",
      id: pipeline.id,
      code: pipeline.pipelineCode,
      name: pipeline.name,
      gaCode: pipeline.gaCode,
      coordinates: pipeline.routeCoordinates,
      isHighPressure: HIGH_PRESSURE_TYPES.has(pipeline.pipelineType),
      isInterrupted: pipeline.status === "UNDER_MAINTENANCE",
    }));

  return [...demo, ...registered];
}

// ───────────── Topology ─────────────

type Match = { line: CandidateLine; distanceKm: number; point: LngLat };

function findBestMatch(
  position: LngLat,
  isLargeLoad: boolean,
  lines: CandidateLine[],
  current: Match | null
): Match | null {
  let best = current;
  for (const line of lines) {
    // Small consumers are never fed directly from a high-pressure main.
    if (line.isHighPressure && !isLargeLoad) continue;
    const nearest = nearestPointOnLine(position, line.coordinates);
    if (
      nearest.distanceKm <= MAX_SERVICE_CONNECTION_KM &&
      (!best || nearest.distanceKm < best.distanceKm)
    ) {
      best = { line, distanceKm: nearest.distanceKm, point: nearest.point as LngLat };
    }
  }
  return best;
}

function groupByArea(lines: CandidateLine[]) {
  const byArea = new Map<string, CandidateLine[]>();
  for (const line of lines) {
    const list = byArea.get(line.gaCode) ?? [];
    list.push(line);
    byArea.set(line.gaCode, list);
  }
  return byArea;
}

// The demo network never changes, so its best match per consumer is worked out once.
// When registered pipelines change, only those few lines are checked again.
let demoMatchCache: {
  consumers: ConsumerFeature[];
  routes: PipelineRoute[];
  matches: (Match | null)[];
} | null = null;

function getDemoMatches(consumers: ConsumerFeature[], routes: PipelineRoute[]) {
  if (demoMatchCache?.consumers === consumers && demoMatchCache.routes === routes) {
    return demoMatchCache.matches;
  }
  const byArea = groupByArea(getCandidateLines(routes, []));
  const matches = consumers.map((consumer) =>
    findBestMatch(
      consumer.geometry.coordinates as LngLat,
      consumer.properties.loadScmh >= HIGH_PRESSURE_LOAD_SCMH,
      byArea.get(consumer.properties.gaCode) ?? [],
      null
    )
  );
  demoMatchCache = { consumers, routes, matches };
  return matches;
}

export function buildConsumerConnections(
  consumers: ConsumerFeature[],
  routes: PipelineRoute[],
  pipelines: PipelineDto[]
): ConsumerConnectionResult {
  const demoMatches = getDemoMatches(consumers, routes);
  const registeredByArea = groupByArea(
    getCandidateLines([], pipelines)
  );

  const byConsumerId = new Map<string, ConsumerConnection>();
  const lineFeatures: Feature<LineString, ConnectionProperties>[] = [];
  const tapFeatures: Feature<Point, ConnectionProperties>[] = [];
  const summary: ConsumerConnectionResult["summary"] = {};

  for (const [index, consumer] of consumers.entries()) {
    const { id, gaCode, loadScmh } = consumer.properties;
    const position = consumer.geometry.coordinates as LngLat;
    const best = findBestMatch(
      position,
      loadScmh >= HIGH_PRESSURE_LOAD_SCMH,
      registeredByArea.get(gaCode) ?? [],
      demoMatches[index]
    );

    const areaSummary = (summary[gaCode] ??= { connected: 0, interrupted: 0, notConnected: 0 });

    if (!best) {
      areaSummary.notConnected += 1;
      byConsumerId.set(id, {
        consumerId: id,
        gaCode,
        status: "NOT_CONNECTED",
        lineKind: null,
        lineId: null,
        lineCode: null,
        lineName: null,
        distanceM: null,
        tapPoint: null,
      });
      continue;
    }

    const status: ConnectionStatus = best.line.isInterrupted ? "SUPPLY_INTERRUPTED" : "CONNECTED";
    if (status === "CONNECTED") areaSummary.connected += 1;
    else areaSummary.interrupted += 1;

    const distanceM = Math.round(best.distanceKm * 1000);
    const connection: ConsumerConnection = {
      consumerId: id,
      gaCode,
      status,
      lineKind: best.line.kind,
      lineId: best.line.id,
      lineCode: best.line.code,
      lineName: best.line.name,
      distanceM,
      tapPoint: best.point,
    };
    byConsumerId.set(id, connection);

    const properties: ConnectionProperties = {
      consumerId: id,
      lineKind: best.line.kind,
      lineCode: best.line.code,
      lineName: best.line.name,
      status,
      distanceM,
    };
    lineFeatures.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [position, best.point] },
      properties,
    });
    tapFeatures.push({ type: "Feature", geometry: { type: "Point", coordinates: best.point }, properties });
  }

  return {
    byConsumerId,
    lines: { type: "FeatureCollection", features: lineFeatures },
    tapPoints: { type: "FeatureCollection", features: tapFeatures },
    summary,
  };
}

// ───────────── Display helpers ─────────────

const INDUSTRY_TYPES = [
  "Ceramics",
  "Textiles",
  "Pharmaceuticals",
  "Food Processing",
  "Chemicals",
  "Engineering",
  "Plastics",
  "Glass",
  "Paper",
  "Steel Fabrication",
];

// Demo consumers have no stored name, so a stable illustrative one is derived from the ID.
export function getConsumerName(consumerId: string, gaCode: string) {
  const number = Number.parseInt(consumerId.replace(/\D/g, ""), 10) || 0;
  const industry = INDUSTRY_TYPES[number % INDUSTRY_TYPES.length];
  const area = getGeographicalArea(gaCode)?.name ?? gaCode;
  return `${area} ${industry} Unit ${number}`;
}

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  CONNECTED: "Connected",
  SUPPLY_INTERRUPTED: "Connected · supply line under maintenance",
  NOT_CONNECTED: "Not connected",
};

export const CONNECTION_LINE_KIND_LABELS: Record<ConnectionLineKind, string> = {
  steel: "Steel trunk main",
  mdpe: "MDPE distribution",
  registered: "Registered pipeline",
};

import { nearestPointOnLine } from "@/lib/network/connections";
import { pipelineRoutes } from "@/lib/network/dummy-data";
import type { LngLat } from "@/lib/network/types";
import type { PipelineDto } from "@/lib/pipelines/types";

// ───────────── Configuration ─────────────
// Set these in .env to change them. The NEXT_PUBLIC_ prefix makes the same value
// available to the browser (for the instant check) and the server (for the enforced
// check), so the two can never disagree. Restart or rebuild after changing them.

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// How close (in metres) a reporter must be to a known pipeline.
export const FAULT_REPORT_MAX_DISTANCE_M = readPositiveNumber(
  process.env.NEXT_PUBLIC_FAULT_REPORT_MAX_DISTANCE_M,
  100
);

// GPS fixes less precise than this are refused, because the distance check would be
// meaningless (a desktop browser's Wi-Fi estimate can be off by kilometres).
export const FAULT_REPORT_MAX_ACCURACY_M = readPositiveNumber(
  process.env.NEXT_PUBLIC_FAULT_REPORT_MAX_ACCURACY_M,
  100
);

// A location older than this must be refreshed before the report is sent.
export const FAULT_REPORT_MAX_LOCATION_AGE_MIN = readPositiveNumber(
  process.env.NEXT_PUBLIC_FAULT_REPORT_MAX_LOCATION_AGE_MIN,
  30
);

// ───────────── Nearest pipeline ─────────────

export type NearestPipelineKind = "STEEL_MAIN" | "MDPE" | "REGISTERED";

export type NearestPipeline = {
  kind: NearestPipelineKind;
  ref: string; // demo route id, or the registered pipeline's database id
  code: string;
  name: string;
  gaCode: string;
  distanceM: number;
  pointOnLine: LngLat;
  // Set only for registered pipelines, so the report can link to the database record.
  pipelineId: string | null;
};

export const NEAREST_PIPELINE_KIND_LABELS: Record<NearestPipelineKind, string> = {
  STEEL_MAIN: "Steel trunk main",
  MDPE: "MDPE distribution",
  REGISTERED: "Registered pipeline",
};

// Planned pipelines do not exist in the ground yet, so nobody can stand next to one.
type PipelineForProximity = Pick<
  PipelineDto,
  "id" | "pipelineCode" | "name" | "gaCode" | "status" | "routeCoordinates"
>;

export function findNearestPipeline(
  longitude: number,
  latitude: number,
  registeredPipelines: PipelineForProximity[]
): NearestPipeline | null {
  const position: LngLat = [longitude, latitude];
  let best: NearestPipeline | null = null;

  const consider = (candidate: Omit<NearestPipeline, "distanceM" | "pointOnLine">, line: LngLat[]) => {
    if (line.length < 2) return;
    const nearest = nearestPointOnLine(position, line);
    const distanceM = nearest.distanceKm * 1000;
    if (!best || distanceM < best.distanceM) {
      best = { ...candidate, distanceM, pointOnLine: nearest.point as LngLat };
    }
  };

  for (const route of pipelineRoutes) {
    consider(
      {
        kind: route.material === "STEEL" ? "STEEL_MAIN" : "MDPE",
        ref: route.id,
        code: route.id,
        name: route.name,
        gaCode: route.gaCode,
        pipelineId: null,
      },
      route.coordinates
    );
  }
  for (const pipeline of registeredPipelines) {
    if (pipeline.status === "PLANNED") continue;
    consider(
      {
        kind: "REGISTERED",
        ref: pipeline.id,
        code: pipeline.pipelineCode,
        name: pipeline.name,
        gaCode: pipeline.gaCode,
        pipelineId: pipeline.id,
      },
      pipeline.routeCoordinates
    );
  }
  return best;
}

export type ProximityCheck =
  | { ok: true; nearest: NearestPipeline }
  | { ok: false; reason: "INACCURATE" | "TOO_FAR" | "NO_PIPELINES"; message: string; nearest: NearestPipeline | null };

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

// The single rule used by both the form and the API.
export function checkFaultProximity(
  longitude: number,
  latitude: number,
  accuracyMeters: number | null,
  registeredPipelines: PipelineForProximity[]
): ProximityCheck {
  const nearest = findNearestPipeline(longitude, latitude, registeredPipelines);

  if (accuracyMeters === null || accuracyMeters > FAULT_REPORT_MAX_ACCURACY_M) {
    return {
      ok: false,
      reason: "INACCURATE",
      nearest,
      message: `Your location is only accurate to ${
        accuracyMeters === null ? "an unknown distance" : `±${formatDistance(accuracyMeters)}`
      }. Reports need ±${formatDistance(FAULT_REPORT_MAX_ACCURACY_M)} or better. Turn on GPS or precise location, move to open sky and update your location.`,
    };
  }
  if (!nearest) {
    return {
      ok: false,
      reason: "NO_PIPELINES",
      nearest: null,
      message: "There are no known pipelines to check your position against.",
    };
  }
  if (nearest.distanceM > FAULT_REPORT_MAX_DISTANCE_M) {
    return {
      ok: false,
      reason: "TOO_FAR",
      nearest,
      message: `You are ${formatDistance(nearest.distanceM)} from the nearest known pipeline (${nearest.code}). Move within ${formatDistance(FAULT_REPORT_MAX_DISTANCE_M)} of a pipeline to report a fault at your location.`,
    };
  }
  return { ok: true, nearest };
}

export { formatDistance };

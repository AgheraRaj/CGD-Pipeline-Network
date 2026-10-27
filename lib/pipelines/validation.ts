import { geographicalAreas } from "@/lib/network/dummy-data";
import { distanceKm, lineLengthKm } from "@/lib/network/geo";
import type { LngLat } from "@/lib/network/types";
import {
  PIPELINE_LIMITS as LIMITS,
  pipelineFlowDirections,
  pipelineMaterials,
  pipelineStatuses,
  pipelineTypes,
} from "./constants";
import type { PipelineFieldErrors, PipelineInput } from "./types";

export type PipelineParseResult =
  | { ok: true; data: PipelineInput }
  | { ok: false; errors: PipelineFieldErrors };

type Raw = Record<string, unknown>;

function text(raw: Raw, key: string) {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
}

// Accepts numbers or numeric strings. An empty value is NaN, never a silent 0.
function number(raw: Raw, key: string) {
  const value = raw[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value.trim());
  return Number.NaN;
}

function pick<T extends string>(options: readonly { value: T }[], value: string) {
  return options.find((option) => option.value === value)?.value;
}

export function normalizePipelineCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function routeLengthKm(coordinates: LngLat[]) {
  return round(lineLengthKm(coordinates), 3);
}

function parseRoute(value: unknown): { route?: LngLat[]; error?: string } {
  if (!Array.isArray(value) || value.length < LIMITS.minPoints) {
    return { error: "Add at least a start and an end point to the route." };
  }
  if (value.length > LIMITS.maxPoints) {
    return { error: `A route can have at most ${LIMITS.maxPoints} points.` };
  }
  const route: LngLat[] = [];
  for (const [index, point] of value.entries()) {
    const label = `Point ${index + 1}`;
    if (!Array.isArray(point) || point.length !== 2) {
      return { error: `${label} is not a valid coordinate pair.` };
    }
    const [longitude, latitude] = point.map((part) =>
      typeof part === "string" && part.trim() !== "" ? Number(part) : part
    );
    if (typeof latitude !== "number" || !isValidLatitude(latitude)) {
      return { error: `${label}: latitude must be a number between -90 and 90.` };
    }
    if (typeof longitude !== "number" || !isValidLongitude(longitude)) {
      return { error: `${label}: longitude must be a number between -180 and 180.` };
    }
    const current: LngLat = [round(longitude, 7), round(latitude, 7)];
    const previous = route[route.length - 1];
    if (previous && distanceKm(previous, current) < LIMITS.minSegmentKm) {
      return { error: `${label} is the same as the point before it. Remove the duplicate.` };
    }
    route.push(current);
  }
  return { route };
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Used by the API and by the form, so the browser shows exactly the errors the server would.
export function parsePipelineInput(raw: Raw): PipelineParseResult {
  const errors: PipelineFieldErrors = {};

  const pipelineCode = normalizePipelineCode(text(raw, "pipelineCode"));
  if (!pipelineCode) {
    errors.pipelineCode = "Enter a pipeline ID.";
  } else if (!LIMITS.codePattern.test(pipelineCode)) {
    errors.pipelineCode =
      "Use 3–40 letters, numbers, hyphens, underscores or slashes (for example AMD-ST-014).";
  }

  const name = text(raw, "name");
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors.name = `The name must be between ${LIMITS.nameMin} and ${LIMITS.nameMax} characters.`;
  }

  const description = text(raw, "description");
  if (description.length > LIMITS.descriptionMax) {
    errors.description = `Keep the notes to ${LIMITS.descriptionMax} characters or fewer.`;
  }

  const routeDescription = text(raw, "routeDescription");
  if (routeDescription.length > LIMITS.routeDescriptionMax) {
    errors.routeDescription = `Keep the route description to ${LIMITS.routeDescriptionMax} characters or fewer.`;
  }

  const material = pick(pipelineMaterials, text(raw, "material"));
  if (!material) errors.material = "Choose a material.";

  const pipelineType = pick(pipelineTypes, text(raw, "pipelineType"));
  if (!pipelineType) errors.pipelineType = "Choose a pipeline type.";

  const status = pick(pipelineStatuses, text(raw, "status"));
  if (!status) errors.status = "Choose an operational status.";

  const flowDirection = pick(pipelineFlowDirections, text(raw, "flowDirection"));
  if (!flowDirection) errors.flowDirection = "Choose the flow direction.";

  const gaCode = text(raw, "gaCode");
  if (!geographicalAreas.some((area) => area.code === gaCode)) {
    errors.gaCode = "Choose a geographical area.";
  }

  const diameterMm = number(raw, "diameterMm");
  if (
    !Number.isFinite(diameterMm) ||
    diameterMm < LIMITS.diameterMinMm ||
    diameterMm > LIMITS.diameterMaxMm
  ) {
    errors.diameterMm = `Enter a diameter between ${LIMITS.diameterMinMm} and ${LIMITS.diameterMaxMm} mm.`;
  }

  const depthM = number(raw, "depthM");
  if (!Number.isFinite(depthM) || depthM < LIMITS.depthMinM || depthM > LIMITS.depthMaxM) {
    errors.depthM = `Enter a burial depth between ${LIMITS.depthMinM} and ${LIMITS.depthMaxM} m.`;
  }

  const pressureText = text(raw, "pressureRatingBar");
  const pressureRaw = raw.pressureRatingBar;
  const hasPressure = typeof pressureRaw === "number" || pressureText !== "";
  const pressureRatingBar = hasPressure ? number(raw, "pressureRatingBar") : null;
  if (
    pressureRatingBar !== null &&
    (!Number.isFinite(pressureRatingBar) ||
      pressureRatingBar <= 0 ||
      pressureRatingBar > LIMITS.pressureMaxBar)
  ) {
    errors.pressureRatingBar = `Enter a pressure between 0 and ${LIMITS.pressureMaxBar} bar, or leave it empty.`;
  }

  const installationDate = text(raw, "installationDate");
  if (!isValidIsoDate(installationDate)) {
    errors.installationDate = "Enter a valid installation date.";
  } else if (installationDate < "1900-01-01") {
    errors.installationDate = "The installation date must be after 1900.";
  } else if (status !== "PLANNED" && status !== "UNDER_CONSTRUCTION") {
    const today = new Date().toISOString().slice(0, 10);
    if (installationDate > today) {
      errors.installationDate =
        "An installed pipeline cannot have a future date. Set the status to Planned or Under construction.";
    }
  }

  const { route, error: routeError } = parseRoute(raw.routeCoordinates);
  if (routeError) errors.routeCoordinates = routeError;

  const lengthKm = number(raw, "lengthKm");
  if (!Number.isFinite(lengthKm) || lengthKm <= 0 || lengthKm > LIMITS.lengthMaxKm) {
    errors.lengthKm = `Enter a length greater than 0 and up to ${LIMITS.lengthMaxKm} km.`;
  } else if (route) {
    const drawnKm = routeLengthKm(route);
    if (lengthKm < drawnKm * LIMITS.lengthMinRatio) {
      errors.lengthKm = `The length cannot be shorter than the drawn route (${drawnKm.toFixed(3)} km).`;
    } else if (lengthKm > Math.max(drawnKm * LIMITS.lengthMaxRatio, drawnKm + 0.5)) {
      errors.lengthKm = `The length is far longer than the drawn route (${drawnKm.toFixed(3)} km). Check the value or the route.`;
    }
  }

  if (Object.keys(errors).length > 0 || !route) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      pipelineCode,
      name,
      description: description || null,
      material: material!,
      pipelineType: pipelineType!,
      status: status!,
      diameterMm: round(diameterMm, 2),
      lengthKm: round(lengthKm, 3),
      depthM: round(depthM, 2),
      pressureRatingBar: pressureRatingBar === null ? null : round(pressureRatingBar, 2),
      gaCode,
      installationDate,
      flowDirection: flowDirection!,
      routeDescription: routeDescription || null,
      routeCoordinates: route,
    },
  };
}

// Compass direction of the straight line from the first to the last point, e.g. "NE".
export function getRouteBearingLabel(coordinates: LngLat[]) {
  if (coordinates.length < 2) return "";
  const [startLng, startLat] = coordinates[0];
  const [endLng, endLat] = coordinates[coordinates.length - 1];
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const y = Math.sin(toRad(endLng - startLng)) * Math.cos(toRad(endLat));
  const x =
    Math.cos(toRad(startLat)) * Math.sin(toRad(endLat)) -
    Math.sin(toRad(startLat)) * Math.cos(toRad(endLat)) * Math.cos(toRad(endLng - startLng));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(bearing / 45) % 8];
}

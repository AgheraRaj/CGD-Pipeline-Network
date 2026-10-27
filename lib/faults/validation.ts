import {
  ALLOWED_PHOTO_TYPES,
  faultSeverities,
  faultTypes,
  MAX_PHOTO_BYTES,
  type FaultSeverityValue,
  type FaultTypeValue,
} from "./constants";

export type FaultFormData = {
  title: string;
  description: string | null;
  faultType: FaultTypeValue;
  severity: FaultSeverityValue;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: Date;
  photo: File;
};

export type ParseResult =
  | { ok: true; data: FaultFormData }
  | { ok: false; error: string };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, name: string) {
  const text = readText(formData, name);
  // Number("") is 0, which would silently become a valid coordinate.
  return text === "" ? Number.NaN : Number(text);
}

export function parseFaultForm(formData: FormData): ParseResult {
  const title = readText(formData, "title");
  if (title.length < 3 || title.length > 120) {
    return { ok: false, error: "The title must be between 3 and 120 characters." };
  }

  const description = readText(formData, "description");
  if (description.length > 1000) {
    return { ok: false, error: "The description must be 1000 characters or fewer." };
  }

  const faultType = faultTypes.find((option) => option.value === readText(formData, "faultType"));
  if (!faultType) return { ok: false, error: "Choose a fault type." };

  const severity = faultSeverities.find((option) => option.value === readText(formData, "severity"));
  if (!severity) return { ok: false, error: "Choose a severity." };

  const latitude = readNumber(formData, "latitude");
  const longitude = readNumber(formData, "longitude");
  const hasValidCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  if (!hasValidCoordinates) {
    return {
      ok: false,
      error: "The report has no valid location. Allow location access and try again.",
    };
  }

  const accuracy = readNumber(formData, "accuracyMeters");
  const accuracyMeters = Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;

  const capturedAt = new Date(readText(formData, "capturedAt"));
  const age = Date.now() - capturedAt.getTime();
  if (Number.isNaN(capturedAt.getTime()) || age > ONE_DAY_MS || age < -FIVE_MINUTES_MS) {
    return {
      ok: false,
      error: "The captured location is too old or invalid. Update your location and try again.",
    };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, error: "Add a photograph of the fault." };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { ok: false, error: "The photograph must be a JPEG, PNG or WebP image." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "The photograph is larger than 6 MB." };
  }

  return {
    ok: true,
    data: {
      title,
      description: description || null,
      faultType: faultType.value,
      severity: severity.value,
      latitude,
      longitude,
      accuracyMeters,
      capturedAt,
      photo,
    },
  };
}
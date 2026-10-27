import type { LngLat } from "./types";

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(from: LngLat, to: LngLat) {
  const deltaLat = toRadians(to[1] - from[1]);
  const deltaLng = toRadians(to[0] - from[0]);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from[1])) *
      Math.cos(toRadians(to[1])) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function lineLengthKm(coordinates: LngLat[]) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index++) {
    total += distanceKm(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

export function offsetByKm(origin: LngLat, eastKm: number, northKm: number): LngLat {
  const latitude = origin[1] + northKm / KM_PER_DEGREE_LATITUDE;
  const longitude =
    origin[0] +
    eastKm / (KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(toRadians(origin[1])));
  return [longitude, latitude];
}

export function getBounds(points: LngLat[]): [LngLat, LngLat] {
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

// Small deterministic random generator so dummy data is identical on every load.
export function createSeededRandom(seed: number) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
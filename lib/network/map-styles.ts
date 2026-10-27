import { setWorkerUrl } from "maplibre-gl";

// Free vector basemaps from OpenFreeMap. No API key is needed.
export const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export function getMapStyleUrl(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light;
}

// Turbopack breaks MapLibre's automatic worker lookup, so use the copy in /public.
// It is created by scripts/copy-maplibre-worker.mjs.
export function configureMapLibreWorker() {
  setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
}

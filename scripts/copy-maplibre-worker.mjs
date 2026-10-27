// MapLibre loads its tile worker from a separate file. Turbopack cannot resolve that file
// on its own, so we serve a copy from /public and point MapLibre at it (see network-map.tsx).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const source = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
const destination = "public/maplibre-gl-worker.mjs";

if (!existsSync(source)) {
  console.warn("maplibre-gl is not installed yet, skipping worker copy.");
} else {
  mkdirSync("public", { recursive: true });
  copyFileSync(source, destination);
  console.log(`Copied ${source} -> ${destination}`);
}
"use client";

import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { buildFaultGeoJson } from "@/lib/faults/geojson";
import type { FaultReportDto } from "@/lib/faults/types";
import { getAssetDetails, type AssetDetails } from "@/lib/network/asset-details";
import {
  buildNetworkGeoJson,
  getSelectionBounds,
} from "@/lib/network/dummy-data";
import type { NetworkGeoJson, NetworkLayerId } from "@/lib/network/types";

// Free vector basemaps from OpenFreeMap. No API key is needed.
const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

// Which map layers belong to each toggle in the side panel.
const LAYER_GROUPS: Record<NetworkLayerId, string[]> = {
  steel: ["steel", "steel-hit"],
  mdpe: ["mdpe", "mdpe-hit"],
  cgs: ["cgs-halo", "cgs"],
  industrial: ["industrial-clusters", "industrial-count", "industrial-points"],
  faults: ["faults-halo", "faults"],
};

const CLICKABLE_LAYER_IDS = ["steel-hit", "mdpe-hit", "cgs", "industrial-points", "faults"];

type VisibleLayers = Record<NetworkLayerId, boolean>;

type NetworkMapProps = {
  selection: string;
  visibleLayers: VisibleLayers;
  faults: FaultReportDto[];
  focusRequest: { id: string; longitude: number; latitude: number } | null;
  onSelectAsset: (asset: AssetDetails | null) => void;
};

function applyLayerVisibility(map: MapLibreMap, visibleLayers: VisibleLayers) {
  for (const [group, layerIds] of Object.entries(LAYER_GROUPS)) {
    const visibility = visibleLayers[group as NetworkLayerId] ? "visible" : "none";
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    }
  }
}

// The selected area gets a thicker outline.
function applySelectionStyle(map: MapLibreMap, selection: string) {
  if (!map.getLayer("ga-line")) return;
  map.setPaintProperty("ga-line", "line-width", [
    "case",
    ["==", ["get", "code"], selection],
    3,
    1.5,
  ]);
}

function fitToSelection(map: MapLibreMap, selection: string, animate: boolean) {
  map.fitBounds(getSelectionBounds(selection), {
    padding: { top: 90, bottom: 50, left: 50, right: 50 },
    duration: animate ? 800 : 0,
    maxZoom: 12,
  });
}

function addNetworkLayers(
  map: MapLibreMap,
  data: NetworkGeoJson,
  faults: FaultReportDto[],
  visibleLayers: VisibleLayers,
  selection: string
) {
  if (map.getSource("areas")) return;

  map.addSource("areas", { type: "geojson", data: data.areas });
  map.addSource("routes", { type: "geojson", data: data.routes });
  map.addSource("stations", { type: "geojson", data: data.stations });
  map.addSource("faults", { type: "geojson", data: buildFaultGeoJson(faults) });
  map.addSource("consumers", {
    type: "geojson",
    data: data.consumers,
    cluster: true,
    clusterRadius: 45,
    clusterMaxZoom: 13,
  });

  map.addLayer({
    id: "ga-fill",
    type: "fill",
    source: "areas",
    paint: { "fill-color": ["get", "color"], "fill-opacity": 0.1 },
  });
  map.addLayer({
    id: "ga-line",
    type: "line",
    source: "areas",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 1.5,
      "line-dasharray": [3, 2],
    },
  });

  map.addLayer({
    id: "mdpe",
    type: "line",
    source: "routes",
    filter: ["==", ["get", "material"], "MDPE"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#3b82f6",
      "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 13, 3.5],
    },
  });
  map.addLayer({
    id: "steel",
    type: "line",
    source: "routes",
    filter: ["==", ["get", "material"], "STEEL"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#f59e0b",
      "line-width": ["interpolate", ["linear"], ["zoom"], 7, 2.5, 13, 5],
    },
  });

  // Invisible, wider copies of the lines so they are easy to click.
  map.addLayer({
    id: "mdpe-hit",
    type: "line",
    source: "routes",
    filter: ["==", ["get", "material"], "MDPE"],
    paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 14 },
  });
  map.addLayer({
    id: "steel-hit",
    type: "line",
    source: "routes",
    filter: ["==", ["get", "material"], "STEEL"],
    paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 14 },
  });

  map.addLayer({
    id: "industrial-clusters",
    type: "circle",
    source: "consumers",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#8b5cf6",
      "circle-opacity": 0.85,
      "circle-radius": ["step", ["get", "point_count"], 14, 100, 19, 1000, 25],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "industrial-count",
    type: "symbol",
    source: "consumers",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "industrial-points",
    type: "circle",
    source: "consumers",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#8b5cf6",
      "circle-radius": 5,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  });

  map.addLayer({
    id: "cgs-halo",
    type: "circle",
    source: "stations",
    paint: { "circle-color": "#f97316", "circle-opacity": 0.25, "circle-radius": 18 },
  });
  map.addLayer({
    id: "cgs",
    type: "circle",
    source: "stations",
    paint: {
      "circle-color": "#f97316",
      "circle-radius": 9,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
    },
  });

  // Reported faults sit on top of everything else. Resolved faults are grey.
  map.addLayer({
    id: "faults-halo",
    type: "circle",
    source: "faults",
    paint: {
      "circle-color": ["case", ["==", ["get", "status"], "RESOLVED"], "#9ca3af", "#ef4444"],
      "circle-opacity": 0.25,
      "circle-radius": 18,
    },
  });
  map.addLayer({
    id: "faults",
    type: "circle",
    source: "faults",
    paint: {
      "circle-color": ["case", ["==", ["get", "status"], "RESOLVED"], "#9ca3af", "#ef4444"],
      "circle-radius": [
        "match",
        ["get", "severity"],
        "CRITICAL",
        10,
        "HIGH",
        8.5,
        "MEDIUM",
        7.5,
        6.5,
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
    },
  });

  applyLayerVisibility(map, visibleLayers);
  applySelectionStyle(map, selection);
}

export function NetworkMap({
  selection,
  visibleLayers,
  faults,
  focusRequest,
  onSelectAsset,
}: NetworkMapProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentStyleRef = useRef<string | null>(null);
  const networkDataRef = useRef<NetworkGeoJson | null>(null);
  const hasStyleLoadedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Event handlers are registered once, so they read the latest values from refs.
  const selectionRef = useRef(selection);
  const visibleLayersRef = useRef(visibleLayers);
  const faultsRef = useRef(faults);
  const onSelectAssetRef = useRef(onSelectAsset);

  const styleUrl = resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light;

  // Create the map once, then only swap the basemap when the theme changes.
  useEffect(() => {
    if (!resolvedTheme || !containerRef.current) return;

    const existingMap = mapRef.current;
    if (existingMap) {
      if (currentStyleRef.current !== styleUrl) {
        currentStyleRef.current = styleUrl;
        // diff: false forces a full reload, so "style.load" fires and our layers are re-added.
        existingMap.setStyle(styleUrl, { diff: false });
      }
      return;
    }

    // Turbopack breaks MapLibre's automatic worker lookup, so use the copy in /public.
    // It is created by scripts/copy-maplibre-worker.mjs.
    setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: [72.75, 23.0],
      zoom: 8,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    currentStyleRef.current = styleUrl;
    networkDataRef.current = buildNetworkGeoJson();

    // The free basemap style refers to a few icons that are not in its sprite sheet.
    // Supplying a blank pixel removes the console warning and changes nothing visible.
    map.setMissingStyleImageResolver((imageId) => {
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });

    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    fitToSelection(map, selectionRef.current, false);

    map.on("style.load", () => {
      hasStyleLoadedRef.current = true;
      setLoadError(null);
      if (!networkDataRef.current) return;
      addNetworkLayers(
        map,
        networkDataRef.current,
        faultsRef.current,
        visibleLayersRef.current,
        selectionRef.current
      );
    });

    // Show a readable message if the basemap or the browser's WebGL fails before the first render.
    map.on("error", (event) => {
      console.error("MapLibre error:", event.error);
      const message = event.error?.message ?? "";
      const isLayerNotReadyYet = message.includes("does not exist in the map's style");
      if (!hasStyleLoadedRef.current && !isLayerNotReadyYet) {
        setLoadError(message || "The map could not be loaded.");
      }
    });

    for (const layerId of CLICKABLE_LAYER_IDS) {
      map.on("click", layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        onSelectAssetRef.current(getAssetDetails(layerId, feature.properties));
      });
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // Clicking a cluster zooms in to break it apart.
    map.on("click", "industrial-clusters", async (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const source = map.getSource("consumers") as GeoJSONSource | undefined;
      const clusterId = feature.properties?.cluster_id;
      if (!source || clusterId === undefined) return;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom,
      });
    });
    map.on("mouseenter", "industrial-clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "industrial-clusters", () => {
      map.getCanvas().style.cursor = "";
    });

    // Clicking empty map space closes the detail card.
    map.on("click", (event) => {
      const interactiveLayers = [...CLICKABLE_LAYER_IDS, "industrial-clusters"].filter(
        (layerId) => map.getLayer(layerId)
      );
      const hits = map.queryRenderedFeatures(event.point, { layers: interactiveLayers });
      if (hits.length === 0) onSelectAssetRef.current(null);
    });
  }, [resolvedTheme, styleUrl]);

  // Remove the map when the page is left.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      currentStyleRef.current = null;
      hasStyleLoadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onSelectAssetRef.current = onSelectAsset;
  }, [onSelectAsset]);

  // Keep the fault markers in sync with the list from the server.
  useEffect(() => {
    faultsRef.current = faults;
    const source = mapRef.current?.getSource("faults") as GeoJSONSource | undefined;
    source?.setData(buildFaultGeoJson(faults));
  }, [faults]);

  // Fly to a fault, for example right after it has been reported.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) return;
    map.flyTo({
      center: [focusRequest.longitude, focusRequest.latitude],
      zoom: 15,
      duration: 1200,
    });
  }, [focusRequest]);

  useEffect(() => {
    visibleLayersRef.current = visibleLayers;
    if (mapRef.current) applyLayerVisibility(mapRef.current, visibleLayers);
  }, [visibleLayers]);

  useEffect(() => {
    selectionRef.current = selection;
    const map = mapRef.current;
    if (!map) return;
    applySelectionStyle(map, selection);
    fitToSelection(map, selection, true);
  }, [selection]);

  return (
    <>
      {/* MapLibre's own CSS sets position: relative on the map element and overrides Tailwind's
          "absolute inset-0", which collapses the map to zero height. So the map gets a wrapper
          that does the positioning and fills it with inline styles. */}
      <div className="absolute inset-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
      {loadError ? (
        <div className="bg-background/90 absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 p-6 text-center">
          <p className="text-sm font-medium">The map could not be loaded</p>
          <p className="text-muted-foreground max-w-md text-xs">{loadError}</p>
        </div>
      ) : null}
    </>
  );
}
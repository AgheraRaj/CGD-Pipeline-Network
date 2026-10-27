"use client";

import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { buildFaultGeoJson } from "@/lib/faults/geojson";
import type { FaultReportDto } from "@/lib/faults/types";
import {
  getAssetDetails,
  getConsumerDetails,
  type AssetDetails,
} from "@/lib/network/asset-details";
import {
  ALL_AREAS,
  buildNetworkGeoJson,
  getSelectionBounds,
} from "@/lib/network/dummy-data";
import type { DeviceLocation } from "@/hooks/use-device-location";
import {
  CONNECTION_STATUS_LABELS,
  getConsumerName,
  type ConsumerConnectionResult,
} from "@/lib/network/connections";
import { buildFlowGeoJson, type FlowKind } from "@/lib/network/flow";
import { circlePolygon } from "@/lib/network/geo-shapes";
import { configureMapLibreWorker, getMapStyleUrl } from "@/lib/network/map-styles";
import {
  GA_BOUNDARY_COLOR,
  GA_BOUNDARY_DASH,
  GA_LABEL_HALO,
  NETWORK_COLORS,
} from "@/lib/network/map-theme";
import type { LngLat, NetworkGeoJson, NetworkLayerId } from "@/lib/network/types";
import {
  PIPELINE_COLOR,
  PIPELINE_INACTIVE_COLOR,
} from "@/lib/pipelines/constants";
import { buildPipelineGeoJson } from "@/lib/pipelines/geojson";
import { addFlowArrowImages, flowArrowImageId } from "@/lib/pipelines/map-icons";
import type { PipelineDto } from "@/lib/pipelines/types";

// Which map layers belong to each toggle in the side panel.
const LAYER_GROUPS: Record<NetworkLayerId, string[]> = {
  steel: ["steel", "steel-hit"],
  mdpe: ["mdpe", "mdpe-hit"],
  pipelines: [
    "pipelines-casing",
    "pipelines-solid",
    "pipelines-dashed",
    "pipelines-hit",
  ],
  flow: ["flow-pulse", "flow-arrows"],
  connections: ["connections-line", "connections-tap", "connections-hit"],
  cgs: ["cgs-halo", "cgs"],
  industrial: ["industrial-clusters", "industrial-count", "industrial-points"],
  faults: ["faults-halo", "faults"],
};

const CLICKABLE_LAYER_IDS = [
  "steel-hit",
  "mdpe-hit",
  "pipelines-hit",
  "connections-hit",
  "cgs",
  "industrial-points",
  "faults",
];

// Registered pipelines get an outline that contrasts with the basemap behind them.
const PIPELINE_CASING_COLOR = { light: "#083344", dark: "#ecfeff" } as const;
const NOT_YET_BUILT = ["PLANNED", "UNDER_CONSTRUCTION"];

const FLOW_KINDS: FlowKind[] = ["steel", "mdpe", "pipelines"];

// Moving dashes for the gas-flow overlay. Each step shifts the dash a little further
// along the line, from its first point towards its last, which is the flow direction.
// Values are in line widths and doubled so the dashes are long enough to read.
const FLOW_DASH_STEPS: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
].map((step) => step.map((value) => value * 2));
const FLOW_FRAME_MS = 70;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type VisibleLayers = Record<NetworkLayerId, boolean>;

type NetworkMapProps = {
  selection: string;
  visibleLayers: VisibleLayers;
  faults: FaultReportDto[];
  pipelines: PipelineDto[];
  selectedPipelineId: string | null;
  connections: ConsumerConnectionResult;
  userLocation: DeviceLocation | null;
  focusRequest: {
    id: string;
    longitude: number;
    latitude: number;
    bounds?: [LngLat, LngLat];
  } | null;
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

  // Flow indicators only appear on line types that are switched on.
  const shownKinds = FLOW_KINDS.filter((kind) => visibleLayers[kind]);
  const flowFilter: FilterSpecification = ["in", ["get", "kind"], ["literal", shownKinds]];
  for (const layerId of LAYER_GROUPS.flow) {
    if (map.getLayer(layerId)) map.setFilter(layerId, flowFilter);
  }
  // People who ask for less motion get the static arrows only.
  if (prefersReducedMotion() && map.getLayer("flow-pulse")) {
    map.setLayoutProperty("flow-pulse", "visibility", "none");
  }
}

// All areas share one boundary style. When one area is selected, its boundary is drawn
// stronger and the others fade back, so it is clear which boundary the figures refer to.
function applySelectionStyle(map: MapLibreMap, selection: string) {
  if (!map.getLayer("ga-line")) return;
  const isAll = selection === ALL_AREAS;
  const isSelected: ExpressionSpecification = ["==", ["get", "code"], selection];
  const pick = (selected: number, other: number, all: number): ExpressionSpecification | number =>
    isAll ? all : ["case", isSelected, selected, other];

  map.setPaintProperty("ga-line", "line-width", pick(3, 1.25, 2));
  map.setPaintProperty("ga-line", "line-opacity", pick(1, 0.45, 0.9));
  map.setPaintProperty("ga-fill", "fill-opacity", pick(0.09, 0.02, 0.05));
  if (map.getLayer("ga-labels")) {
    map.setPaintProperty("ga-labels", "text-opacity", pick(1, 0.55, 0.9));
  }
}

function fitToSelection(map: MapLibreMap, selection: string, animate: boolean) {
  map.fitBounds(getSelectionBounds(selection), {
    padding: { top: 90, bottom: 50, left: 50, right: 50 },
    duration: animate ? 800 : 0,
    maxZoom: 12,
  });
}

function applyPipelineHighlight(map: MapLibreMap, selectedPipelineId: string | null) {
  if (!map.getLayer("pipelines-casing")) return;
  const isSelected: ExpressionSpecification = ["==", ["get", "id"], selectedPipelineId ?? ""];
  map.setPaintProperty("pipelines-casing", "line-width", [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    ["case", isSelected, 8, 4.5],
    13,
    ["case", isSelected, 12, 8],
  ]);
  map.setPaintProperty("pipelines-casing", "line-opacity", ["case", isSelected, 0.95, 0.55]);
}

function addPipelineLayers(
  map: MapLibreMap,
  pipelines: PipelineDto[],
  isDark: boolean,
  selectedPipelineId: string | null,
  beforeLayerId?: string
) {
  if (map.getSource("pipelines")) return;
  map.addSource("pipelines", { type: "geojson", data: buildPipelineGeoJson(pipelines) });
  const before = beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined;

  const lineWidth: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 7, 2.5, 13, 5];
  const lineColor: ExpressionSpecification = [
    "case",
    ["==", ["get", "status"], "DECOMMISSIONED"],
    PIPELINE_INACTIVE_COLOR,
    PIPELINE_COLOR,
  ];
  const notYetBuilt: FilterSpecification = ["in", ["get", "status"], ["literal", NOT_YET_BUILT]];

  map.addLayer({
    id: "pipelines-casing",
    type: "line",
    source: "pipelines",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isDark ? PIPELINE_CASING_COLOR.dark : PIPELINE_CASING_COLOR.light,
      "line-width": 6,
      "line-opacity": 0.55,
    },
  }, before);
  map.addLayer({
    id: "pipelines-solid",
    type: "line",
    source: "pipelines",
    filter: ["!", notYetBuilt],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": lineColor, "line-width": lineWidth },
  }, before);
  map.addLayer({
    id: "pipelines-dashed",
    type: "line",
    source: "pipelines",
    filter: notYetBuilt,
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: { "line-color": lineColor, "line-width": lineWidth, "line-dasharray": [2, 1.5] },
  }, before);
  map.addLayer({
    id: "pipelines-hit",
    type: "line",
    source: "pipelines",
    paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 14 },
  }, before);

  applyPipelineHighlight(map, selectedPipelineId);
}

// Gas-flow overlay: moving white dashes plus arrows, drawn on a source whose lines all
// run in the configured flow direction (see lib/network/flow.ts).
function addFlowLayers(
  map: MapLibreMap,
  routes: NetworkGeoJson["routes"],
  pipelines: PipelineDto[],
  beforeLayerId?: string
) {
  if (map.getSource("flow")) return;
  addFlowArrowImages(map);
  map.addSource("flow", { type: "geojson", data: buildFlowGeoJson(routes, pipelines) });
  const before = beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined;

  map.addLayer(
    {
      id: "flow-pulse",
      type: "line",
      source: "flow",
      minzoom: 7,
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.75,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          ["match", ["get", "kind"], "steel", 1, 0.75],
          13,
          ["match", ["get", "kind"], "steel", 2, "pipelines", 1.75, 1.5],
        ],
        "line-dasharray": FLOW_DASH_STEPS[0],
      },
    },
    before
  );
  map.addLayer(
    {
      id: "flow-arrows",
      type: "symbol",
      source: "flow",
      minzoom: 9,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 90,
        "icon-image": [
          "match",
          ["get", "kind"],
          "steel",
          flowArrowImageId("steel"),
          "mdpe",
          flowArrowImageId("mdpe"),
          flowArrowImageId("pipelines"),
        ],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          ["match", ["get", "kind"], "steel", 0.9, 0.75],
          14,
          ["match", ["get", "kind"], "steel", 1.3, 1.1],
        ],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    before
  );
}

// Service connections from each industrial consumer to the line that supplies it: a
// dotted violet line (consumers are violet) ending in a small tap point on the main.
// Dotted keeps them apart from solid pipelines and dashed boundaries or planned lines.
const CONNECTION_COLOR = "#8b5cf6";
const CONNECTION_INTERRUPTED_COLOR = "#f59e0b";
const CONNECTIONS_MIN_ZOOM = 14; // consumers stop clustering above zoom 13

function addConnectionLayers(
  map: MapLibreMap,
  connections: ConsumerConnectionResult,
  beforeLayerId?: string
) {
  if (map.getSource("connections")) return;
  map.addSource("connections", { type: "geojson", data: connections.lines });
  map.addSource("connection-taps", { type: "geojson", data: connections.tapPoints });
  const before = beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined;
  const color: ExpressionSpecification = [
    "case",
    ["==", ["get", "status"], "SUPPLY_INTERRUPTED"],
    CONNECTION_INTERRUPTED_COLOR,
    CONNECTION_COLOR,
  ];

  map.addLayer(
    {
      id: "connections-line",
      type: "line",
      source: "connections",
      minzoom: CONNECTIONS_MIN_ZOOM,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": 1.5,
        "line-opacity": 0.75,
        "line-dasharray": [0.2, 2],
      },
    },
    before
  );
  map.addLayer(
    {
      id: "connections-tap",
      type: "circle",
      source: "connection-taps",
      minzoom: CONNECTIONS_MIN_ZOOM + 1,
      paint: {
        "circle-color": color,
        "circle-radius": 3,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    },
    before
  );
  map.addLayer(
    {
      id: "connections-hit",
      type: "line",
      source: "connections",
      minzoom: CONNECTIONS_MIN_ZOOM,
      paint: { "line-color": "#000000", "line-opacity": 0, "line-width": 10 },
    },
    before
  );
}

// Your position while reporting a fault: a blue dot with its GPS accuracy around it.
const USER_LOCATION_COLOR = "#2563eb";

function buildUserLocationData(location: DeviceLocation | null) {
  if (!location) {
    return {
      point: { type: "FeatureCollection" as const, features: [] },
      accuracy: { type: "FeatureCollection" as const, features: [] },
    };
  }
  const position: LngLat = [location.longitude, location.latitude];
  return {
    point: {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point" as const, coordinates: position },
        },
      ],
    },
    accuracy: {
      type: "FeatureCollection" as const,
      features: [circlePolygon(position, location.accuracyMeters)],
    },
  };
}

function addUserLocationLayers(map: MapLibreMap, location: DeviceLocation | null) {
  if (map.getSource("user-location")) return;
  const data = buildUserLocationData(location);
  map.addSource("user-accuracy", { type: "geojson", data: data.accuracy });
  map.addSource("user-location", { type: "geojson", data: data.point });
  map.addLayer({
    id: "user-accuracy",
    type: "fill",
    source: "user-accuracy",
    paint: { "fill-color": USER_LOCATION_COLOR, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "user-location",
    type: "circle",
    source: "user-location",
    paint: {
      "circle-color": USER_LOCATION_COLOR,
      "circle-radius": 7,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
    },
  });
}

function addNetworkLayers(
  map: MapLibreMap,
  data: NetworkGeoJson,
  faults: FaultReportDto[],
  pipelines: PipelineDto[],
  visibleLayers: VisibleLayers,
  selection: string,
  isDark: boolean,
  selectedPipelineId: string | null
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

  // Geographical area boundaries: one neutral colour and a dashed outline for every area.
  const boundaryColor = isDark ? GA_BOUNDARY_COLOR.dark : GA_BOUNDARY_COLOR.light;
  map.addSource("area-labels", { type: "geojson", data: data.areaLabels });
  map.addLayer({
    id: "ga-fill",
    type: "fill",
    source: "areas",
    paint: { "fill-color": boundaryColor, "fill-opacity": 0.05 },
  });
  map.addLayer({
    id: "ga-line",
    type: "line",
    source: "areas",
    layout: { "line-join": "round" },
    paint: {
      "line-color": boundaryColor,
      "line-width": 2,
      "line-dasharray": GA_BOUNDARY_DASH,
    },
  });

  map.addLayer({
    id: "mdpe",
    type: "line",
    source: "routes",
    filter: ["==", ["get", "material"], "MDPE"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": NETWORK_COLORS.mdpe,
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
      "line-color": NETWORK_COLORS.steel,
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

  // Registered pipelines sit above the demo network and below the point assets.
  addPipelineLayers(map, pipelines, isDark, selectedPipelineId);
  addFlowLayers(map, data.routes, pipelines);

  // Area names sit on the top edge of each boundary, clear of the assets inside.
  map.addLayer({
    id: "ga-labels",
    type: "symbol",
    source: "area-labels",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "bottom",
      "text-offset": [0, -0.3],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": boundaryColor,
      "text-halo-color": isDark ? GA_LABEL_HALO.dark : GA_LABEL_HALO.light,
      "text-halo-width": 1.5,
    },
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
  pipelines,
  selectedPipelineId,
  connections,
  userLocation,
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
  const pipelinesRef = useRef(pipelines);
  const selectedPipelineIdRef = useRef(selectedPipelineId);
  const connectionsRef = useRef(connections);
  const userLocationRef = useRef(userLocation);
  // Consumer details by ID, for hover and click (MapLibre only returns tile copies).
  const consumerByIdRef = useRef(new Map<string, { gaCode: string; loadScmh: number }>());
  const [hoverTooltip, setHoverTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    detail: string;
  } | null>(null);
  const isDarkRef = useRef(resolvedTheme === "dark");
  const onSelectAssetRef = useRef(onSelectAsset);

  const styleUrl = getMapStyleUrl(resolvedTheme);

  // Create the map once, then only swap the basemap when the theme changes.
  useEffect(() => {
    if (!resolvedTheme || !containerRef.current) return;
    isDarkRef.current = resolvedTheme === "dark";

    const existingMap = mapRef.current;
    if (existingMap) {
      if (currentStyleRef.current !== styleUrl) {
        currentStyleRef.current = styleUrl;
        // diff: false forces a full reload, so "style.load" fires and our layers are re-added.
        existingMap.setStyle(styleUrl, { diff: false });
      }
      return;
    }

    configureMapLibreWorker();

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
    consumerByIdRef.current = new Map(
      networkDataRef.current.consumers.features.map((feature) => [
        feature.properties.id,
        { gaCode: feature.properties.gaCode, loadScmh: feature.properties.loadScmh },
      ])
    );

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
        pipelinesRef.current,
        visibleLayersRef.current,
        selectionRef.current,
        isDarkRef.current,
        selectedPipelineIdRef.current
      );
      // Connections go under the consumer points; your location goes on top of everything.
      addConnectionLayers(map, connectionsRef.current, "industrial-clusters");
      addUserLocationLayers(map, userLocationRef.current);
      applyLayerVisibility(map, visibleLayersRef.current);
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
        if (layerId === "industrial-points" || layerId === "connections-hit") {
          const id = String(feature.properties?.id ?? feature.properties?.consumerId);
          const coordinates =
            layerId === "industrial-points" && feature.geometry.type === "Point"
              ? feature.geometry.coordinates
              : feature.geometry.type === "LineString"
                ? feature.geometry.coordinates[0]
                : null;
          const connection = connectionsRef.current.byConsumerId.get(id) ?? null;
          const consumer = consumerByIdRef.current.get(id);
          onSelectAssetRef.current(
            getConsumerDetails(
              {
                ...(consumer ?? feature.properties),
                id,
                gaCode: consumer?.gaCode ?? connection?.gaCode,
                longitude: coordinates?.[0],
                latitude: coordinates?.[1],
              },
              connection
            )
          );
          return;
        }
        onSelectAssetRef.current(getAssetDetails(layerId, feature.properties));
      });
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // Hovering a consumer or its connection shows where it is supplied from.
    for (const layerId of ["industrial-points", "connections-hit"]) {
      map.on("mousemove", layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const id = String(feature.properties?.id ?? feature.properties?.consumerId);
        const connection = connectionsRef.current.byConsumerId.get(id);
        const consumer = consumerByIdRef.current.get(id);
        const name = getConsumerName(id, consumer?.gaCode ?? connection?.gaCode ?? "");
        const detail =
          connection && connection.status !== "NOT_CONNECTED"
            ? `Service line to ${connection.lineCode} · ${connection.distanceM} m${
                connection.status === "SUPPLY_INTERRUPTED" ? " · line under maintenance" : ""
              }`
            : CONNECTION_STATUS_LABELS.NOT_CONNECTED;
        setHoverTooltip({ x: event.point.x, y: event.point.y, title: name, detail });
      });
      map.on("mouseleave", layerId, () => setHoverTooltip(null));
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

  // Keep registered pipelines in sync with the list from the server.
  useEffect(() => {
    pipelinesRef.current = pipelines;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("pipelines") as GeoJSONSource | undefined;
    const flowSource = map.getSource("flow") as GeoJSONSource | undefined;
    if (flowSource && networkDataRef.current) {
      flowSource.setData(buildFlowGeoJson(networkDataRef.current.routes, pipelines));
    }
    if (source) {
      source.setData(buildPipelineGeoJson(pipelines));
    } else if (map.getSource("areas")) {
      // The network is drawn but the pipeline layers are missing: add them now
      // rather than waiting for a reload. Otherwise "style.load" adds them with this data.
      addPipelineLayers(
        map,
        pipelines,
        isDarkRef.current,
        selectedPipelineIdRef.current,
        "industrial-clusters"
      );
      if (networkDataRef.current) {
        addFlowLayers(map, networkDataRef.current.routes, pipelines, "industrial-clusters");
      }
      applyLayerVisibility(map, visibleLayersRef.current);
    }
  }, [pipelines]);

  // Redraw consumer connections whenever pipelines change.
  useEffect(() => {
    connectionsRef.current = connections;
    const map = mapRef.current;
    if (!map) return;
    const lines = map.getSource("connections") as GeoJSONSource | undefined;
    const taps = map.getSource("connection-taps") as GeoJSONSource | undefined;
    if (lines && taps) {
      lines.setData(connections.lines);
      taps.setData(connections.tapPoints);
    } else if (map.getSource("areas")) {
      addConnectionLayers(map, connections, "industrial-clusters");
      applyLayerVisibility(map, visibleLayersRef.current);
    }
  }, [connections]);

  // Show (or move) your position while you report a fault.
  useEffect(() => {
    userLocationRef.current = userLocation;
    const map = mapRef.current;
    if (!map) return;
    const data = buildUserLocationData(userLocation);
    const point = map.getSource("user-location") as GeoJSONSource | undefined;
    const accuracy = map.getSource("user-accuracy") as GeoJSONSource | undefined;
    if (point && accuracy) {
      point.setData(data.point);
      accuracy.setData(data.accuracy);
    } else if (map.getSource("areas")) {
      addUserLocationLayers(map, userLocation);
    }
  }, [userLocation]);

  // Animate the flow dashes. Runs at a modest frame rate, pauses while the tab is hidden
  // or the flow layer is off, and is skipped entirely for people who prefer less motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    let step = 0;
    let lastTime = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (time - lastTime < FLOW_FRAME_MS) return;
      lastTime = time;
      const map = mapRef.current;
      if (!map || document.hidden || !visibleLayersRef.current.flow) return;
      if (!map.getLayer("flow-pulse")) return;
      step = (step + 1) % FLOW_DASH_STEPS.length;
      map.setPaintProperty("flow-pulse", "line-dasharray", FLOW_DASH_STEPS[step]);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    selectedPipelineIdRef.current = selectedPipelineId;
    if (mapRef.current) applyPipelineHighlight(mapRef.current, selectedPipelineId);
  }, [selectedPipelineId]);

  // Fly to a fault or pipeline, for example right after it has been reported or added.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) return;
    if (focusRequest.bounds) {
      map.fitBounds(new LngLatBounds(focusRequest.bounds[0], focusRequest.bounds[1]), {
        // Leave room for the detail card on the right, without over-padding small screens.
        padding: {
          top: 90,
          bottom: 60,
          left: 60,
          right: Math.min(320, map.getContainer().clientWidth * 0.35),
        },
        maxZoom: 15,
        duration: 1200,
      });
      return;
    }
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
      {hoverTooltip ? (
        <div
          role="tooltip"
          className="bg-foreground text-background pointer-events-none absolute z-20 max-w-64 rounded-md px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hoverTooltip.x + 14, top: hoverTooltip.y + 14 }}
        >
          <div className="font-medium">{hoverTooltip.title}</div>
          <div className="opacity-80">{hoverTooltip.detail}</div>
        </div>
      ) : null}
      {loadError ? (
        <div className="bg-background/90 absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 p-6 text-center">
          <p className="text-sm font-medium">The map could not be loaded</p>
          <p className="text-muted-foreground max-w-md text-xs">{loadError}</p>
        </div>
      ) : null}
    </>
  );
}
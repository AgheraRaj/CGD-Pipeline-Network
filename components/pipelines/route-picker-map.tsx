"use client";

import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, LineString, Point } from "geojson";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { getMapStyleUrl, configureMapLibreWorker } from "@/lib/network/map-styles";
import { getGeographicalArea } from "@/lib/network/dummy-data";
import type { LngLat } from "@/lib/network/types";
import { PIPELINE_COLOR, PIPELINE_INACTIVE_COLOR } from "@/lib/pipelines/constants";

type RoutePickerMapProps = {
  points: LngLat[];
  // Other registered pipelines, drawn faintly for reference.
  referenceRoutes: LngLat[][];
  gaCode: string;
  isPicking: boolean;
  onAddPoint: (point: LngLat) => void;
};

function buildDraftData(points: LngLat[]) {
  const line: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features:
      points.length >= 2
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } }]
        : [],
  };
  const vertices: FeatureCollection<Point, { label: string; role: string }> = {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      properties: {
        label: String(index + 1),
        role: index === 0 ? "start" : index === points.length - 1 ? "end" : "bend",
      },
      geometry: { type: "Point", coordinates: point },
    })),
  };
  return { line, vertices };
}

function buildReferenceData(routes: LngLat[][]): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: routes
      .filter((route) => route.length >= 2)
      .map((route) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: route },
      })),
  };
}

function addDraftLayers(map: MapLibreMap, points: LngLat[], referenceRoutes: LngLat[][]) {
  if (map.getSource("draft-line")) return;
  const { line, vertices } = buildDraftData(points);
  map.addSource("reference-routes", { type: "geojson", data: buildReferenceData(referenceRoutes) });
  map.addSource("draft-line", { type: "geojson", data: line });
  map.addSource("draft-vertices", { type: "geojson", data: vertices });

  map.addLayer({
    id: "reference-routes",
    type: "line",
    source: "reference-routes",
    layout: { "line-cap": "round" },
    paint: { "line-color": PIPELINE_INACTIVE_COLOR, "line-width": 2, "line-opacity": 0.7 },
  });
  map.addLayer({
    id: "draft-line-casing",
    type: "line",
    source: "draft-line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#083344", "line-width": 7, "line-opacity": 0.6 },
  });
  map.addLayer({
    id: "draft-line",
    type: "line",
    source: "draft-line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": PIPELINE_COLOR, "line-width": 4 },
  });
  map.addLayer({
    id: "draft-vertices",
    type: "circle",
    source: "draft-vertices",
    paint: {
      "circle-radius": ["match", ["get", "role"], "bend", 6, 9],
      "circle-color": [
        "match",
        ["get", "role"],
        "start",
        "#10b981",
        "end",
        "#ef4444",
        "#ffffff",
      ],
      "circle-stroke-color": "#083344",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "draft-vertex-labels",
    type: "symbol",
    source: "draft-vertices",
    filter: ["!=", ["get", "role"], "bend"],
    layout: {
      "text-field": ["match", ["get", "role"], "start", "A", "B"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#ffffff" },
  });
}

export function RoutePickerMap({
  points,
  referenceRoutes,
  gaCode,
  isPicking,
  onAddPoint,
}: RoutePickerMapProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleUrlRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pointsRef = useRef(points);
  const referenceRoutesRef = useRef(referenceRoutes);
  const isPickingRef = useRef(isPicking);
  const onAddPointRef = useRef(onAddPoint);
  const gaCodeRef = useRef(gaCode);

  const styleUrl = getMapStyleUrl(resolvedTheme);

  useEffect(() => {
    if (!resolvedTheme || !containerRef.current) return;

    const existingMap = mapRef.current;
    if (existingMap) {
      if (styleUrlRef.current !== styleUrl) {
        styleUrlRef.current = styleUrl;
        existingMap.setStyle(styleUrl, { diff: false });
      }
      return;
    }

    configureMapLibreWorker();
    const area = getGeographicalArea(gaCodeRef.current);
    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: area?.center ?? [72.75, 23.0],
      zoom: area ? 10 : 8,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    styleUrlRef.current = styleUrl;

    map.setMissingStyleImageResolver((imageId) => {
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    // When editing, start zoomed to the existing route.
    if (pointsRef.current.length >= 2) {
      const bounds = new LngLatBounds();
      for (const point of pointsRef.current) bounds.extend(point);
      map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 15 });
    } else if (pointsRef.current.length === 1) {
      map.jumpTo({ center: pointsRef.current[0], zoom: 13 });
    }

    map.on("style.load", () => {
      setLoadError(null);
      addDraftLayers(map, pointsRef.current, referenceRoutesRef.current);
    });
    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (!map.isStyleLoaded() && !message.includes("does not exist in the map's style")) {
        setLoadError(message || "The map could not be loaded.");
      }
    });
    map.on("click", (event) => {
      if (!isPickingRef.current) return;
      onAddPointRef.current([event.lngLat.lng, event.lngLat.lat]);
    });

    // The dialog animates open, so measure again once it has its final size.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [resolvedTheme, styleUrl]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      styleUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  }, [onAddPoint]);

  useEffect(() => {
    isPickingRef.current = isPicking;
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = isPicking ? "crosshair" : "";
  }, [isPicking]);

  useEffect(() => {
    pointsRef.current = points;
    const map = mapRef.current;
    if (!map) return;
    const { line, vertices } = buildDraftData(points);
    (map.getSource("draft-line") as GeoJSONSource | undefined)?.setData(line);
    (map.getSource("draft-vertices") as GeoJSONSource | undefined)?.setData(vertices);
  }, [points]);

  useEffect(() => {
    referenceRoutesRef.current = referenceRoutes;
    const source = mapRef.current?.getSource("reference-routes") as GeoJSONSource | undefined;
    source?.setData(buildReferenceData(referenceRoutes));
  }, [referenceRoutes]);

  // Picking a different area moves the map there, unless a route is already drawn.
  useEffect(() => {
    gaCodeRef.current = gaCode;
    const map = mapRef.current;
    const area = getGeographicalArea(gaCode);
    if (!map || !area || pointsRef.current.length > 0) return;
    map.easeTo({ center: area.center, zoom: 10 });
  }, [gaCode]);

  return (
    <div className="relative h-64 overflow-hidden rounded-lg border sm:h-72">
      <div className="absolute inset-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
      {loadError ? (
        <div className="bg-background/90 absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 p-4 text-center">
          <p className="text-sm font-medium">The map could not be loaded</p>
          <p className="text-muted-foreground text-xs">
            Enter the coordinates manually below. ({loadError})
          </p>
        </div>
      ) : null}
    </div>
  );
}

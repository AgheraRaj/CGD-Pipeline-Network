"use client";

import { LngLatBounds, Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Geometry } from "geojson";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import type { DeviceLocation } from "@/hooks/use-device-location";
import type { NearestPipeline } from "@/lib/faults/proximity";
import { pipelineRoutes } from "@/lib/network/dummy-data";
import { circlePolygon } from "@/lib/network/geo-shapes";
import { configureMapLibreWorker, getMapStyleUrl } from "@/lib/network/map-styles";
import { NETWORK_COLORS } from "@/lib/network/map-theme";
import type { LngLat } from "@/lib/network/types";
import type { PipelineDto } from "@/lib/pipelines/types";

type FaultLocationMapProps = {
  location: DeviceLocation;
  nearest: NearestPipeline | null;
  maxDistanceMeters: number;
  isWithinRange: boolean;
  pipelines: PipelineDto[];
};

const USER_COLOR = "#2563eb";

const empty = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

function buildData({ location, nearest, maxDistanceMeters }: FaultLocationMapProps) {
  const position: LngLat = [location.longitude, location.latitude];
  const point = (coordinates: LngLat): Geometry => ({ type: "Point", coordinates });
  return {
    user: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: point(position) }],
    } as FeatureCollection,
    accuracy: {
      type: "FeatureCollection",
      features: [circlePolygon(position, location.accuracyMeters)],
    } as FeatureCollection,
    range: {
      type: "FeatureCollection",
      features: [circlePolygon(position, maxDistanceMeters)],
    } as FeatureCollection,
    link: nearest
      ? ({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: [position, nearest.pointOnLine] },
            },
          ],
        } as FeatureCollection)
      : empty(),
  };
}

function buildPipelines(pipelines: PipelineDto[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      ...pipelineRoutes.map((route) => ({
        type: "Feature" as const,
        properties: { kind: route.material === "STEEL" ? "steel" : "mdpe", ref: route.id },
        geometry: { type: "LineString" as const, coordinates: route.coordinates },
      })),
      ...pipelines
        .filter((pipeline) => pipeline.status !== "PLANNED" && pipeline.routeCoordinates.length >= 2)
        .map((pipeline) => ({
          type: "Feature" as const,
          properties: { kind: "pipelines", ref: pipeline.id },
          geometry: { type: "LineString" as const, coordinates: pipeline.routeCoordinates },
        })),
    ],
  };
}

// A small map inside the report dialog: where you are, how precise that is, the
// reporting range around you and the nearest pipeline.
export function FaultLocationMap(props: FaultLocationMapProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!resolvedTheme || !containerRef.current) return;
    configureMapLibreWorker();
    const isDark = resolvedTheme === "dark";
    const map = new MapLibreMap({
      container: containerRef.current,
      style: getMapStyleUrl(resolvedTheme),
      center: [propsRef.current.location.longitude, propsRef.current.location.latitude],
      zoom: 16,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.setMissingStyleImageResolver((imageId) => {
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });

    map.on("style.load", () => {
      const current = propsRef.current;
      const data = buildData(current);
      map.addSource("pipelines", { type: "geojson", data: buildPipelines(current.pipelines) });
      map.addSource("range", { type: "geojson", data: data.range });
      map.addSource("accuracy", { type: "geojson", data: data.accuracy });
      map.addSource("link", { type: "geojson", data: data.link });
      map.addSource("user", { type: "geojson", data: data.user });

      map.addLayer({
        id: "range",
        type: "line",
        source: "range",
        paint: {
          "line-color": isDark ? "#e2e8f0" : "#334155",
          "line-width": 1.5,
          "line-dasharray": [1, 2],
        },
      });
      map.addLayer({
        id: "pipelines",
        type: "line",
        source: "pipelines",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
            "steel",
            NETWORK_COLORS.steel,
            "mdpe",
            NETWORK_COLORS.mdpe,
            NETWORK_COLORS.pipelines,
          ],
          "line-width": ["case", ["==", ["get", "ref"], current.nearest?.ref ?? ""], 6, 3],
        },
      });
      map.addLayer({
        id: "link",
        type: "line",
        source: "link",
        paint: {
          "line-color": current.isWithinRange ? "#10b981" : "#ef4444",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });
      map.addLayer({
        id: "accuracy",
        type: "fill",
        source: "accuracy",
        paint: { "fill-color": USER_COLOR, "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "user",
        type: "circle",
        source: "user",
        paint: {
          "circle-color": USER_COLOR,
          "circle-radius": 7,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      // Frame both you and the nearest point of the pipeline.
      const bounds = new LngLatBounds();
      bounds.extend([current.location.longitude, current.location.latitude]);
      if (current.nearest) bounds.extend(current.nearest.pointOnLine);
      map.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [resolvedTheme]);

  // Move everything when a new location fix arrives. The parent memoises `nearest`, so
  // this only runs for a new fix, not on every render.
  const { location, nearest, isWithinRange, maxDistanceMeters } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("user")) return;
    const data = buildData({ ...propsRef.current, location, nearest, maxDistanceMeters });
    (map.getSource("user") as GeoJSONSource).setData(data.user);
    (map.getSource("accuracy") as GeoJSONSource).setData(data.accuracy);
    (map.getSource("range") as GeoJSONSource).setData(data.range);
    (map.getSource("link") as GeoJSONSource).setData(data.link);
    map.setPaintProperty("link", "line-color", isWithinRange ? "#10b981" : "#ef4444");
    map.setPaintProperty("pipelines", "line-width", [
      "case",
      ["==", ["get", "ref"], nearest?.ref ?? ""],
      6,
      3,
    ]);
    const bounds = new LngLatBounds();
    bounds.extend([location.longitude, location.latitude]);
    if (nearest) bounds.extend(nearest.pointOnLine);
    map.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 600 });
  }, [location, nearest, isWithinRange, maxDistanceMeters]);

  return (
    <div className="relative h-48 overflow-hidden rounded-lg border">
      <div className="absolute inset-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}

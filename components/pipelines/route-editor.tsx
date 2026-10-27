"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, MousePointerClick, Plus, Trash2, Undo2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKilometres } from "@/lib/format";
import type { LngLat } from "@/lib/network/types";
import { PIPELINE_LIMITS } from "@/lib/pipelines/constants";
import { getRouteBearingLabel, isValidLatitude, isValidLongitude } from "@/lib/pipelines/validation";
import { lineLengthKm } from "@/lib/network/geo";

// MapLibre needs the browser, so it is loaded on the client only.
const RoutePickerMap = dynamic(
  () => import("@/components/pipelines/route-picker-map").then((module) => module.RoutePickerMap),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-lg sm:h-72" /> }
);

export type RouteRow = { key: string; latitude: string; longitude: string };

let rowCounter = 0;
export function createRouteRow(point?: LngLat): RouteRow {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    latitude: point ? point[1].toFixed(6) : "",
    longitude: point ? point[0].toFixed(6) : "",
  };
}

// Only complete, valid rows are drawn; the form's validation reports the rest.
export function getValidRoutePoints(rows: RouteRow[]): LngLat[] {
  return rows.flatMap((row) => {
    if (row.latitude.trim() === "" || row.longitude.trim() === "") return [];
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    return isValidLatitude(latitude) && isValidLongitude(longitude)
      ? [[longitude, latitude] as LngLat]
      : [];
  });
}

function rowLabel(index: number, count: number) {
  if (index === 0) return "Start (A)";
  if (index === count - 1 && count > 1) return "End (B)";
  return `Bend ${index}`;
}

type RouteEditorProps = {
  rows: RouteRow[];
  onRowsChange: (rows: RouteRow[]) => void;
  isPicking: boolean;
  onPickingChange: (isPicking: boolean) => void;
  referenceRoutes: LngLat[][];
  gaCode: string;
  error?: string;
  disabled: boolean;
};

export function RouteEditor({
  rows,
  onRowsChange,
  isPicking,
  onPickingChange,
  referenceRoutes,
  gaCode,
  error,
  disabled,
}: RouteEditorProps) {
  const points = getValidRoutePoints(rows);
  const drawnKm = points.length >= 2 ? lineLengthKm(points) : 0;
  const bearing = getRouteBearingLabel(points);
  const canAddMore = rows.length < PIPELINE_LIMITS.maxPoints;

  const handleAddPoint = useCallback(
    (point: LngLat) => {
      if (disabled || rows.length >= PIPELINE_LIMITS.maxPoints) return;
      onRowsChange([...rows, createRouteRow(point)]);
    },
    [disabled, rows, onRowsChange]
  );

  function updateRow(index: number, field: "latitude" | "longitude", value: string) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function moveRow(index: number, offset: -1 | 1) {
    const next = [...rows];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onRowsChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={isPicking ? "default" : "outline"}
          aria-pressed={isPicking}
          disabled={disabled}
          onClick={() => onPickingChange(!isPicking)}
        >
          <MousePointerClick className="size-4" />
          {isPicking ? "Stop picking" : "Pick on map"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || rows.length === 0}
          onClick={() => onRowsChange(rows.slice(0, -1))}
        >
          <Undo2 className="size-4" />
          Undo last
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || rows.length < 2}
          onClick={() => onRowsChange([...rows].reverse())}
        >
          <ArrowUpDown className="size-4" />
          Reverse
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || rows.length === 0}
          onClick={() => onRowsChange([])}
        >
          <Trash2 className="size-4" />
          Clear
        </Button>
      </div>

      <p className="text-muted-foreground text-xs" aria-live="polite">
        {isPicking
          ? "Click the map to add points in order: start, every bend, then the end."
          : "Use “Pick on map” to click the route, or type coordinates below."}{" "}
        {points.length >= 2
          ? `Drawn route: ${formatKilometres(drawnKm)} · heading ${bearing} · ${points.length} points.`
          : null}
      </p>

      <RoutePickerMap
        points={points}
        referenceRoutes={referenceRoutes}
        gaCode={gaCode}
        isPicking={isPicking && !disabled}
        onAddPoint={handleAddPoint}
      />

      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-center text-xs">
            No points yet.
          </p>
        ) : null}
        {rows.map((row, index) => {
          const latitude = Number(row.latitude);
          const longitude = Number(row.longitude);
          const latInvalid = row.latitude.trim() !== "" && !isValidLatitude(latitude);
          const lngInvalid = row.longitude.trim() !== "" && !isValidLongitude(longitude);
          return (
            <div key={row.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <span className="text-muted-foreground w-20 shrink-0 text-xs font-medium">
                {rowLabel(index, rows.length)}
              </span>
              <Input
                aria-label={`${rowLabel(index, rows.length)} latitude`}
                inputMode="decimal"
                placeholder="Latitude"
                value={row.latitude}
                aria-invalid={latInvalid || undefined}
                disabled={disabled}
                onChange={(event) => updateRow(index, "latitude", event.target.value)}
                className="min-w-28 flex-1 font-mono text-xs"
              />
              <Input
                aria-label={`${rowLabel(index, rows.length)} longitude`}
                inputMode="decimal"
                placeholder="Longitude"
                value={row.longitude}
                aria-invalid={lngInvalid || undefined}
                disabled={disabled}
                onChange={(event) => updateRow(index, "longitude", event.target.value)}
                className="min-w-28 flex-1 font-mono text-xs"
              />
              <div className="flex shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move point up"
                  disabled={disabled || index === 0}
                  onClick={() => moveRow(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move point down"
                  disabled={disabled || index === rows.length - 1}
                  onClick={() => moveRow(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove point"
                  disabled={disabled}
                  onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={disabled || !canAddMore}
          onClick={() => onRowsChange([...rows, createRouteRow()])}
        >
          <Plus className="size-4" />
          Add point manually
        </Button>
      </div>

      {error ? (
        <p id="routeCoordinates-error" className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

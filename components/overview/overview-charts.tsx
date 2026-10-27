import { formatKilometres, formatNumber } from "@/lib/format";
import { NETWORK_COLORS } from "@/lib/network/map-theme";
import type { AreaBreakdown } from "@/lib/overview/metrics";
import { cn } from "cn";

// Small dependency-free charts built from plain elements, so they follow the theme and
// stay readable as text for screen readers.

export type BarListItem = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
  barClassName: string;
};

export function BarList({ items, emptyText }: { items: BarListItem[]; emptyText: string }) {
  const max = Math.max(...items.map((item) => item.value), 0);
  if (max === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span>{item.label}</span>
            <span className="text-right tabular-nums">
              <span className="font-medium">{item.valueLabel}</span>
              {item.detail ? (
                <span className="text-muted-foreground ml-1.5 text-xs">{item.detail}</span>
              ) : null}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", item.barClassName)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const LENGTH_SERIES = [
  { key: "steelKm", label: "Steel", color: NETWORK_COLORS.steel },
  { key: "mdpeKm", label: "MDPE", color: NETWORK_COLORS.mdpe },
  { key: "registeredKm", label: "Registered", color: NETWORK_COLORS.pipelines },
] as const;

export function AreaLengthChart({
  areas,
  selection,
  onSelect,
}: {
  areas: AreaBreakdown[];
  selection: string;
  onSelect: (code: string) => void;
}) {
  const max = Math.max(...areas.map((area) => area.totalKm), 1);
  const isFiltered = areas.some((area) => area.code === selection);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {areas.map((area) => {
          const dimmed = isFiltered && area.code !== selection;
          return (
            <li key={area.code}>
              <button
                type="button"
                onClick={() => onSelect(area.code)}
                aria-pressed={area.code === selection}
                className={cn(
                  "hover:bg-accent -mx-2 w-[calc(100%+1rem)] space-y-1.5 rounded-lg px-2 py-1 text-left transition-opacity",
                  dimmed && "opacity-45"
                )}
                aria-label={`${area.name}: ${formatKilometres(area.totalKm)} — steel ${formatKilometres(area.steelKm)}, MDPE ${formatKilometres(area.mdpeKm)}, registered ${formatKilometres(area.registeredKm)}`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{area.name}</span>
                  <span className="tabular-nums">{formatKilometres(area.totalKm)}</span>
                </div>
                <div
                  className="bg-muted flex h-2.5 overflow-hidden rounded-full"
                  style={{ width: `${Math.max((area.totalKm / max) * 100, 2)}%` }}
                >
                  {LENGTH_SERIES.map((series) =>
                    area[series.key] > 0 ? (
                      <div
                        key={series.key}
                        className="h-full transition-[width] duration-500"
                        style={{
                          width: `${(area[series.key] / area.totalKm) * 100}%`,
                          backgroundColor: series.color,
                        }}
                      />
                    ) : null
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {LENGTH_SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConnectionsChart({ areas, selection }: { areas: AreaBreakdown[]; selection: string }) {
  const isFiltered = areas.some((area) => area.code === selection);
  return (
    <BarList
      emptyText="No connections recorded."
      items={areas.map((area) => ({
        key: area.code,
        label: area.name,
        value: area.domesticConnections,
        valueLabel: formatNumber(area.domesticConnections),
        detail: `${formatNumber(area.industrialUnits)} industrial · ${formatNumber(area.commercialUnits)} commercial`,
        barClassName: cn("bg-primary", isFiltered && area.code !== selection && "opacity-35"),
      }))}
    />
  );
}

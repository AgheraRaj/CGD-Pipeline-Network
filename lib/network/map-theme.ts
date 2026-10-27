// One place for the colours and styles each map layer uses, so the map, the side panel
// legend and the Overview charts always agree.

export const NETWORK_COLORS = {
  steel: "#f59e0b",
  mdpe: "#3b82f6",
  pipelines: "#06b6d4",
  cgs: "#f97316",
  industrial: "#8b5cf6",
  faults: "#ef4444",
} as const;

// Geographical area boundaries use a neutral slate that no asset layer uses, with a
// dashed outline (pipelines are solid). The two values match Tailwind's slate-600 and
// slate-300, which the legend uses, so the legend swatch and the map line are identical.
export const GA_BOUNDARY_COLOR = { light: "#475569", dark: "#cbd5e1" } as const;
export const GA_BOUNDARY_DASH: [number, number] = [3, 2];
export const GA_LABEL_HALO = { light: "#ffffff", dark: "#111827" } as const;

// Tailwind classes for legend swatches. Kept as full literal strings so Tailwind finds them.
export const GA_BOUNDARY_SWATCH_CLASS =
  "border-2 border-dashed border-slate-600 bg-slate-600/10 dark:border-slate-300 dark:bg-slate-300/10";

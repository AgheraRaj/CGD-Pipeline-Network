import type { NetworkLayerId } from "./types";

export type NetworkLayerDefinition = {
  id: NetworkLayerId;
  label: string;
  description: string;
  color: string;
  shape: "line" | "dot";
};

export const networkLayers: NetworkLayerDefinition[] = [
  {
    id: "steel",
    label: "Steel trunk mains",
    description:
      "High-pressure steel pipelines (MAOP ≥ 19 bar) that carry gas from City Gate Stations to each area.",
    color: "#f59e0b",
    shape: "line",
  },
  {
    id: "mdpe",
    label: "MDPE distribution",
    description:
      "Medium-density polyethylene lines (≤ 4 bar) that distribute gas to neighbourhoods and customers.",
    color: "#3b82f6",
    shape: "line",
  },
  {
    id: "cgs",
    label: "City Gate Stations (CGS)",
    description:
      "Entry points where gas arrives from the transmission pipeline and its pressure is reduced.",
    color: "#f97316",
    shape: "dot",
  },
  {
    id: "industrial",
    label: "Industrial consumers",
    description:
      "Factories and industrial units connected to the network. They group into clusters when zoomed out.",
    color: "#8b5cf6",
    shape: "dot",
  },
  {
    id: "faults",
    label: "Reported faults",
    description:
      "Faults reported by field staff with a photograph. Larger markers are more severe; resolved faults turn grey.",
    color: "#ef4444",
    shape: "dot",
  },
];
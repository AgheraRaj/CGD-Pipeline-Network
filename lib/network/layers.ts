import { NETWORK_COLORS } from "./map-theme";
import type { NetworkLayerId } from "./types";

export type NetworkLayerDefinition = {
  id: NetworkLayerId;
  label: string;
  description: string;
  color: string;
  shape: "line" | "dot" | "flow";
};

export const networkLayers: NetworkLayerDefinition[] = [
  {
    id: "steel",
    label: "Steel trunk mains",
    description:
      "High-pressure steel pipelines (MAOP ≥ 19 bar) that carry gas from City Gate Stations to each area.",
    color: NETWORK_COLORS.steel,
    shape: "line",
  },
  {
    id: "mdpe",
    label: "MDPE distribution",
    description:
      "Medium-density polyethylene lines (≤ 4 bar) that distribute gas to neighbourhoods and customers.",
    color: NETWORK_COLORS.mdpe,
    shape: "line",
  },
  {
    id: "pipelines",
    label: "Registered pipelines",
    description:
      "Pipelines added through Pipeline management, with a dark outline. Dashed lines are planned or under construction; grey lines are decommissioned.",
    color: NETWORK_COLORS.pipelines,
    shape: "line",
  },
  {
    id: "flow",
    label: "Gas flow direction",
    description:
      "Arrows and moving dashes show each line's configured flow direction, away from its supply point. This is not a live flow measurement. Shown on operational lines; bidirectional pipelines have no arrows.",
    color: "#64748b",
    shape: "flow",
  },
  {
    id: "cgs",
    label: "City Gate Stations (CGS)",
    description:
      "Entry points where gas arrives from the transmission pipeline and its pressure is reduced.",
    color: NETWORK_COLORS.cgs,
    shape: "dot",
  },
  {
    id: "industrial",
    label: "Industrial consumers",
    description:
      "Factories and industrial units connected to the network. They group into clusters when zoomed out.",
    color: NETWORK_COLORS.industrial,
    shape: "dot",
  },
  {
    id: "faults",
    label: "Reported faults",
    description:
      "Faults reported by field staff with a photograph. Larger markers are more severe; resolved faults turn grey.",
    color: NETWORK_COLORS.faults,
    shape: "dot",
  },
];
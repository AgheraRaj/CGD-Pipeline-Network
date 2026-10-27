export const pipelineMaterials = [
  { value: "STEEL", label: "Steel (API 5L)" },
  { value: "MDPE", label: "MDPE" },
  { value: "HDPE", label: "HDPE" },
  { value: "DUCTILE_IRON", label: "Ductile iron" },
  { value: "OTHER", label: "Other" },
] as const;

export const pipelineTypes = [
  { value: "TRANSMISSION", label: "Transmission" },
  { value: "TRUNK_MAIN", label: "Trunk main" },
  { value: "DISTRIBUTION", label: "Distribution" },
  { value: "SERVICE_LINE", label: "Service line" },
] as const;

export const pipelineStatuses = [
  { value: "PLANNED", label: "Planned" },
  { value: "UNDER_CONSTRUCTION", label: "Under construction" },
  { value: "OPERATIONAL", label: "Operational" },
  { value: "UNDER_MAINTENANCE", label: "Under maintenance" },
  { value: "DECOMMISSIONED", label: "Decommissioned" },
] as const;

export const pipelineFlowDirections = [
  { value: "FORWARD", label: "Start → End" },
  { value: "REVERSE", label: "End → Start" },
  { value: "BIDIRECTIONAL", label: "Bidirectional" },
] as const;

export type PipelineMaterialValue = (typeof pipelineMaterials)[number]["value"];
export type PipelineTypeValue = (typeof pipelineTypes)[number]["value"];
export type PipelineStatusValue = (typeof pipelineStatuses)[number]["value"];
export type PipelineFlowDirectionValue = (typeof pipelineFlowDirections)[number]["value"];

type Option = { value: string; label: string };

function labelFor(options: readonly Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export const getPipelineMaterialLabel = (value: string) => labelFor(pipelineMaterials, value);
export const getPipelineTypeLabel = (value: string) => labelFor(pipelineTypes, value);
export const getPipelineStatusLabel = (value: string) => labelFor(pipelineStatuses, value);
export const getPipelineFlowDirectionLabel = (value: string) =>
  labelFor(pipelineFlowDirections, value);

// Registered pipelines use one colour that none of the demo layers use, so they stand out
// on both the light and the dark basemap. Status is shown with dashes and grey instead.
export const PIPELINE_COLOR = "#06b6d4";
export const PIPELINE_INACTIVE_COLOR = "#94a3b8";

export const PIPELINE_LIMITS = {
  codePattern: /^[A-Z0-9][A-Z0-9_/-]{2,39}$/,
  nameMin: 3,
  nameMax: 120,
  descriptionMax: 1000,
  routeDescriptionMax: 300,
  minPoints: 2,
  maxPoints: 500,
  lengthMaxKm: 2000,
  depthMinM: 0.3,
  depthMaxM: 50,
  diameterMinMm: 10,
  diameterMaxMm: 2000,
  pressureMaxBar: 200,
  // The entered length may be longer than the drawn route (sag, slack, vertical runs) but
  // never meaningfully shorter, and not wildly longer either.
  lengthMinRatio: 0.95,
  lengthMaxRatio: 3,
  // Two consecutive points closer than this are treated as a duplicate click.
  minSegmentKm: 0.001,
} as const;

// Tailwind classes for the status dot shown in tables and cards.
export const pipelineStatusDotClass: Record<PipelineStatusValue, string> = {
  PLANNED: "bg-sky-400",
  UNDER_CONSTRUCTION: "bg-amber-500",
  OPERATIONAL: "bg-emerald-500",
  UNDER_MAINTENANCE: "bg-orange-500",
  DECOMMISSIONED: "bg-slate-400",
};

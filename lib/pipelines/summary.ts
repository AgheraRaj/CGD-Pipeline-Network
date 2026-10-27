import { ALL_AREAS } from "@/lib/network/dummy-data";
import { countFlowLines } from "@/lib/network/flow";
import type { PipelineDto } from "./types";

export type PipelineSummary = {
  count: number;
  totalKm: number;
  operationalCount: number;
  operationalKm: number;
  // Operational pipelines with a set (one-way) flow direction, i.e. those showing arrows.
  flowCount: number;
};

export function filterPipelinesBySelection(pipelines: PipelineDto[], selection: string) {
  return selection === ALL_AREAS
    ? pipelines
    : pipelines.filter((pipeline) => pipeline.gaCode === selection);
}

export function getPipelineSummary(pipelines: PipelineDto[], selection: string): PipelineSummary {
  const selected = filterPipelinesBySelection(pipelines, selection);
  const operational = selected.filter((pipeline) => pipeline.status === "OPERATIONAL");
  const sum = (items: PipelineDto[]) => items.reduce((total, item) => total + item.lengthKm, 0);
  return {
    count: selected.length,
    totalKm: sum(selected),
    operationalCount: operational.length,
    operationalKm: sum(operational),
    flowCount: countFlowLines(selected),
  };
}

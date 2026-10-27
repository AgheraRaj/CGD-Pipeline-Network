import type { LngLat } from "@/lib/network/types";
import type {
  PipelineFlowDirectionValue,
  PipelineMaterialValue,
  PipelineStatusValue,
  PipelineTypeValue,
} from "./constants";

// Fields a user enters, shared by the create and edit forms and the API.
export type PipelineInput = {
  pipelineCode: string;
  name: string;
  description: string | null;
  material: PipelineMaterialValue;
  pipelineType: PipelineTypeValue;
  status: PipelineStatusValue;
  diameterMm: number;
  lengthKm: number;
  depthM: number;
  pressureRatingBar: number | null;
  gaCode: string;
  installationDate: string; // YYYY-MM-DD
  flowDirection: PipelineFlowDirectionValue;
  routeDescription: string | null;
  routeCoordinates: LngLat[];
};

// The shape of a pipeline as sent from the API to the browser.
export type PipelineDto = PipelineInput & {
  id: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineFieldErrors = Partial<Record<keyof PipelineInput, string>>;

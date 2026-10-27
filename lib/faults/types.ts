import type {
  FaultSeverityValue,
  FaultStatusValue,
  FaultTypeValue,
} from "./constants";

// The shape of a fault report as sent from the API to the browser.
export type FaultReportDto = {
  id: string;
  title: string;
  description: string | null;
  faultType: FaultTypeValue;
  severity: FaultSeverityValue;
  status: FaultStatusValue;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
  createdAt: string;
  reportedByName: string;
  photoUrl: string | null;
  // The nearest known pipeline when the report was made. Null for older reports.
  nearestPipeline: {
    kind: string;
    ref: string | null;
    code: string;
    name: string;
    distanceM: number | null;
    pipelineId: string | null;
  } | null;
};
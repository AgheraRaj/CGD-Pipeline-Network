export const faultTypes = [
  { value: "GAS_LEAK", label: "Gas leak" },
  { value: "PIPE_DAMAGE", label: "Pipe damage" },
  { value: "CORROSION", label: "Corrosion" },
  { value: "EXPOSED_PIPE", label: "Exposed pipe" },
  { value: "THIRD_PARTY_DAMAGE", label: "Third-party damage" },
  { value: "OTHER", label: "Other" },
] as const;

export const faultSeverities = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export const faultStatuses = [
  { value: "REPORTED", label: "Reported" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

export type FaultTypeValue = (typeof faultTypes)[number]["value"];
export type FaultSeverityValue = (typeof faultSeverities)[number]["value"];
export type FaultStatusValue = (typeof faultStatuses)[number]["value"];

type Option = { value: string; label: string };

function labelFor(options: readonly Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export const getFaultTypeLabel = (value: string) => labelFor(faultTypes, value);
export const getFaultSeverityLabel = (value: string) => labelFor(faultSeverities, value);
export const getFaultStatusLabel = (value: string) => labelFor(faultStatuses, value);

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
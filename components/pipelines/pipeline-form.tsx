"use client";

import { LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createRouteRow,
  getValidRoutePoints,
  RouteEditor,
  type RouteRow,
} from "@/components/pipelines/route-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineMutationResult } from "@/hooks/use-pipelines";
import { geographicalAreas } from "@/lib/network/dummy-data";
import {
  PIPELINE_LIMITS,
  pipelineFlowDirections,
  pipelineMaterials,
  pipelineStatuses,
  pipelineTypes,
} from "@/lib/pipelines/constants";
import type { PipelineDto, PipelineFieldErrors, PipelineInput } from "@/lib/pipelines/types";
import {
  normalizePipelineCode,
  parsePipelineInput,
  routeLengthKm,
} from "@/lib/pipelines/validation";

type TextFields = Omit<
  Record<keyof PipelineInput, string>,
  "routeCoordinates"
>;

type PipelineFormProps = {
  pipeline?: PipelineDto;
  defaultGaCode?: string;
  // Already loaded pipelines, used to catch duplicate IDs early and draw the neighbours.
  existingPipelines: PipelineDto[];
  onSubmit: (input: PipelineInput) => Promise<PipelineMutationResult>;
  onSaved: (pipeline: PipelineDto) => void;
  onCancel: () => void;
};

const areaOptions = geographicalAreas.map((area) => ({ value: area.code, label: area.name }));

// Order used to move focus to the first field with an error.
const FIELD_ORDER: (keyof PipelineInput)[] = [
  "pipelineCode",
  "name",
  "gaCode",
  "pipelineType",
  "material",
  "status",
  "diameterMm",
  "depthM",
  "pressureRatingBar",
  "installationDate",
  "flowDirection",
  "routeCoordinates",
  "lengthKm",
  "routeDescription",
  "description",
];

function toTextFields(pipeline: PipelineDto | undefined, defaultGaCode: string): TextFields {
  if (!pipeline) {
    return {
      pipelineCode: "",
      name: "",
      description: "",
      material: "",
      pipelineType: "",
      status: "OPERATIONAL",
      diameterMm: "",
      lengthKm: "",
      depthM: "",
      pressureRatingBar: "",
      gaCode: defaultGaCode,
      installationDate: "",
      flowDirection: "FORWARD",
      routeDescription: "",
    };
  }
  return {
    pipelineCode: pipeline.pipelineCode,
    name: pipeline.name,
    description: pipeline.description ?? "",
    material: pipeline.material,
    pipelineType: pipeline.pipelineType,
    status: pipeline.status,
    diameterMm: String(pipeline.diameterMm),
    lengthKm: String(pipeline.lengthKm),
    depthM: String(pipeline.depthM),
    pressureRatingBar: pipeline.pressureRatingBar === null ? "" : String(pipeline.pressureRatingBar),
    gaCode: pipeline.gaCode,
    installationDate: pipeline.installationDate,
    flowDirection: pipeline.flowDirection,
    routeDescription: pipeline.routeDescription ?? "",
  };
}

function FieldError({ name, error }: { name: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${name}-error`} className="text-destructive text-xs" role="alert">
      {error}
    </p>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-wider uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function PipelineForm({
  pipeline,
  defaultGaCode = "",
  existingPipelines,
  onSubmit,
  onSaved,
  onCancel,
}: PipelineFormProps) {
  const isEditing = Boolean(pipeline);
  const [values, setValues] = useState<TextFields>(() => toTextFields(pipeline, defaultGaCode));
  const [routeRows, setRouteRows] = useState<RouteRow[]>(() =>
    (pipeline?.routeCoordinates ?? []).map((point) => createRouteRow(point))
  );
  const [isPicking, setIsPicking] = useState(!pipeline);
  // Until the user types a length, it follows the drawn route.
  const [isLengthManual, setIsLengthManual] = useState(isEditing);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [serverErrors, setServerErrors] = useState<PipelineFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const routePoints = useMemo(() => getValidRoutePoints(routeRows), [routeRows]);
  const drawnKm = routePoints.length >= 2 ? routeLengthKm(routePoints) : null;
  const effectiveLength = isLengthManual ? values.lengthKm : drawnKm === null ? "" : String(drawnKm);

  const referenceRoutes = useMemo(
    () =>
      existingPipelines
        .filter((item) => item.id !== pipeline?.id)
        .map((item) => item.routeCoordinates),
    [existingPipelines, pipeline?.id]
  );

  // Raw input in the shape the API accepts; parsePipelineInput does the checking.
  const rawInput = {
    ...values,
    lengthKm: effectiveLength,
    routeCoordinates: routeRows.map((row) => [row.longitude.trim(), row.latitude.trim()]),
  };
  const parsed = parsePipelineInput(rawInput);

  const clientErrors: PipelineFieldErrors = parsed.ok ? {} : { ...parsed.errors };
  const normalizedCode = normalizePipelineCode(values.pipelineCode);
  const duplicate = existingPipelines.find(
    (item) => item.pipelineCode === normalizedCode && item.id !== pipeline?.id
  );
  if (normalizedCode && duplicate && !clientErrors.pipelineCode) {
    clientErrors.pipelineCode = `Pipeline ID ${normalizedCode} is already used by “${duplicate.name}”.`;
  }

  // Server errors are cleared field by field as the user edits, so skip the cleared ones.
  const activeServerErrors = Object.fromEntries(
    Object.entries(serverErrors).filter(([, message]) => Boolean(message))
  ) as PipelineFieldErrors;
  const errors: PipelineFieldErrors = hasTriedSubmit
    ? { ...clientErrors, ...activeServerErrors }
    : // Before the first submit, only flag a duplicate ID, which is useful to know early.
      { pipelineCode: duplicate ? clientErrors.pipelineCode : activeServerErrors.pipelineCode };
  const errorCount = Object.values(errors).filter(Boolean).length;

  function setField<K extends keyof TextFields>(name: K, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setServerErrors((current) => ({ ...current, [name]: undefined }));
  }

  function handleRowsChange(rows: RouteRow[]) {
    setRouteRows(rows);
    setServerErrors((current) => ({ ...current, routeCoordinates: undefined, lengthKm: undefined }));
  }

  function focusFirstError(fieldErrors: PipelineFieldErrors) {
    const first = FIELD_ORDER.find((name) => fieldErrors[name]);
    if (!first) return;
    // Wait for the error messages to render before moving focus.
    requestAnimationFrame(() => {
      const element =
        document.getElementById(`pipeline-${first}`) ?? document.getElementById(`${first}-error`);
      element?.focus();
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasTriedSubmit(true);
    setSubmitError(null);
    if (!parsed.ok || duplicate) {
      focusFirstError(clientErrors);
      return;
    }

    setIsSubmitting(true);
    setIsPicking(false);
    const result = await onSubmit(parsed.data);
    setIsSubmitting(false);

    if (result.ok) {
      onSaved(result.pipeline);
      return;
    }
    setSubmitError(result.error);
    if (result.fieldErrors) {
      setServerErrors(result.fieldErrors);
      focusFirstError(result.fieldErrors);
    }
  }

  function fieldProps(name: keyof PipelineInput) {
    return {
      id: `pipeline-${name}`,
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
      disabled: isSubmitting,
    };
  }

  function renderSelect(
    name: "gaCode" | "pipelineType" | "material" | "status" | "flowDirection",
    label: string,
    options: readonly { value: string; label: string }[]
  ) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`pipeline-${name}`}>{label}</Label>
        <Select
          items={options}
          value={values[name] || null}
          onValueChange={(value) => setField(name, typeof value === "string" ? value : "")}
          disabled={isSubmitting}
        >
          <SelectTrigger {...fieldProps(name)} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError name={name} error={errors[name]} />
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      {hasTriedSubmit && errorCount > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            {submitError ?? "Some fields need attention."} Fix the {errorCount} highlighted{" "}
            {errorCount === 1 ? "field" : "fields"} and try again.
          </AlertDescription>
        </Alert>
      ) : submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection title="Identification">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-pipelineCode">Pipeline ID</Label>
            <Input
              {...fieldProps("pipelineCode")}
              placeholder="e.g. AMD-ST-014"
              autoComplete="off"
              maxLength={40}
              className="font-mono uppercase placeholder:normal-case"
              value={values.pipelineCode}
              onChange={(event) => setField("pipelineCode", event.target.value)}
            />
            <FieldError name="pipelineCode" error={errors.pipelineCode} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-name">Pipeline name</Label>
            <Input
              {...fieldProps("name")}
              placeholder="e.g. Sanand – Bopal steel spur"
              maxLength={PIPELINE_LIMITS.nameMax}
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
            />
            <FieldError name="name" error={errors.name} />
          </div>
          {renderSelect("gaCode", "Geographical area", areaOptions)}
          {renderSelect("pipelineType", "Pipeline type", pipelineTypes)}
          {renderSelect("material", "Material", pipelineMaterials)}
          {renderSelect("status", "Operational status", pipelineStatuses)}
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Specifications">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-diameterMm">Diameter (mm)</Label>
            <Input
              {...fieldProps("diameterMm")}
              type="number"
              inputMode="decimal"
              min={PIPELINE_LIMITS.diameterMinMm}
              max={PIPELINE_LIMITS.diameterMaxMm}
              step="any"
              placeholder="e.g. 200"
              value={values.diameterMm}
              onChange={(event) => setField("diameterMm", event.target.value)}
            />
            <FieldError name="diameterMm" error={errors.diameterMm} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-depthM">Depth of cover (m)</Label>
            <Input
              {...fieldProps("depthM")}
              type="number"
              inputMode="decimal"
              min={PIPELINE_LIMITS.depthMinM}
              max={PIPELINE_LIMITS.depthMaxM}
              step="any"
              placeholder="e.g. 1.2"
              value={values.depthM}
              onChange={(event) => setField("depthM", event.target.value)}
            />
            <FieldError name="depthM" error={errors.depthM} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-pressureRatingBar">
              Pressure rating (bar) <span className="text-muted-foreground font-normal">· optional</span>
            </Label>
            <Input
              {...fieldProps("pressureRatingBar")}
              type="number"
              inputMode="decimal"
              min={0}
              max={PIPELINE_LIMITS.pressureMaxBar}
              step="any"
              placeholder="e.g. 19"
              value={values.pressureRatingBar}
              onChange={(event) => setField("pressureRatingBar", event.target.value)}
            />
            <FieldError name="pressureRatingBar" error={errors.pressureRatingBar} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-installationDate">Installation date</Label>
            <Input
              {...fieldProps("installationDate")}
              type="date"
              min="1900-01-01"
              value={values.installationDate}
              onChange={(event) => setField("installationDate", event.target.value)}
            />
            <FieldError name="installationDate" error={errors.installationDate} />
          </div>
          <div className="sm:col-span-2">
            {renderSelect("flowDirection", "Flow direction", pipelineFlowDirections)}
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Route">
        <RouteEditor
          rows={routeRows}
          onRowsChange={handleRowsChange}
          isPicking={isPicking}
          onPickingChange={setIsPicking}
          referenceRoutes={referenceRoutes}
          gaCode={values.gaCode}
          error={errors.routeCoordinates}
          disabled={isSubmitting}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-lengthKm">Length (km)</Label>
            <div className="flex gap-2">
              <Input
                {...fieldProps("lengthKm")}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="Calculated from the route"
                value={effectiveLength}
                onChange={(event) => {
                  setIsLengthManual(true);
                  setField("lengthKm", event.target.value);
                }}
              />
              {isLengthManual && drawnKm !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsLengthManual(false);
                    setServerErrors((current) => ({ ...current, lengthKm: undefined }));
                  }}
                >
                  Use route
                </Button>
              ) : null}
            </div>
            {errors.lengthKm ? (
              <FieldError name="lengthKm" error={errors.lengthKm} />
            ) : (
              <p className="text-muted-foreground text-xs">
                {isLengthManual
                  ? "Entered manually. It must not be shorter than the drawn route."
                  : "Filled in from the drawn route. Type to override, e.g. for slack or vertical runs."}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pipeline-routeDescription">
              Route &amp; direction notes{" "}
              <span className="text-muted-foreground font-normal">· optional</span>
            </Label>
            <Input
              {...fieldProps("routeDescription")}
              placeholder="e.g. Along SG Highway, CGS Sanand to DRS Bopal"
              maxLength={PIPELINE_LIMITS.routeDescriptionMax}
              value={values.routeDescription}
              onChange={(event) => setField("routeDescription", event.target.value)}
            />
            <FieldError name="routeDescription" error={errors.routeDescription} />
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Other details">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pipeline-description">
            Notes <span className="text-muted-foreground font-normal">· optional</span>
          </Label>
          <Textarea
            {...fieldProps("description")}
            rows={3}
            maxLength={PIPELINE_LIMITS.descriptionMax}
            placeholder="Contractor, coating, crossings, cathodic protection or anything else worth recording."
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
          />
          <FieldError name="description" error={errors.description} />
        </div>
      </FormSection>

      <div className="bg-popover sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Add pipeline"}
        </Button>
      </div>
    </form>
  );
}

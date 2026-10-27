"use client";

import {
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MapPinOff,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeviceLocation,
  type DeviceLocation,
  type DeviceLocationState,
} from "@/hooks/use-device-location";
import {
  faultSeverities,
  faultTypes,
  type FaultSeverityValue,
  type FaultTypeValue,
} from "@/lib/faults/constants";
import {
  checkFaultProximity,
  FAULT_REPORT_MAX_DISTANCE_M,
  formatDistance,
  NEAREST_PIPELINE_KIND_LABELS,
  type ProximityCheck,
} from "@/lib/faults/proximity";
import type { FaultReportDto } from "@/lib/faults/types";
import { compressImage } from "@/lib/image/compress-image";
import type { PipelineDto } from "@/lib/pipelines/types";

// MapLibre needs the browser, so it is loaded on the client only.
const FaultLocationMap = dynamic(
  () => import("@/components/faults/fault-location-map").then((module) => module.FaultLocationMap),
  { ssr: false, loading: () => <Skeleton className="h-48 rounded-lg" /> }
);

type ReportFaultFormProps = {
  // Registered pipelines, checked together with the network's steel and MDPE lines.
  pipelines: PipelineDto[];
  onLocation?: (location: DeviceLocation) => void;
  onReported: (fault: FaultReportDto) => void;
  onViewOnMap: (fault: FaultReportDto) => void;
  onClose: () => void;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; fault: FaultReportDto; notifiedCount: number };


function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "secondary" : "outline"}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function LocationStatus({
  state,
  proximity,
  pipelines,
  onRequest,
}: {
  state: DeviceLocationState;
  proximity: ProximityCheck | null;
  pipelines: PipelineDto[];
  onRequest: () => void;
}) {
  if (state.status === "idle") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground text-sm">
          Faults are reported from where you stand. Allow location access so we can check
          that you are within {formatDistance(FAULT_REPORT_MAX_DISTANCE_M)} of a pipeline.
          You never type coordinates.
        </p>
        <Button type="button" size="sm" onClick={onRequest}>
          <LocateFixed className="size-4" />
          Check my location
        </Button>
      </div>
    );
  }

  if (state.status === "requesting") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <LoaderCircle className="size-4 animate-spin" />
        Getting your location… allow access if your browser asks.
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <MapPinOff />
        <AlertDescription className="flex flex-col items-start gap-2">
          {state.message}
          <Button type="button" size="sm" variant="outline" onClick={onRequest}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { location } = state;
  const nearest = proximity?.nearest ?? null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="size-4 text-blue-600" />
        <span className="font-mono text-xs">
          {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </span>
        <Badge variant="secondary">±{Math.round(location.accuracyMeters)} m</Badge>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={onRequest}
          disabled={state.isRefreshing}
        >
          {state.isRefreshing ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {state.isRefreshing ? "Updating…" : "Update location"}
        </Button>
      </div>

      <FaultLocationMap
        location={location}
        nearest={nearest}
        maxDistanceMeters={FAULT_REPORT_MAX_DISTANCE_M}
        isWithinRange={proximity?.ok ?? false}
        pipelines={pipelines}
      />
      <p className="text-muted-foreground text-xs">
        Blue dot: you (shaded area is GPS accuracy). Dotted ring: reporting range. The
        nearest pipeline is drawn thicker.
      </p>

      {proximity?.ok ? (
        <Alert>
          <CheckCircle2 className="text-emerald-500" />
          <AlertDescription>
            You are {formatDistance(proximity.nearest.distanceM)} from{" "}
            <span className="text-foreground font-medium">{proximity.nearest.code}</span> (
            {NEAREST_PIPELINE_KIND_LABELS[proximity.nearest.kind]} · {proximity.nearest.name}). This
            pipeline is attached to your report.
          </AlertDescription>
        </Alert>
      ) : proximity ? (
        <Alert variant="destructive">
          <MapPinOff />
          <AlertDescription>{proximity.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function ReportFaultForm({
  pipelines,
  onLocation,
  onReported,
  onViewOnMap,
  onClose,
}: ReportFaultFormProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [faultType, setFaultType] = useState<FaultTypeValue>("GAS_LEAK");
  const [severity, setSeverity] = useState<FaultSeverityValue>("MEDIUM");
  const [description, setDescription] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const { state: locationState, request: requestLocation } = useDeviceLocation({ onLocation });

  // The same rule the server enforces, run here so the reporter knows straight away.
  const proximity = useMemo(
    () =>
      locationState.status === "success"
        ? checkFaultProximity(
            locationState.location.longitude,
            locationState.location.latitude,
            locationState.location.accuracyMeters,
            pipelines
          )
        : null,
    [locationState, pipelines]
  );
  const isNearPipeline = proximity?.ok === true;

  // Release the preview image when it is replaced or the dialog closes.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];
    input.value = ""; // lets the same file be chosen again later
    if (!selectedFile) return;

    setPhotoError(null);
    setIsPreparingPhoto(true);
    requestLocation(); // refreshed when the photograph is added, so the time is current

    try {
      const compressed = await compressImage(selectedFile);
      setPhoto({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
    } catch (error) {
      console.error("Could not prepare photo:", error);
      setPhotoError("This image could not be read. Try a JPEG or PNG photograph.");
    } finally {
      setIsPreparingPhoto(false);
    }
  }

  const isSubmitting = submitState.status === "submitting";
  const canSubmit =
    photo !== null &&
    locationState.status === "success" &&
    isNearPipeline &&
    title.trim().length >= 3 &&
    !isSubmitting &&
    !isPreparingPhoto;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || locationState.status !== "success" || !isNearPipeline) return;

    setSubmitState({ status: "submitting" });
    const { latitude, longitude, accuracyMeters, capturedAt } = locationState.location;

    const formData = new FormData();
    formData.set("photo", photo.file, photo.file.name);
    formData.set("title", title.trim());
    formData.set("description", description.trim());
    formData.set("faultType", faultType);
    formData.set("severity", severity);
    formData.set("latitude", String(latitude));
    formData.set("longitude", String(longitude));
    formData.set("accuracyMeters", String(accuracyMeters));
    formData.set("capturedAt", capturedAt);

    try {
      const response = await fetch("/api/faults", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.fault) {
        setSubmitState({
          status: "error",
          message: payload?.error ?? "The report could not be sent. Please try again.",
        });
        return;
      }

      onReported(payload.fault);
      setSubmitState({
        status: "success",
        fault: payload.fault,
        notifiedCount: payload.notifiedCount ?? 0,
      });
    } catch {
      setSubmitState({
        status: "error",
        message: "Could not reach the server. Check your connection and try again.",
      });
    }
  }

  if (submitState.status === "success") {
    const { fault, notifiedCount } = submitState;
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <div>
          <p className="font-semibold">Fault reported</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {fault.nearestPipeline
              ? `Linked to ${fault.nearestPipeline.code}, ${formatDistance(fault.nearestPipeline.distanceM ?? 0)} away. `
              : null}
            It is marked as reported and awaits review. The location was saved and{" "}
            {notifiedCount > 0
              ? `${notifiedCount} ${notifiedCount === 1 ? "colleague was" : "colleagues were"} notified.`
              : "there are no other users to notify yet."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => onViewOnMap(fault)}>
            Show on map
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Step 1: location and proximity check */}
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Label>1. Your location</Label>
        <LocationStatus
          state={locationState}
          proximity={proximity}
          pipelines={pipelines}
          onRequest={requestLocation}
        />
      </div>

      {/* Step 2: the report itself, available once you are near a pipeline */}
      <fieldset
        disabled={!isNearPipeline || isSubmitting}
        className="flex flex-col gap-5 disabled:opacity-50"
        aria-describedby={!isNearPipeline ? "fault-locked-hint" : undefined}
      >
      {!isNearPipeline ? (
        <p id="fault-locked-hint" className="text-muted-foreground text-xs">
          2. Fault details unlock once your location is confirmed within{" "}
          {formatDistance(FAULT_REPORT_MAX_DISTANCE_M)} of a pipeline.
        </p>
      ) : null}
      {/* Photograph */}
      <div className="flex flex-col gap-2">
        <Label>Photograph</Label>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelected}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelected}
        />

        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.previewUrl}
            alt="Selected fault"
            className="aspect-4/3 w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-sm">
            {isPreparingPhoto ? "Preparing photograph…" : "No photograph yet"}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting || isPreparingPhoto}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="size-4" />
            {photo ? "Retake photo" : "Take photo"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting || isPreparingPhoto}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Choose from gallery
          </Button>
        </div>
        {photoError ? <p className="text-destructive text-xs">{photoError}</p> : null}
      </div>

      {/* Details */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="fault-title">Short title</Label>
        <Input
          id="fault-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Gas smell near the valve chamber"
          maxLength={120}
          disabled={isSubmitting}
        />
      </div>

      <ChoiceChips
        label="Fault type"
        options={faultTypes}
        value={faultType}
        onChange={setFaultType}
        disabled={isSubmitting}
      />
      <ChoiceChips
        label="Severity"
        options={faultSeverities}
        value={severity}
        onChange={setSeverity}
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="fault-description">Notes (optional)</Label>
        <Textarea
          id="fault-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Anything that helps the repair team find or understand the fault"
          maxLength={1000}
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      </fieldset>

      {submitState.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{submitState.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={!canSubmit}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Uploading report…
          </>
        ) : (
          "Submit report"
        )}
      </Button>
      {!canSubmit && !isSubmitting ? (
        <p className="text-muted-foreground -mt-3 text-center text-xs">
          {isNearPipeline
            ? "Add a photograph and enter a title to submit."
            : "Confirm your location near a pipeline, then add a photograph and a title."}
        </p>
      ) : null}
    </form>
  );
}
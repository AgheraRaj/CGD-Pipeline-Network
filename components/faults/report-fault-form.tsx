"use client";

import { Camera, CheckCircle2, ImagePlus, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDeviceLocation, type DeviceLocationState } from "@/hooks/use-device-location";
import {
  faultSeverities,
  faultTypes,
  type FaultSeverityValue,
  type FaultTypeValue,
} from "@/lib/faults/constants";
import type { FaultReportDto } from "@/lib/faults/types";
import { compressImage } from "@/lib/image/compress-image";

type ReportFaultFormProps = {
  onReported: (fault: FaultReportDto) => void;
  onViewOnMap: (fault: FaultReportDto) => void;
  onClose: () => void;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; fault: FaultReportDto; notifiedCount: number };

const LOW_ACCURACY_METERS = 100;

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
  onRetry,
}: {
  state: DeviceLocationState;
  onRetry: () => void;
}) {
  if (state.status === "idle") {
    return (
      <p className="text-muted-foreground text-xs">
        Your location is captured automatically when you add a photograph. You
        never need to type coordinates.
      </p>
    );
  }

  if (state.status === "requesting") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" />
        Getting your location… allow access if your browser asks.
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          {state.message}
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { latitude, longitude, accuracyMeters } = state.location;
  const isLowAccuracy = accuracyMeters > LOW_ACCURACY_METERS;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="size-4 text-emerald-500" />
        <span className="font-mono text-xs">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
        <Badge variant="secondary">±{Math.round(accuracyMeters)} m</Badge>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onRetry}>
          Update location
        </Button>
      </div>
      {isLowAccuracy ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          The location is not very precise. Move to open sky, wait a moment and
          tap Update location for a better fix.
        </p>
      ) : null}
    </div>
  );
}

export function ReportFaultForm({ onReported, onViewOnMap, onClose }: ReportFaultFormProps) {
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

  const { state: locationState, request: requestLocation } = useDeviceLocation();

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
    requestLocation(); // asked at the moment the photograph is added

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
    title.trim().length >= 3 &&
    !isSubmitting &&
    !isPreparingPhoto;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || locationState.status !== "success") return;

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
            The location was saved and{" "}
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

      {/* Location */}
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <Label>Location</Label>
        <LocationStatus state={locationState} onRetry={requestLocation} />
        <p className="text-muted-foreground text-xs">
          This is your position right now, so report the fault while you are at the site.
        </p>
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
          Add a photograph, allow location access and enter a title to submit.
        </p>
      ) : null}
    </form>
  );
}
"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatKilometres } from "@/lib/format";
import type { PipelineDto } from "@/lib/pipelines/types";

type DeletePipelineDialogProps = {
  pipeline: PipelineDto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDeleted: (id: string) => void;
};

export function DeletePipelineDialog({
  pipeline,
  onOpenChange,
  onConfirm,
  onDeleted,
}: DeletePipelineDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!pipeline) return;
    setIsDeleting(true);
    setError(null);
    const result = await onConfirm(pipeline.id);
    setIsDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onDeleted(pipeline.id);
  }

  return (
    <AlertDialog
      open={pipeline !== null}
      onOpenChange={(open) => {
        if (isDeleting) return;
        if (!open) setError(null);
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete pipeline {pipeline?.pipelineCode}?</AlertDialogTitle>
          <AlertDialogDescription>
            “{pipeline?.name}”
            {pipeline ? ` (${formatKilometres(pipeline.lengthKm)})` : ""} will be removed from the
            map and the network figures for everyone. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDelete}>
            {isDeleting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {isDeleting ? "Deleting…" : "Delete pipeline"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

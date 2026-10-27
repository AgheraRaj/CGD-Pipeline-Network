"use client";

import { PipelineForm } from "@/components/pipelines/pipeline-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PipelineMutationResult } from "@/hooks/use-pipelines";
import type { PipelineDto, PipelineInput } from "@/lib/pipelines/types";

type PipelineFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When set, the dialog edits this pipeline; otherwise it adds a new one.
  pipeline?: PipelineDto | null;
  defaultGaCode?: string;
  existingPipelines: PipelineDto[];
  onCreate: (input: PipelineInput) => Promise<PipelineMutationResult>;
  onUpdate: (id: string, input: PipelineInput) => Promise<PipelineMutationResult>;
  onSaved: (pipeline: PipelineDto, mode: "created" | "updated") => void;
};

export function PipelineFormDialog({
  open,
  onOpenChange,
  pipeline,
  defaultGaCode,
  existingPipelines,
  onCreate,
  onUpdate,
  onSaved,
}: PipelineFormDialogProps) {
  const isEditing = Boolean(pipeline);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form lives inside the content, so its state resets every time the dialog closes. */}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit ${pipeline?.pipelineCode}` : "Add a pipeline"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details or route. The map and network figures refresh as soon as you save."
              : "Record a pipeline segment and draw its route. It appears on the map and in the network figures as soon as it is saved."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PipelineForm
            key={pipeline?.id ?? "new"}
            pipeline={pipeline ?? undefined}
            defaultGaCode={defaultGaCode}
            existingPipelines={existingPipelines}
            onSubmit={(input) => (pipeline ? onUpdate(pipeline.id, input) : onCreate(input))}
            onSaved={(saved) => {
              onOpenChange(false);
              onSaved(saved, pipeline ? "updated" : "created");
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

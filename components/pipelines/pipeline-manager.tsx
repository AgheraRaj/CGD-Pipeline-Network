"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeletePipelineDialog } from "@/components/pipelines/delete-pipeline-dialog";
import { PipelineFormDialog } from "@/components/pipelines/pipeline-form-dialog";
import { PipelinesTable } from "@/components/pipelines/pipelines-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePipelines } from "@/hooks/use-pipelines";
import { formatKilometres, formatNumber } from "@/lib/format";
import { ALL_AREAS } from "@/lib/network/dummy-data";
import { getPipelineSummary } from "@/lib/pipelines/summary";
import type { PipelineDto } from "@/lib/pipelines/types";

export function pipelineMapHref(pipeline: PipelineDto) {
  return `/map?pipeline=${encodeURIComponent(pipeline.id)}`;
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

export function PipelineManager() {
  const router = useRouter();
  const { pipelines, status, retry, createPipeline, updatePipeline, deletePipeline } =
    usePipelines();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<PipelineDto | null>(null);
  const [deleting, setDeleting] = useState<PipelineDto | null>(null);

  const summary = getPipelineSummary(pipelines, ALL_AREAS);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Pipelines" value={formatNumber(summary.count)} />
        <SummaryTile label="Total length" value={formatKilometres(summary.totalKm)} />
        <SummaryTile label="Operational" value={formatNumber(summary.operationalCount)} />
        <SummaryTile label="Operational length" value={formatKilometres(summary.operationalKm)} />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add pipeline
        </Button>
      </div>

      {status === "loading" ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            Pipelines could not be loaded.
            <Button size="sm" variant="outline" onClick={retry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <PipelinesTable
          pipelines={pipelines}
          onView={(pipeline) => router.push(pipelineMapHref(pipeline))}
          onEdit={(pipeline) => {
            setEditing(pipeline);
            setIsFormOpen(true);
          }}
          onDelete={setDeleting}
        />
      )}

      <PipelineFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        pipeline={editing}
        existingPipelines={pipelines}
        onCreate={createPipeline}
        onUpdate={updatePipeline}
        onSaved={() => setEditing(null)}
      />
      <DeletePipelineDialog
        pipeline={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={deletePipeline}
        onDeleted={() => setDeleting(null)}
      />
    </div>
  );
}

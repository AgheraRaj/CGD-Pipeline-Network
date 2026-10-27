"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getPipelinesServerSnapshot,
  getPipelinesSnapshot,
  refreshPipelines,
  retryPipelines,
  storeRemovePipeline,
  storeUpsertPipeline,
  subscribePipelines,
} from "@/lib/pipelines/store";
import type { PipelineDto, PipelineFieldErrors, PipelineInput } from "@/lib/pipelines/types";

export type PipelineMutationResult =
  | { ok: true; pipeline: PipelineDto }
  | { ok: false; error: string; fieldErrors?: PipelineFieldErrors };

// Other users' changes are picked up in the background, so the map stays in sync.
const REFRESH_INTERVAL_MS = 30_000;

async function readError(response: Response) {
  try {
    const payload: { error?: string; fieldErrors?: PipelineFieldErrors } = await response.json();
    return {
      error: payload.error ?? `Request failed with status ${response.status}.`,
      fieldErrors: payload.fieldErrors,
    };
  } catch {
    return { error: `Request failed with status ${response.status}.` };
  }
}

const NETWORK_ERROR = "Could not reach the server. Check your connection.";

export function usePipelines() {
  const { pipelines, status, updatedAt } = useSyncExternalStore(
    subscribePipelines,
    getPipelinesSnapshot,
    getPipelinesServerSnapshot
  );

  // Load on mount (also when returning to a page), then keep refreshing in the background.
  useEffect(() => {
    void refreshPipelines();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshPipelines();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshPipelines();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const retry = useCallback(() => {
    void retryPipelines();
  }, []);

  const createPipeline = useCallback(
    async (input: PipelineInput): Promise<PipelineMutationResult> => {
      try {
        const response = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) return { ok: false, ...(await readError(response)) };
        const { pipeline }: { pipeline: PipelineDto } = await response.json();
        storeUpsertPipeline(pipeline);
        return { ok: true, pipeline };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    []
  );

  const updatePipeline = useCallback(
    async (id: string, input: PipelineInput): Promise<PipelineMutationResult> => {
      try {
        const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (response.status === 404) storeRemovePipeline(id);
        if (!response.ok) return { ok: false, ...(await readError(response)) };
        const { pipeline }: { pipeline: PipelineDto } = await response.json();
        storeUpsertPipeline(pipeline);
        return { ok: true, pipeline };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    []
  );

  const deletePipeline = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const response = await fetch(`/api/pipelines/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        // Already gone counts as success: the goal was for it not to exist.
        if (!response.ok && response.status !== 404) {
          return { ok: false, error: (await readError(response)).error };
        }
        storeRemovePipeline(id);
        return { ok: true };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    []
  );

  return { pipelines, status, updatedAt, retry, createPipeline, updatePipeline, deletePipeline };
}

"use client";

import type { PipelineDto } from "./types";

// One shared copy of the pipeline list for the whole app. The map, its figures and the
// Pipelines table all read from here, so a change made anywhere shows everywhere at once.

export type PipelineLoadStatus = "loading" | "ready" | "error";
export type PipelineStoreState = {
  pipelines: PipelineDto[];
  status: PipelineLoadStatus;
  // When the list last came from the server or changed here, for "updated" labels.
  updatedAt: number | null;
};

const SERVER_STATE: PipelineStoreState = { pipelines: [], status: "loading", updatedAt: null };

let state: PipelineStoreState = SERVER_STATE;
let hasLoaded = false;
const listeners = new Set<() => void>();

// Bumped on every local change. A list fetched before the latest change is out of date
// and is thrown away, so a slow background refresh can never undo a save.
let changeVersion = 0;
let inflight: { version: number; promise: Promise<void> } | null = null;

let channel: BroadcastChannel | null = null;
function getChannel() {
  if (channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return channel;
  channel = new BroadcastChannel("cgd-pipelines");
  // Another tab changed something: fetch the latest list.
  channel.onmessage = () => void refreshPipelines();
  return channel;
}

function setState(next: Partial<PipelineStoreState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribePipelines(listener: () => void) {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getPipelinesSnapshot = () => state;
export const getPipelinesServerSnapshot = () => SERVER_STATE;

function sortByNewest(items: PipelineDto[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function fetchPipelines(): Promise<PipelineDto[]> {
  // The timestamp stops any browser, proxy or CDN from answering with an old copy.
  const response = await fetch(`/api/pipelines?t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const payload: { pipelines: PipelineDto[] } = await response.json();
  return payload.pipelines;
}

export function refreshPipelines(): Promise<void> {
  // Reuse a request that is already running, unless something changed since it started.
  if (inflight && inflight.version === changeVersion) return inflight.promise;

  const version = changeVersion;
  const promise = fetchPipelines()
    .then((pipelines) => {
      if (version !== changeVersion) return; // stale: a newer refresh follows the change
      hasLoaded = true;
      setState({ pipelines: sortByNewest(pipelines), status: "ready", updatedAt: Date.now() });
    })
    .catch((error: unknown) => {
      console.error("Could not load pipelines:", error);
      // A failed background refresh keeps the data already on screen.
      if (!hasLoaded) setState({ status: "error" });
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });

  inflight = { version, promise };
  return promise;
}

export function retryPipelines() {
  if (!hasLoaded) setState({ status: "loading" });
  return refreshPipelines();
}

// Applies a change made in this tab straight away, then confirms it with the server
// and tells other open tabs.
function commit(update: (current: PipelineDto[]) => PipelineDto[]) {
  changeVersion += 1;
  hasLoaded = true;
  setState({
    pipelines: sortByNewest(update(state.pipelines)),
    status: "ready",
    updatedAt: Date.now(),
  });
  getChannel()?.postMessage("changed");
  void refreshPipelines();
}

export function storeUpsertPipeline(pipeline: PipelineDto) {
  commit((current) => [pipeline, ...current.filter((item) => item.id !== pipeline.id)]);
}

export function storeRemovePipeline(id: string) {
  commit((current) => current.filter((item) => item.id !== id));
}

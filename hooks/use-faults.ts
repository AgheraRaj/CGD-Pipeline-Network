"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaultReportDto } from "@/lib/faults/types";

type LoadStatus = "loading" | "ready" | "error";

// New reports from other users are picked up in the background.
const REFRESH_INTERVAL_MS = 30_000;

async function fetchFaults(): Promise<FaultReportDto[]> {
  const response = await fetch(`/api/faults?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const payload: { faults: FaultReportDto[] } = await response.json();
  return payload.faults;
}

export function useFaults() {
  const [faults, setFaults] = useState<FaultReportDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(() => {
    return fetchFaults().then(
      (items) => {
        // Keep anything added locally that the server list does not include yet.
        setFaults((current) => {
          const ids = new Set(items.map((item) => item.id));
          const pending = current.filter((item) => !ids.has(item.id) && item.createdAt > (items[0]?.createdAt ?? ""));
          return [...pending, ...items];
        });
        setStatus("ready");
        setUpdatedAt(Date.now());
      },
      (error: unknown) => {
        console.error("Could not load fault reports:", error);
        // A failed background refresh keeps the reports already on screen.
        setStatus((current) => (current === "ready" ? current : "error"));
      }
    );
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const retry = useCallback(() => {
    setStatus("loading");
    void refresh();
  }, [refresh]);

  // Used right after a successful report so the marker appears without waiting for a reload.
  const addFault = useCallback((fault: FaultReportDto) => {
    setFaults((current) => [fault, ...current.filter((item) => item.id !== fault.id)]);
  }, []);

  return { faults, status, retry, addFault, updatedAt };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaultReportDto } from "@/lib/faults/types";

type LoadStatus = "loading" | "ready" | "error";

export function useFaults() {
  const [faults, setFaults] = useState<FaultReportDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/faults");
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      const payload: { faults: FaultReportDto[] } = await response.json();
      setFaults(payload.faults);
      setStatus("ready");
    } catch (error) {
      console.error("Could not load fault reports:", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    setStatus("loading");
    void load();
  }, [load]);

  // Used right after a successful report so the marker appears without waiting for a reload.
  const addFault = useCallback((fault: FaultReportDto) => {
    setFaults((current) => [fault, ...current.filter((item) => item.id !== fault.id)]);
  }, []);

  return { faults, status, retry, addFault };
}
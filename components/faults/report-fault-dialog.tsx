"use client";

import { Camera } from "lucide-react";
import { useState } from "react";
import { ReportFaultForm } from "@/components/faults/report-fault-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DeviceLocation } from "@/hooks/use-device-location";
import type { FaultReportDto } from "@/lib/faults/types";
import type { PipelineDto } from "@/lib/pipelines/types";

type ReportFaultDialogProps = {
  pipelines: PipelineDto[];
  onLocation?: (location: DeviceLocation) => void;
  onReported: (fault: FaultReportDto) => void;
  onViewOnMap: (fault: FaultReportDto) => void;
};

export function ReportFaultDialog({
  pipelines,
  onLocation,
  onReported,
  onViewOnMap,
}: ReportFaultDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button size="sm" className="shadow-sm" />}>
        <Camera className="size-4" />
        Report fault
      </DialogTrigger>
      {/* The form lives inside the content, so its state resets every time the dialog closes. */}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a pipeline fault</DialogTitle>
          <DialogDescription>
            Stand near the pipeline and confirm your location, then photograph the
            fault. Your position, the time and the nearest pipeline are attached
            automatically and the team is notified.
          </DialogDescription>
        </DialogHeader>
        <ReportFaultForm
          pipelines={pipelines}
          onLocation={onLocation}
          onReported={onReported}
          onClose={() => setIsOpen(false)}
          onViewOnMap={(fault) => {
            setIsOpen(false);
            onViewOnMap(fault);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
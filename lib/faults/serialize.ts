import type { Prisma } from "@/generated/prisma/client";
import type { FaultReportDto } from "./types";

export const faultReportInclude = {
  photos: { orderBy: { createdAt: "asc" }, take: 1 },
  reportedBy: { select: { name: true } },
} satisfies Prisma.FaultReportInclude;

type FaultReportWithRelations = Prisma.FaultReportGetPayload<{
  include: typeof faultReportInclude;
}>;

export function toFaultDto(report: FaultReportWithRelations): FaultReportDto {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    faultType: report.faultType,
    severity: report.severity,
    status: report.status,
    latitude: report.latitude,
    longitude: report.longitude,
    accuracyMeters: report.accuracyMeters,
    capturedAt: report.capturedAt.toISOString(),
    createdAt: report.createdAt.toISOString(),
    reportedByName: report.reportedBy.name,
    photoUrl: report.photos[0]?.url ?? null,
  };
}
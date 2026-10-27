import type { Prisma } from "@/generated/prisma/client";
import type { LngLat } from "@/lib/network/types";
import type { PipelineDto, PipelineInput } from "./types";

export const pipelineInclude = {
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} satisfies Prisma.PipelineInclude;

type PipelineWithRelations = Prisma.PipelineGetPayload<{ include: typeof pipelineInclude }>;

function readRoute(value: Prisma.JsonValue): LngLat[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) =>
    Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number"
      ? [[point[0], point[1]] as LngLat]
      : []
  );
}

export function toPipelineDto(pipeline: PipelineWithRelations): PipelineDto {
  return {
    id: pipeline.id,
    pipelineCode: pipeline.pipelineCode,
    name: pipeline.name,
    description: pipeline.description,
    material: pipeline.material,
    pipelineType: pipeline.pipelineType,
    status: pipeline.status,
    diameterMm: pipeline.diameterMm,
    lengthKm: pipeline.lengthKm,
    depthM: pipeline.depthM,
    pressureRatingBar: pipeline.pressureRatingBar,
    gaCode: pipeline.gaCode,
    installationDate: pipeline.installationDate.toISOString().slice(0, 10),
    flowDirection: pipeline.flowDirection,
    routeDescription: pipeline.routeDescription,
    routeCoordinates: readRoute(pipeline.routeCoordinates),
    startLatitude: pipeline.startLatitude,
    startLongitude: pipeline.startLongitude,
    endLatitude: pipeline.endLatitude,
    endLongitude: pipeline.endLongitude,
    createdByName: pipeline.createdBy?.name ?? null,
    updatedByName: pipeline.updatedBy?.name ?? null,
    createdAt: pipeline.createdAt.toISOString(),
    updatedAt: pipeline.updatedAt.toISOString(),
  };
}

// Converts validated input into the columns Prisma writes.
export function toPipelineData(input: PipelineInput) {
  const route = input.routeCoordinates;
  const [startLongitude, startLatitude] = route[0];
  const [endLongitude, endLatitude] = route[route.length - 1];
  return {
    ...input,
    installationDate: new Date(`${input.installationDate}T00:00:00Z`),
    routeCoordinates: route,
    startLatitude,
    startLongitude,
    endLatitude,
    endLongitude,
  };
}

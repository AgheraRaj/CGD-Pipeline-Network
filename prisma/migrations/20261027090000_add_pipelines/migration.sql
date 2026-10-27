-- Additive migration: creates the pipeline table and its enums only.
-- No existing table or row is changed.

-- CreateEnum
CREATE TYPE "PipelineMaterial" AS ENUM ('STEEL', 'MDPE', 'HDPE', 'DUCTILE_IRON', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineType" AS ENUM ('TRANSMISSION', 'TRUNK_MAIN', 'DISTRIBUTION', 'SERVICE_LINE');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('PLANNED', 'UNDER_CONSTRUCTION', 'OPERATIONAL', 'UNDER_MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "PipelineFlowDirection" AS ENUM ('FORWARD', 'REVERSE', 'BIDIRECTIONAL');

-- CreateTable
CREATE TABLE "pipeline" (
    "id" TEXT NOT NULL,
    "pipelineCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "material" "PipelineMaterial" NOT NULL,
    "pipelineType" "PipelineType" NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "diameterMm" DOUBLE PRECISION NOT NULL,
    "lengthKm" DOUBLE PRECISION NOT NULL,
    "depthM" DOUBLE PRECISION NOT NULL,
    "pressureRatingBar" DOUBLE PRECISION,
    "gaCode" TEXT NOT NULL,
    "installationDate" DATE NOT NULL,
    "flowDirection" "PipelineFlowDirection" NOT NULL DEFAULT 'FORWARD',
    "routeDescription" TEXT,
    "routeCoordinates" JSONB NOT NULL,
    "startLatitude" DOUBLE PRECISION NOT NULL,
    "startLongitude" DOUBLE PRECISION NOT NULL,
    "endLatitude" DOUBLE PRECISION NOT NULL,
    "endLongitude" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_pipelineCode_key" ON "pipeline"("pipelineCode");

-- CreateIndex
CREATE INDEX "pipeline_gaCode_idx" ON "pipeline"("gaCode");

-- CreateIndex
CREATE INDEX "pipeline_status_idx" ON "pipeline"("status");

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

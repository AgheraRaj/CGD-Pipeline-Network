-- Additive migration: adds optional (nullable) columns to fault_report.
-- Existing rows are not changed; their new columns are simply NULL.

-- AlterTable
ALTER TABLE "fault_report" ADD COLUMN     "distanceToPipelineM" DOUBLE PRECISION,
ADD COLUMN     "nearestPipelineCode" TEXT,
ADD COLUMN     "nearestPipelineKind" TEXT,
ADD COLUMN     "nearestPipelineName" TEXT,
ADD COLUMN     "nearestPipelineRef" TEXT,
ADD COLUMN     "pipelineId" TEXT;

-- CreateIndex
CREATE INDEX "fault_report_pipelineId_idx" ON "fault_report"("pipelineId");

-- AddForeignKey
ALTER TABLE "fault_report" ADD CONSTRAINT "fault_report_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

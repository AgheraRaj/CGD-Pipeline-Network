import { Badge } from "@/components/ui/badge";
import {
  getPipelineStatusLabel,
  pipelineStatusDotClass,
  type PipelineStatusValue,
} from "@/lib/pipelines/constants";

export function PipelineStatusBadge({ status }: { status: PipelineStatusValue }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className={`size-1.5 rounded-full ${pipelineStatusDotClass[status]}`} />
      {getPipelineStatusLabel(status)}
    </Badge>
  );
}

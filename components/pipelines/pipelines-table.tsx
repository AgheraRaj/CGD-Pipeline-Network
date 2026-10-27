"use client";

import { MapPinned, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PipelineStatusBadge } from "@/components/pipelines/pipeline-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKilometres, formatNumber } from "@/lib/format";
import { ALL_AREAS, geographicalAreas, getGeographicalArea } from "@/lib/network/dummy-data";
import { getPipelineMaterialLabel, getPipelineTypeLabel } from "@/lib/pipelines/constants";
import type { PipelineDto } from "@/lib/pipelines/types";

type PipelinesTableProps = {
  pipelines: PipelineDto[];
  onView: (pipeline: PipelineDto) => void;
  onEdit: (pipeline: PipelineDto) => void;
  onDelete: (pipeline: PipelineDto) => void;
};

const areaFilterOptions = [
  { value: ALL_AREAS, label: "All GAs" },
  ...geographicalAreas.map((area) => ({ value: area.code, label: area.name })),
];

export function PipelinesTable({ pipelines, onView, onEdit, onDelete }: PipelinesTableProps) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>(ALL_AREAS);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pipelines.filter((pipeline) => {
      if (area !== ALL_AREAS && pipeline.gaCode !== area) return false;
      if (!needle) return true;
      return (
        pipeline.pipelineCode.toLowerCase().includes(needle) ||
        pipeline.name.toLowerCase().includes(needle)
      );
    });
  }, [pipelines, query, area]);

  const filteredKm = filtered.reduce((total, pipeline) => total + pipeline.lengthKm, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search pipelines"
            placeholder="Search by ID or name"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select
          items={areaFilterOptions}
          value={area}
          onValueChange={(value) => setArea(typeof value === "string" ? value : ALL_AREAS)}
        >
          <SelectTrigger aria-label="Filter by geographical area" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {areaFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground ml-auto text-xs tabular-nums">
          {formatNumber(filtered.length)} of {formatNumber(pipelines.length)} ·{" "}
          {formatKilometres(filteredKm)}
        </p>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pipeline ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>GA</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead className="text-right">Ø mm</TableHead>
              <TableHead>Installed</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground h-24 text-center">
                  {pipelines.length === 0
                    ? "No pipelines yet. Use “Add pipeline” to record the first one."
                    : "No pipelines match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((pipeline) => (
                <TableRow key={pipeline.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {pipeline.pipelineCode}
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={pipeline.name}>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => onView(pipeline)}
                    >
                      {pipeline.name}
                    </button>
                  </TableCell>
                  <TableCell>{getGeographicalArea(pipeline.gaCode)?.name ?? pipeline.gaCode}</TableCell>
                  <TableCell>{getPipelineTypeLabel(pipeline.pipelineType)}</TableCell>
                  <TableCell>{getPipelineMaterialLabel(pipeline.material)}</TableCell>
                  <TableCell>
                    <PipelineStatusBadge status={pipeline.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKilometres(pipeline.lengthKm)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(pipeline.diameterMm)}
                  </TableCell>
                  <TableCell className="tabular-nums">{pipeline.installationDate}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${pipeline.pipelineCode}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => onView(pipeline)}>
                          <MapPinned />
                          View on map
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(pipeline)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(pipeline)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

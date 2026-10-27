"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Factory,
  Gauge,
  Info,
  MapPinned,
  Route,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AreaLengthChart,
  BarList,
  ConnectionsChart,
} from "@/components/overview/overview-charts";
import { PipelineStatusBadge } from "@/components/pipelines/pipeline-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFaults } from "@/hooks/use-faults";
import { usePipelines } from "@/hooks/use-pipelines";
import {
  faultSeverities,
  getFaultSeverityLabel,
  getFaultStatusLabel,
} from "@/lib/faults/constants";
import { formatKilometres, formatNumber } from "@/lib/format";
import { ALL_AREAS, geographicalAreas, getGeographicalArea } from "@/lib/network/dummy-data";
import {
  buildAlerts,
  filterFaultsBySelection,
  getAreaBreakdown,
  getAreaCodeForPoint,
  getOverviewKpis,
  getPipelineStatusBreakdown,
  isOpenFault,
  type OverviewAlert,
} from "@/lib/overview/metrics";
import { pipelineStatusDotClass } from "@/lib/pipelines/constants";
import { filterPipelinesBySelection } from "@/lib/pipelines/summary";
import { cn } from "cn";

const areaOptions = [
  { value: ALL_AREAS, label: "All geographical areas" },
  ...geographicalAreas.map((area) => ({ value: area.code, label: `${area.name} GA` })),
];

const SEVERITY_BAR_CLASS: Record<string, string> = {
  CRITICAL: "bg-red-600",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-slate-400",
};

function formatDateTime(value: string | number) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  isLoading,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger";
  isLoading?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <Icon className={cn("text-muted-foreground size-4", tone === "danger" && "text-destructive")} />
        </CardAction>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div
            className={cn(
              "font-heading text-2xl leading-tight font-semibold tabular-nums",
              tone === "danger" && "text-destructive"
            )}
          >
            {value}
          </div>
        )}
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">{detail}</CardContent>
    </Card>
  );
}

const ALERT_ICONS = { critical: CircleAlert, warning: AlertTriangle, info: Info } as const;
const ALERT_ICON_CLASS = {
  critical: "text-destructive",
  warning: "text-amber-500",
  info: "text-sky-500",
} as const;

function AlertsList({ alerts, isLoading }: { alerts: OverviewAlert[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-24" />;
  if (alerts.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="text-emerald-500" />
        <AlertTitle>No active alerts</AlertTitle>
        <AlertDescription>
          No open critical or high-severity faults, overdue pipelines or stations under maintenance.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {alerts.map((alert) => {
        const Icon = ALERT_ICONS[alert.level];
        return (
          <li key={alert.id}>
            <Alert variant={alert.level === "critical" ? "destructive" : "default"}>
              <Icon className={ALERT_ICON_CLASS[alert.level]} />
              <AlertTitle className="flex items-start justify-between gap-2">
                <span>{alert.title}</span>
                <Link href={alert.href} className="text-xs font-normal whitespace-nowrap underline-offset-4 hover:underline">
                  View
                </Link>
              </AlertTitle>
              <AlertDescription>{alert.detail}</AlertDescription>
            </Alert>
          </li>
        );
      })}
    </ul>
  );
}

export function OverviewDashboard() {
  const [selection, setSelection] = useState(ALL_AREAS);
  const {
    pipelines,
    status: pipelinesStatus,
    updatedAt: pipelinesUpdatedAt,
    retry: retryPipelines,
  } = usePipelines();
  const {
    faults,
    status: faultsStatus,
    updatedAt: faultsUpdatedAt,
    retry: retryFaults,
  } = useFaults();

  const isLoadingPipelines = pipelinesStatus === "loading";
  const isLoadingFaults = faultsStatus === "loading";

  const kpis = useMemo(() => getOverviewKpis(pipelines, faults, selection), [pipelines, faults, selection]);
  const areas = useMemo(() => getAreaBreakdown(pipelines, faults), [pipelines, faults]);
  const statusBreakdown = useMemo(
    () => getPipelineStatusBreakdown(pipelines, selection),
    [pipelines, selection]
  );
  const openFaults = useMemo(
    () => filterFaultsBySelection(faults, selection).filter(isOpenFault),
    [faults, selection]
  );
  // The time is only used for "older than a day" checks, so the latest refresh time is
  // precise enough and keeps this calculation pure.
  const lastUpdated = Math.max(pipelinesUpdatedAt ?? 0, faultsUpdatedAt ?? 0);
  const alerts = useMemo(
    () => buildAlerts(pipelines, faults, selection, lastUpdated || 0),
    [pipelines, faults, selection, lastUpdated]
  );
  const recentFaults = useMemo(
    () => filterFaultsBySelection(faults, selection).slice(0, 5),
    [faults, selection]
  );
  const recentPipelines = useMemo(
    () => filterPipelinesBySelection(pipelines, selection).slice(0, 5),
    [pipelines, selection]
  );

  const selectedArea = getGeographicalArea(selection);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={areaOptions}
          value={selection}
          onValueChange={(value) => setSelection(typeof value === "string" ? value : ALL_AREAS)}
        >
          <SelectTrigger aria-label="Geographical area" className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {areaOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedArea ? (
          <span className="text-muted-foreground font-mono text-xs">
            {selectedArea.authorizationId} · authorised {selectedArea.authorizedOn}
          </span>
        ) : null}
        <Badge variant="outline" className="ml-auto gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          {lastUpdated
            ? `Auto-updating · ${new Date(lastUpdated).toLocaleTimeString("en-IN", { timeStyle: "short" })}`
            : "Loading…"}
        </Badge>
      </div>

      {pipelinesStatus === "error" || faultsStatus === "error" ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Some data could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {pipelinesStatus === "error" ? (
              <Button size="sm" variant="outline" onClick={retryPipelines}>
                Retry pipelines
              </Button>
            ) : null}
            {faultsStatus === "error" ? (
              <Button size="sm" variant="outline" onClick={retryFaults}>
                Retry faults
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Network length"
          value={formatKilometres(kpis.totalKm)}
          detail={`Steel ${formatKilometres(kpis.network.steelKm)} · MDPE ${formatKilometres(kpis.network.mdpeKm)} · registered ${formatKilometres(kpis.registered.totalKm)}`}
          icon={Waypoints}
          isLoading={isLoadingPipelines}
        />
        <KpiCard
          title="Registered pipelines"
          value={formatNumber(kpis.registered.count)}
          detail={`${formatNumber(kpis.registered.operationalCount)} operational · ${formatNumber(kpis.notYetBuiltCount)} planned or under construction`}
          icon={Route}
          isLoading={isLoadingPipelines}
        />
        <KpiCard
          title="City Gate Stations"
          value={`${kpis.network.cgsOnline} / ${kpis.network.cgsCount} online`}
          detail={`${formatNumber(kpis.cgsCapacityScmh)} SCMH combined capacity`}
          icon={Gauge}
        />
        <KpiCard
          title="Domestic connections"
          value={formatNumber(kpis.network.domesticConnections)}
          detail={`${formatNumber(kpis.network.industrialConsumers)} industrial · ${formatNumber(kpis.network.commercialUnits)} commercial`}
          icon={Factory}
        />
        <KpiCard
          title="Open faults"
          value={formatNumber(kpis.openFaultCount)}
          detail={`${kpis.criticalFaultCount} critical · ${kpis.highFaultCount} high severity`}
          icon={CircleAlert}
          tone={kpis.criticalFaultCount > 0 ? "danger" : undefined}
          isLoading={isLoadingFaults}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Network length by geographical area</CardTitle>
            <CardDescription>
              Steel trunk mains, MDPE distribution and registered pipelines. Select an area to focus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AreaLengthChart
              areas={areas}
              selection={selection}
              onSelect={(code) => setSelection(code === selection ? ALL_AREAS : code)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Items that need attention{selectedArea ? ` in ${selectedArea.name}` : ""}.</CardDescription>
            <CardAction>
              <Badge variant={alerts.some((alert) => alert.level === "critical") ? "destructive" : "secondary"}>
                {alerts.length}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <AlertsList alerts={alerts} isLoading={isLoadingPipelines || isLoadingFaults} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Registered pipelines by status</CardTitle>
            <CardDescription>Count and length of each operational status.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPipelines ? (
              <Skeleton className="h-40" />
            ) : (
              <BarList
                emptyText="No registered pipelines in this selection yet."
                items={statusBreakdown.map((item) => ({
                  key: item.status,
                  label: item.label,
                  value: item.km,
                  valueLabel: formatKilometres(item.km),
                  detail: `${item.count} ${item.count === 1 ? "line" : "lines"}`,
                  barClassName: pipelineStatusDotClass[item.status],
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open faults by severity</CardTitle>
            <CardDescription>Unresolved fault reports from field staff.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFaults ? (
              <Skeleton className="h-40" />
            ) : (
              <BarList
                emptyText="No open faults in this selection."
                items={[...faultSeverities].reverse().map((severity) => {
                  const count = openFaults.filter((fault) => fault.severity === severity.value).length;
                  return {
                    key: severity.value,
                    label: severity.label,
                    value: count,
                    valueLabel: formatNumber(count),
                    barClassName: SEVERITY_BAR_CLASS[severity.value],
                  };
                })}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domestic connections by area</CardTitle>
            <CardDescription>Households supplied, with industrial and commercial units.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectionsChart areas={areas} selection={selection} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent fault reports</CardTitle>
            <CardDescription>The latest five reports{selectedArea ? ` in ${selectedArea.name}` : ""}.</CardDescription>
            <CardAction>
              <Link href="/map" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <MapPinned className="size-4" />
                Map
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoadingFaults ? (
              <Skeleton className="h-32" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fault</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFaults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                        No fault reports.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentFaults.map((fault) => {
                      const code = getAreaCodeForPoint(fault.longitude, fault.latitude);
                      return (
                        <TableRow key={fault.id}>
                          <TableCell className="max-w-48 truncate" title={fault.title}>
                            {fault.title}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5">
                              <span className={cn("size-1.5 rounded-full", SEVERITY_BAR_CLASS[fault.severity])} />
                              {getFaultSeverityLabel(fault.severity)}
                            </span>
                          </TableCell>
                          <TableCell>{getFaultStatusLabel(fault.status)}</TableCell>
                          <TableCell>{code ? getGeographicalArea(code)?.name : "—"}</TableCell>
                          <TableCell className="tabular-nums">{formatDateTime(fault.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently added pipelines</CardTitle>
            <CardDescription>The latest five registered pipelines{selectedArea ? ` in ${selectedArea.name}` : ""}.</CardDescription>
            <CardAction>
              <Link href="/pipelines" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Route className="size-4" />
                Pipelines
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoadingPipelines ? (
              <Skeleton className="h-32" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pipeline ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Length</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPipelines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground h-16 text-center">
                        No registered pipelines.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPipelines.map((pipeline) => (
                      <TableRow key={pipeline.id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/map?pipeline=${encodeURIComponent(pipeline.id)}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {pipeline.pipelineCode}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-48 truncate" title={pipeline.name}>
                          {pipeline.name}
                        </TableCell>
                        <TableCell>
                          <PipelineStatusBadge status={pipeline.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatKilometres(pipeline.lengthKm)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatKilometres, formatNumber } from "@/lib/format";
import {
  ALL_AREAS,
  geographicalAreas,
  getGeographicalArea,
} from "@/lib/network/dummy-data";
import { networkLayers, type NetworkLayerDefinition } from "@/lib/network/layers";
import { GA_BOUNDARY_SWATCH_CLASS, NETWORK_COLORS } from "@/lib/network/map-theme";
import type { NetworkLayerId, NetworkSummary } from "@/lib/network/types";
import type { PipelineSummary } from "@/lib/pipelines/summary";

type NetworkSidePanelProps = {
  selection: string;
  onSelectionChange: (selection: string) => void;
  visibleLayers: Record<NetworkLayerId, boolean>;
  onLayerToggle: (layerId: NetworkLayerId, isVisible: boolean) => void;
  summary: NetworkSummary;
  pipelineSummary: PipelineSummary;
  openFaultCount: number;
};

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
      {children}
    </h2>
  );
}

// The same swatch is used in the layer list and the legend, so the two always match.
function LayerSwatch({ layer }: { layer: NetworkLayerDefinition }) {
  if (layer.shape === "flow") {
    return (
      <span className="text-muted-foreground flex w-4 items-center justify-center">
        <ChevronsRight className="size-3.5" />
      </span>
    );
  }
  return (
    <span
      className={layer.shape === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-full"}
      style={{ backgroundColor: layer.color }}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-[11px] uppercase">{label}</div>
    </div>
  );
}

export function NetworkSidePanel({
  selection,
  onSelectionChange,
  visibleLayers,
  onLayerToggle,
  summary,
  pipelineSummary,
  openFaultCount,
}: NetworkSidePanelProps) {
  const selectedArea = getGeographicalArea(selection);

  const layerCounts: Record<NetworkLayerId, number> = {
    steel: summary.steelSegments,
    mdpe: summary.mdpeSegments,
    pipelines: pipelineSummary.count,
    flow: summary.steelSegments + summary.mdpeSegments + pipelineSummary.flowCount,
    cgs: summary.cgsCount,
    industrial: summary.industrialConsumers,
    faults: openFaultCount,
  };

  return (
    <aside className="bg-card flex flex-col gap-6 overflow-y-auto border-b p-4 lg:w-80 lg:shrink-0 lg:border-r lg:border-b-0">
      <section>
        <PanelHeading>Geographical areas</PanelHeading>
        <p className="text-muted-foreground mb-3 text-xs">
          A Geographical Area (GA) is a city or district where a company is
          authorised to supply gas. Pick one to focus the map and figures; its
          boundary is highlighted on the map.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selection === ALL_AREAS ? "secondary" : "outline"}
            aria-pressed={selection === ALL_AREAS}
            onClick={() => onSelectionChange(ALL_AREAS)}
          >
            All GAs
          </Button>
          {geographicalAreas.map((area) => (
            <Button
              key={area.code}
              size="sm"
              variant={selection === area.code ? "secondary" : "outline"}
              aria-pressed={selection === area.code}
              onClick={() => onSelectionChange(area.code)}
            >
              {area.name}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border p-3">
        <div className="text-sm font-semibold">
          {selectedArea ? `${selectedArea.name} GA` : "All geographical areas"}
        </div>
        <div className="text-muted-foreground mb-3 font-mono text-[11px]">
          {selectedArea
            ? selectedArea.authorizationId
            : `${summary.areaCount} areas combined`}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Domestic conn." value={formatNumber(summary.domesticConnections)} />
          <Metric label="Industrial units" value={formatNumber(summary.industrialConsumers)} />
          <Metric label="Commercial units" value={formatNumber(summary.commercialUnits)} />
          <Metric
            label={selectedArea ? "Authorised" : "Stations online"}
            value={selectedArea ? selectedArea.authorizedOn : String(summary.cgsOnline)}
          />
        </div>
      </section>

      <section>
        <PanelHeading>Network summary</PanelHeading>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border p-3">
            <div className="text-xl font-semibold text-amber-500 tabular-nums">
              {formatKilometres(summary.steelKm)}
            </div>
            <div className="text-muted-foreground text-xs">Steel trunk mains</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-primary text-xl font-semibold tabular-nums">
              {formatKilometres(summary.mdpeKm)}
            </div>
            <div className="text-muted-foreground text-xs">MDPE distribution</div>
          </div>
          <div className="col-span-2 rounded-xl border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xl font-semibold text-cyan-500 tabular-nums">
                {formatKilometres(pipelineSummary.totalKm)}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                {formatNumber(pipelineSummary.count)}{" "}
                {pipelineSummary.count === 1 ? "pipeline" : "pipelines"} ·{" "}
                {formatNumber(pipelineSummary.operationalCount)} operational
              </div>
            </div>
            <div className="text-muted-foreground text-xs">Registered pipelines</div>
          </div>
        </div>
      </section>

      <section>
        <PanelHeading>Layers</PanelHeading>
        <div className="-mx-2 flex flex-col">
          {networkLayers.map((layer) => (
            <label
              key={layer.id}
              className="hover:bg-accent flex cursor-pointer items-start gap-3 rounded-lg p-2"
            >
              <Checkbox
                className="mt-0.5"
                checked={visibleLayers[layer.id]}
                onCheckedChange={(checked) => onLayerToggle(layer.id, checked === true)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <LayerSwatch layer={layer} />
                  <span className="text-sm font-medium">{layer.label}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {formatNumber(layerCounts[layer.id])}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{layer.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section>
        <PanelHeading>Legend</PanelHeading>
        <ul className="text-muted-foreground space-y-2 text-xs">
          <li className="flex items-center gap-3">
            <span className="h-1 w-5 rounded-full" style={{ backgroundColor: NETWORK_COLORS.steel }} />
            Steel trunk main · MAOP ≥ 19 bar
          </li>
          <li className="flex items-center gap-3">
            <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: NETWORK_COLORS.mdpe }} />
            MDPE distribution · ≤ 4 bar (SDR-11)
          </li>
          <li className="flex items-center gap-3">
            <span
              className="h-1 w-5 rounded-full ring-1 ring-cyan-950 dark:ring-cyan-50"
              style={{ backgroundColor: NETWORK_COLORS.pipelines }}
            />
            Registered pipeline · in service
          </li>
          <li className="flex items-center gap-3">
            <span className="w-5 border-t-2 border-dashed border-cyan-500" />
            Registered · planned or under construction
          </li>
          <li className="flex items-center gap-3">
            <span className="flex w-5 justify-center">
              <ChevronsRight className="size-3.5" />
            </span>
            Configured gas flow direction (not live data)
          </li>
          <li className="flex items-center gap-3">
            <span className={`h-3 w-5 rounded-[3px] ${GA_BOUNDARY_SWATCH_CLASS}`} />
            Geographical area boundary · dashed outline
          </li>
        </ul>
      </section>

      <p className="text-muted-foreground mt-auto text-[11px] leading-relaxed">
        Demo dataset. Assets, routes, boundaries and counts are illustrative and
        do not represent a real physical network. Registered pipelines are stored
        in the database.
      </p>
    </aside>
  );
}
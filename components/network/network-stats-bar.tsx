import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatKilometres, formatNumber } from "@/lib/format";
import type { NetworkSummary } from "@/lib/network/types";

export function NetworkStatsBar({ summary }: { summary: NetworkSummary }) {
  const stats = [
    {
      label: "CGS",
      value: formatNumber(summary.cgsCount),
      valueClassName: "text-amber-500",
      description:
        "City Gate Stations: where gas enters the city network and its pressure is reduced.",
    },
    {
      label: "Industrial consumers",
      value: formatNumber(summary.industrialConsumers),
      valueClassName: "text-violet-500",
      description: "Industrial units currently connected to the network.",
    },
    {
      label: "Network length",
      value: formatKilometres(summary.totalKm),
      valueClassName: "text-primary",
      description: "Combined length of steel trunk mains and MDPE distribution lines.",
    },
  ];

  return (
    <div className="bg-card/90 flex divide-x rounded-xl border shadow-sm backdrop-blur">
      {stats.map((stat) => (
        <Tooltip key={stat.label}>
          <TooltipTrigger render={<div className="px-4 py-2.5 text-left" />}>
            <div className={`text-lg leading-none font-semibold tabular-nums ${stat.valueClassName}`}>
              {stat.value}
            </div>
            <div className="text-muted-foreground mt-1 text-[11px] tracking-wide uppercase">
              {stat.label}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{stat.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
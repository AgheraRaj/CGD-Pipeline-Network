import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getResizedPhotoUrl } from "@/lib/faults/photo-url";
import type { AssetDetails } from "@/lib/network/asset-details";

type AssetDetailCardProps = {
  asset: AssetDetails;
  onClose: () => void;
};

export function AssetDetailCard({ asset, onClose }: AssetDetailCardProps) {
  return (
    <div
      role="dialog"
      aria-label={`${asset.title} details`}
      className="bg-card/95 absolute top-3 right-3 z-10 max-h-[calc(100%-1.5rem)] w-72 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border p-4 shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary">{asset.kindLabel}</Badge>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-2 size-7"
          onClick={onClose}
          aria-label="Close details"
        >
          <X className="size-4" />
        </Button>
      </div>

      <h2 className="mt-2 text-base font-semibold">{asset.title}</h2>

      {asset.photoUrl ? (
        <a href={asset.photoUrl} target="_blank" rel="noreferrer" title="Open full-size photograph">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getResizedPhotoUrl(asset.photoUrl, 600)}
            alt={`Photograph of ${asset.title}`}
            className="mt-3 aspect-4/3 w-full rounded-lg border object-cover"
          />
        </a>
      ) : null}

      {asset.description ? (
        <p className="text-muted-foreground mt-3 text-sm">{asset.description}</p>
      ) : null}

      <dl className="mt-3 space-y-2 text-sm">
        {asset.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="flex items-center gap-1.5 text-right font-mono text-xs font-medium">
              {row.tone === "ok" ? (
                <span className="size-1.5 rounded-full bg-emerald-500" />
              ) : null}
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
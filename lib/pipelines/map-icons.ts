import type { Map as MapLibreMap } from "maplibre-gl";
import type { FlowKind } from "@/lib/network/flow";

// A chevron per line type: white so it reads on top of the coloured line, with an outline
// in a dark shade of that line's colour so it also reads on light and dark basemaps.
const ARROW_OUTLINES: Record<FlowKind, string> = {
  steel: "#78350f",
  mdpe: "#1e3a8a",
  pipelines: "#083344",
};

export const flowArrowImageId = (kind: FlowKind) => `flow-arrow-${kind}`;

function drawChevron(outline: string) {
  const pixelRatio = 2;
  const size = 14 * pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.lineCap = "round";
  context.lineJoin = "round";
  const path = () => {
    context.beginPath();
    context.moveTo(size * 0.3, size * 0.2);
    context.lineTo(size * 0.72, size * 0.5);
    context.lineTo(size * 0.3, size * 0.8);
    context.stroke();
  };
  context.strokeStyle = outline;
  context.lineWidth = 5 * pixelRatio;
  path();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2.5 * pixelRatio;
  path();
  return { image: context.getImageData(0, 0, size, size), pixelRatio };
}

// Style changes drop images, so this runs again every time the basemap reloads.
export function addFlowArrowImages(map: MapLibreMap) {
  for (const kind of Object.keys(ARROW_OUTLINES) as FlowKind[]) {
    const id = flowArrowImageId(kind);
    if (map.hasImage(id)) continue;
    const chevron = drawChevron(ARROW_OUTLINES[kind]);
    if (chevron) map.addImage(id, chevron.image, { pixelRatio: chevron.pixelRatio });
  }
}

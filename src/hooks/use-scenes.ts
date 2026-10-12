"use client";

import { useQuery } from "@tanstack/react-query";
import { searchScenes, type StacScene } from "@/lib/imagery/sentinel";
import type { FieldPolygon } from "@/lib/agronomy/types";

/** Sentinel-2 scenes over the field for a date window, newest first. */
export function useScenes(field: FieldPolygon | null, window: { start: Date; end: Date }, maxCloud = 60) {
  return useQuery<StacScene[]>({
    queryKey: ["scenes", field ? JSON.stringify(field.geometry) : null, window.start.toISOString(), window.end.toISOString(), maxCloud],
    queryFn: ({ signal }) => searchScenes(field!.geometry, window.start, window.end, { maxCloud, signal }),
    enabled: Boolean(field),
    staleTime: 30 * 60_000,
  });
}

/** Thumbnail of just the field area, rendered by the Planetary Computer data API. */
export function sceneThumbUrl(sceneId: string, bbox: [number, number, number, number]) {
  const [w, s, e, n] = bbox;
  const pad = Math.max(e - w, n - s) * 0.15;
  return (
    `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${(w - pad).toFixed(5)},${(s - pad).toFixed(5)},${(e + pad).toFixed(5)},${(n + pad).toFixed(5)}/160x160.png` +
    `?collection=sentinel-2-l2a&item=${encodeURIComponent(sceneId)}&assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0`
  );
}

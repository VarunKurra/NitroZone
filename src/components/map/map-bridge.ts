/**
 * Imperative handle to the single MapLibre instance, for components outside the map
 * (address search "fly to", PDF snapshots, presentation mode).
 */
import type { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";

let current: MLMap | null = null;
const waiters: ((m: MLMap) => void)[] = [];

export const mapBridge = {
  set(m: MLMap | null) {
    current = m;
    if (m) waiters.splice(0).forEach((w) => w(m));
  },
  get: () => current,
  whenReady(): Promise<MLMap> {
    return current ? Promise.resolve(current) : new Promise((r) => waiters.push(r));
  },
  flyTo(center: [number, number], zoom = 15) {
    current?.flyTo({ center, zoom, duration: 1600, essential: true });
  },
  fitBounds(b: LngLatBoundsLike, padding = 80) {
    current?.fitBounds(b, { padding, duration: 1200, maxZoom: 17 });
  },
};

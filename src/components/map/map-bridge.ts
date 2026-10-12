/**
 * Imperative handle to whichever map is on screen (the WebGL MapLibre map, or the simple
 * fallback map for browsers without WebGL), for components outside the map such as the
 * address search "fly to".
 */
export type Bounds = [[number, number], [number, number]];

/** Where the map opens: Missouri farmland (Audrain County), close enough to outline a field right away. */
export const START_VIEW = { center: [-91.72, 39.27] as [number, number], zoom: 14 };

export interface MapAdapter {
  flyTo(center: [number, number], zoom: number): void;
  fitBounds(bounds: Bounds, padding: number): void;
}

let current: MapAdapter | null = null;

export const mapBridge = {
  set(adapter: MapAdapter | null) {
    current = adapter;
  },
  flyTo(center: [number, number], zoom = 15) {
    current?.flyTo(center, zoom);
  },
  fitBounds(b: Bounds, padding = 80) {
    current?.fitBounds(b, padding);
  },
};

/** True if this browser can create a WebGL2 context (MapLibre GL v6 requires it). */
export function hasWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch {
    return false;
  }
}

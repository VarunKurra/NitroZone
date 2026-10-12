/**
 * Zone colours: ONE palette used identically by the map, legends, charts, PDF and KML.
 *
 * Ordered from zone 1 (least vigor, most N) to zone 5 (most vigor, least N):
 *   rust -> orange -> olive gold -> green-teal -> blue
 * Validated for colour-vision deficiency (protanopia/deuteranopia simulation, adjacent-pair
 * Delta E >= 12) and normal-vision separation (>= 15). Never red-vs-green alone, and zones
 * are always also labelled with their number, so colour is never the only cue.
 */
export const ZONE_PALETTE_5 = ["#9f2f12", "#d6631c", "#c4b42f", "#2fae8a", "#0072a3"] as const;

/** Which palette slots to use for 3, 4 or 5 zones (keeps the extremes, spreads the middle). */
const SLOTS: Record<number, number[]> = { 1: [2], 2: [0, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

export function zoneColors(zoneCount: number): string[] {
  return (SLOTS[zoneCount] ?? SLOTS[5]).map((i) => ZONE_PALETTE_5[i]);
}

export function zoneColor(zone: number, zoneCount: number): string {
  return zoneColors(zoneCount)[zone - 1] ?? "#888888";
}

/** Plain-language name for each zone, by relative position. */
export function zoneLabel(zone: number, zoneCount: number): string {
  if (zone === 1) return "Lowest vigor";
  if (zone === zoneCount) return "Highest vigor";
  const mid = (zoneCount + 1) / 2;
  if (zone === mid) return "Average vigor";
  return zone < mid ? "Below average" : "Above average";
}

/**
 * Sequential ramp for continuous index maps (NDRE/NDVI heat maps): light yellow-green to
 * deep teal, one perceptual direction (more vigor = darker).
 */
export const INDEX_RAMP = ["#f7f4d9", "#d9e8a6", "#9fd17f", "#5bb37a", "#2b8c74", "#0f6466", "#0b3f52"];

/** Sequential ramp for nitrogen rate (more N = darker amber). */
export const RATE_RAMP = ["#fdf3dc", "#f8d79a", "#efb35b", "#d98a2b", "#b0641a", "#7a4310"];

export function rampColor(ramp: readonly string[], t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(ramp[i]);
  const b = hexToRgb(ramp[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** KML wants aabbggrr. */
export function hexToKml(hex: string, alpha = 0xcc): string {
  const [r, g, b] = hexToRgb(hex);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `${h(alpha)}${h(b)}${h(g)}${h(r)}`;
}

/**
 * Live Sentinel-2 L2A imagery from Microsoft Planetary Computer (free, no account needed).
 *
 *   1. STAC search: scenes that intersect the field in the chosen date window.
 *   2. SAS token:   Planetary Computer blobs need a short-lived read token (also free).
 *   3. COG reads:   Cloud-Optimized GeoTIFFs allow reading ONLY the small window that covers
 *                   the field via HTTP range requests (a few hundred KB instead of ~1 GB/scene).
 *   4. Bands -> indices: see `bandsToIndexRaster`, shared by live and cached imagery.
 */
import { fromUrl } from "geotiff";
import { makeProjector, polygonsOf, mapPolys, boundsOf, projForEpsg } from "@/lib/agronomy/geo";
import { ndre, ndvi, s2Reflectance, sclIsValid } from "@/lib/agronomy/indices";
import type { IndexRaster } from "@/lib/agronomy/types";
import type { MultiPolygon, Polygon } from "geojson";

export const STAC_API = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
export const SAS_API = "https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a";

export interface StacScene {
  id: string;
  datetime: string;
  cloudCover: number;
  epsg: number;
  processingBaseline: string | null;
  /** Footprint of valid data (lon/lat). */
  geometry: Polygon | MultiPolygon;
  assets: { B04: string; B05: string; B08: string; SCL: string; visual: string };
}

/** Raw band windows as read from the COGs (or from the bundled cache). */
export interface RawS2Bands {
  sceneId: string;
  datetime: string;
  cloudCover: number;
  epsg: number;
  processingBaseline: string | null;
  /** 10 m grid: B04, B08, TCI. Upper-left corner in the scene CRS. */
  width: number;
  height: number;
  originX: number;
  originY: number;
  b04: Uint16Array;
  b08: Uint16Array;
  /** 20 m grid: B05, SCL. */
  width20: number;
  height20: number;
  originX20: number;
  originY20: number;
  b05: Uint16Array;
  scl: Uint8Array;
  /** True colour (TCI) 10 m, interleaved RGB. */
  tci: Uint8Array | null;
}

interface StacFeature {
  id: string;
  geometry: Polygon | MultiPolygon;
  properties: Record<string, unknown>;
  assets: Record<string, { href: string }>;
}

/**
 * Search scenes intersecting the field. Dates must be full RFC 3339 timestamps.
 */
export async function searchScenes(
  field: Polygon | MultiPolygon,
  start: Date,
  end: Date,
  { maxCloud = 60, signal }: { maxCloud?: number; signal?: AbortSignal } = {},
): Promise<StacScene[]> {
  const res = await fetch(STAC_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      intersects: field,
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit: 50,
      query: { "eo:cloud_cover": { lt: maxCloud } },
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    }),
  });
  if (!res.ok) throw new Error(`Satellite catalog search failed (${res.status})`);
  const json = (await res.json()) as { features: StacFeature[] };
  const fieldPolys = polygonsOf(field);
  return json.features
    .map((f) => ({
      id: f.id,
      datetime: String(f.properties.datetime),
      cloudCover: Number(f.properties["eo:cloud_cover"] ?? 0),
      epsg: Number(f.properties["proj:epsg"] ?? String(f.properties["proj:code"] ?? "").replace("EPSG:", "")),
      processingBaseline: (f.properties["s2:processing_baseline"] as string) ?? null,
      geometry: f.geometry,
      assets: {
        B04: f.assets.B04.href,
        B05: f.assets.B05.href,
        B08: f.assets.B08.href,
        SCL: f.assets.SCL.href,
        visual: f.assets.visual.href,
      },
    }))
    .filter((s) => fieldPolys.every((rings) => rings[0].every((p) => pointInFootprint(p[0], p[1], s.geometry))));
}

function pointInFootprint(x: number, y: number, g: Polygon | MultiPolygon) {
  let inside = false;
  for (const rings of polygonsOf(g))
    for (const ring of rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
  return inside;
}

let cachedToken: { token: string; expires: number } | null = null;
export async function getSasToken(signal?: AbortSignal): Promise<string> {
  if (cachedToken && cachedToken.expires - Date.now() > 5 * 60_000) return cachedToken.token;
  const res = await fetch(SAS_API, { signal });
  if (!res.ok) throw new Error(`Could not get imagery access token (${res.status})`);
  const json = (await res.json()) as { token: string; "msft:expiry": string };
  cachedToken = { token: json.token, expires: new Date(json["msft:expiry"]).getTime() };
  return json.token;
}

/** Read the band windows covering the field (+ a 30 m margin) from the scene's COGs. */
export async function readSceneBands(
  scene: StacScene,
  field: Polygon | MultiPolygon,
  signal?: AbortSignal,
): Promise<RawS2Bands> {
  const token = await getSasToken(signal);
  const crs = projForEpsg(scene.epsg);
  const { toMetric } = makeProjector(crs);
  const [minX, minY, maxX, maxY] = boundsOf(mapPolys(polygonsOf(field), toMetric));
  const bbox: [number, number, number, number] = [minX - 30, minY - 30, maxX + 30, maxY + 30];

  const open = async (href: string) => (await fromUrl(`${href}?${token}`, { allowFullFile: false })).getImage();
  const [i04, i08, i05, iscl, itci] = await Promise.all([
    open(scene.assets.B04),
    open(scene.assets.B08),
    open(scene.assets.B05),
    open(scene.assets.SCL),
    open(scene.assets.visual).catch(() => null),
  ]);

  const win = (img: Awaited<ReturnType<typeof open>>) => {
    const [ox, oy] = img.getOrigin();
    const [rx] = img.getResolution();
    const x0 = Math.max(0, Math.floor((bbox[0] - ox) / rx));
    const y0 = Math.max(0, Math.floor((oy - bbox[3]) / rx));
    const x1 = Math.min(img.getWidth(), Math.ceil((bbox[2] - ox) / rx));
    const y1 = Math.min(img.getHeight(), Math.ceil((oy - bbox[1]) / rx));
    return { window: [x0, y0, x1, y1] as [number, number, number, number], originX: ox + x0 * rx, originY: oy - y0 * rx, w: x1 - x0, h: y1 - y0 };
  };
  const w10 = win(i04);
  const w20 = win(i05);
  const read1 = async (img: Awaited<ReturnType<typeof open>>, w: ReturnType<typeof win>) => {
    const r = await img.readRasters({ window: w.window, samples: [0], signal });
    return r[0] as ArrayLike<number>;
  };
  const [b04, b08, b05, scl] = await Promise.all([read1(i04, w10), read1(i08, w10), read1(i05, w20), read1(iscl, w20)]);
  let tci: Uint8Array | null = null;
  if (itci) {
    const wt = win(itci);
    const rgb = await itci.readRasters({ window: wt.window, interleave: true, signal });
    tci = new Uint8Array(rgb as unknown as ArrayLike<number>);
  }

  return {
    sceneId: scene.id,
    datetime: scene.datetime,
    cloudCover: scene.cloudCover,
    epsg: scene.epsg,
    processingBaseline: scene.processingBaseline,
    width: w10.w,
    height: w10.h,
    originX: w10.originX,
    originY: w10.originY,
    b04: Uint16Array.from(b04),
    b08: Uint16Array.from(b08),
    width20: w20.w,
    height20: w20.h,
    originX20: w20.originX,
    originY20: w20.originY,
    b05: Uint16Array.from(b05),
    scl: Uint8Array.from(scl),
    tci,
  };
}

/**
 * Raw bands -> NDRE / NDVI raster on the 10 m grid.
 * The 20 m red-edge (B05) and SCL bands are sampled at each 10 m pixel centre
 * (nearest neighbour), which is the standard way to combine the two resolutions.
 */
export function bandsToIndexRaster(raw: RawS2Bands): IndexRaster {
  const { width, height } = raw;
  const n = width * height;
  const primary = new Float32Array(n);
  const secondary = new Float32Array(n);
  const rgba = raw.tci ? new Uint8ClampedArray(n * 4) : undefined;
  let masked = 0;
  for (let r = 0; r < height; r++) {
    const y = raw.originY - (r + 0.5) * 10;
    const r20 = Math.floor((raw.originY20 - y) / 20);
    for (let c = 0; c < width; c++) {
      const i = r * width + c;
      const x = raw.originX + (c + 0.5) * 10;
      const c20 = Math.floor((x - raw.originX20) / 20);
      const j = r20 >= 0 && c20 >= 0 && r20 < raw.height20 && c20 < raw.width20 ? r20 * raw.width20 + c20 : -1;
      const sclCode = j >= 0 ? raw.scl[j] : 0;
      const red = s2Reflectance(raw.b04[i], raw.processingBaseline);
      const nir = s2Reflectance(raw.b08[i], raw.processingBaseline);
      const re = j >= 0 ? s2Reflectance(raw.b05[j], raw.processingBaseline) : Number.NaN;
      if (!sclIsValid(sclCode) || !Number.isFinite(red) || !Number.isFinite(nir) || !Number.isFinite(re)) {
        primary[i] = Number.NaN;
        secondary[i] = Number.NaN;
        masked++;
      } else {
        primary[i] = ndre(nir, re);
        secondary[i] = ndvi(nir, red);
      }
      if (rgba && raw.tci) {
        rgba[i * 4] = raw.tci[i * 3];
        rgba[i * 4 + 1] = raw.tci[i * 3 + 1];
        rgba[i * 4 + 2] = raw.tci[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    }
  }
  return {
    width,
    height,
    crs: projForEpsg(raw.epsg),
    originX: raw.originX,
    originY: raw.originY,
    pixelSize: 10,
    primary,
    secondary,
    rgba,
    maskedPixels: masked,
    fieldPixels: n,
  };
}

/**
 * Default date window. Satellite indices only work once there is a crop canopy, so
 * outside the growing season we look at the most recent sidedress window (Jun 10 - Jul 20).
 */
export function defaultWindow(today = new Date()): { start: Date; end: Date; inSeason: boolean; label: string } {
  const y = today.getUTCFullYear();
  const seasonStart = new Date(Date.UTC(y, 5, 10));
  const seasonEnd = new Date(Date.UTC(y, 6, 20, 23, 59, 59));
  if (today >= seasonStart && today <= seasonEnd) {
    const start = new Date(today.getTime() - 21 * 86_400_000);
    return { start, end: today, inSeason: true, label: "Last 21 days" };
  }
  const year = today < seasonStart ? y - 1 : y;
  return {
    start: new Date(Date.UTC(year, 5, 10)),
    end: new Date(Date.UTC(year, 6, 20, 23, 59, 59)),
    inSeason: false,
    label: `${year} sidedress window (Jun 10 - Jul 20)`,
  };
}

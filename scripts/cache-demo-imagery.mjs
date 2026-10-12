#!/usr/bin/env node
/**
 * Re-creates public/demo/demo-scene-2025-07-01.json: the real Sentinel-2 band windows for
 * the bundled demo field, so the full NitroZone flow works offline.
 *
 *   node scripts/cache-demo-imagery.mjs
 *
 * It reads the same Cloud-Optimized GeoTIFFs the app reads live (Microsoft Planetary
 * Computer, free and anonymous) and stores the raw digital numbers. The app then runs the
 * exact same band-to-index code on them as it does for live imagery.
 */
import { fromUrl } from "geotiff";
import proj4 from "proj4";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCENE_ID = "S2C_MSIL2A_20250701T164921_R026_T15SXD_20250701T221619";
// Keep in sync with src/lib/demo/demo-field.ts (bounding box of the field, lon/lat).
const FIELD = [
  [-91.634007, 39.310075], [-91.62502, 39.309969], [-91.625216, 39.29997], [-91.631187, 39.30004],
  [-91.632027, 39.301582], [-91.633031, 39.303621], [-91.633925, 39.305321], [-91.634075, 39.306561],
];
const MARGIN_M = 60;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/demo/demo-scene-2025-07-01.json");

const item = await (await fetch(`https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/${SCENE_ID}`)).json();
const { token } = await (await fetch("https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a")).json();
const epsg = Number(item.properties["proj:epsg"] ?? String(item.properties["proj:code"]).replace("EPSG:", ""));
const utm = `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`;
const xy = FIELD.map((p) => proj4("EPSG:4326", utm, p));
const bbox = [
  Math.min(...xy.map((p) => p[0])) - MARGIN_M,
  Math.min(...xy.map((p) => p[1])) - MARGIN_M,
  Math.max(...xy.map((p) => p[0])) + MARGIN_M,
  Math.max(...xy.map((p) => p[1])) + MARGIN_M,
];

async function read(asset, { interleave = false } = {}) {
  const img = await (await fromUrl(`${item.assets[asset].href}?${token}`)).getImage();
  const [ox, oy] = img.getOrigin();
  const [rx] = img.getResolution();
  const x0 = Math.floor((bbox[0] - ox) / rx), y0 = Math.floor((oy - bbox[3]) / rx);
  const x1 = Math.ceil((bbox[2] - ox) / rx), y1 = Math.ceil((oy - bbox[1]) / rx);
  const data = interleave
    ? await img.readRasters({ window: [x0, y0, x1, y1], interleave: true })
    : (await img.readRasters({ window: [x0, y0, x1, y1], samples: [0] }))[0];
  return { data, w: x1 - x0, h: y1 - y0, ox: ox + x0 * rx, oy: oy - y0 * rx };
}

const [b04, b08, b05, scl, tci] = await Promise.all([read("B04"), read("B08"), read("B05"), read("SCL"), read("visual", { interleave: true })]);
const b64 = (typed) => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString("base64");

const payload = {
  _about: "Real Sentinel-2 L2A band windows (raw digital numbers) for the NitroZone demo field. Source: Microsoft Planetary Computer, Copernicus Sentinel data 2025. Regenerate with scripts/cache-demo-imagery.mjs",
  sceneId: SCENE_ID,
  datetime: item.properties.datetime,
  cloudCover: item.properties["eo:cloud_cover"],
  epsg,
  processingBaseline: item.properties["s2:processing_baseline"] ?? null,
  width: b04.w, height: b04.h, originX: b04.ox, originY: b04.oy,
  b04: b64(Uint16Array.from(b04.data)),
  b08: b64(Uint16Array.from(b08.data)),
  width20: b05.w, height20: b05.h, originX20: b05.ox, originY20: b05.oy,
  b05: b64(Uint16Array.from(b05.data)),
  scl: b64(Uint8Array.from(scl.data)),
  tci: b64(Uint8Array.from(tci.data)),
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload));
console.log(`Wrote ${out}: ${b04.w}x${b04.h} @10 m, ${b05.w}x${b05.h} @20 m, baseline ${payload.processingBaseline}`);

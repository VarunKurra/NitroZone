/**
 * Bundled (offline) Sentinel-2 scene for the demo field.
 * Stored as raw digital numbers so it goes through exactly the same
 * `bandsToIndexRaster` code as live imagery.
 */
import type { RawS2Bands } from "./sentinel";

interface CachedJson {
  sceneId: string;
  datetime: string;
  cloudCover: number;
  epsg: number;
  processingBaseline: string | null;
  width: number;
  height: number;
  originX: number;
  originY: number;
  b04: string;
  b08: string;
  width20: number;
  height20: number;
  originX20: number;
  originY20: number;
  b05: string;
  scl: string;
  tci: string | null;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const u16 = (b64: string) => {
  const bytes = b64ToBytes(b64);
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
};

export function decodeCachedScene(json: CachedJson): RawS2Bands {
  return {
    sceneId: json.sceneId,
    datetime: json.datetime,
    cloudCover: json.cloudCover,
    epsg: json.epsg,
    processingBaseline: json.processingBaseline,
    width: json.width,
    height: json.height,
    originX: json.originX,
    originY: json.originY,
    b04: u16(json.b04),
    b08: u16(json.b08),
    width20: json.width20,
    height20: json.height20,
    originX20: json.originX20,
    originY20: json.originY20,
    b05: u16(json.b05),
    scl: b64ToBytes(json.scl),
    tci: json.tci ? b64ToBytes(json.tci) : null,
  };
}

export async function loadCachedScene(url: string, signal?: AbortSignal): Promise<RawS2Bands> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Bundled sample imagery missing (${res.status})`);
  return decodeCachedScene((await res.json()) as CachedJson);
}

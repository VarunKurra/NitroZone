/**
 * GET /api/geocode?q=... - address / place search for "find my field".
 * Proxies OpenStreetMap Nominatim from the server so we can send the identifying
 * User-Agent its usage policy requires, cache results and stay under 1 request/second.
 */
import { connection } from "next/server";

const cache = new Map<string, { at: number; data: unknown }>();
let lastCall = 0;

export async function GET(req: Request) {
  await connection();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return Response.json({ results: [] });
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return Response.json(hit.data);

  // Nominatim policy: max 1 request per second.
  const wait = Math.max(0, lastCall + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "6");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("addressdetails", "0");
    const res = await fetch(url, {
      headers: { "User-Agent": "NitroZone/1.0 (Congressional App Challenge; https://github.com/VarunKurra/NitroZone)", "Accept-Language": "en-US" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ results: [], error: `Search service returned ${res.status}` }, { status: 502 });
    const raw = (await res.json()) as { display_name: string; lat: string; lon: string; boundingbox: [string, string, string, string]; type: string }[];
    const data = {
      results: raw.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon),
        // Nominatim bbox order: [south, north, west, east]
        bbox: [Number(r.boundingbox[2]), Number(r.boundingbox[0]), Number(r.boundingbox[3]), Number(r.boundingbox[1])],
        type: r.type,
      })),
    };
    cache.set(key, { at: Date.now(), data });
    return Response.json(data);
  } catch {
    return Response.json({ results: [], error: "Search is unavailable right now. Pan and zoom the map instead." }, { status: 502 });
  }
}

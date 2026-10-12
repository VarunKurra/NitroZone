/**
 * POST /api/insights - plain-English field insights from Google Gemini (server-side only).
 *
 * The browser sends ONLY the computed summary numbers (no imagery, no location history).
 * Gemini is instructed to explain those numbers and is not allowed to invent new ones.
 * If GEMINI_API_KEY is missing, rate-limited or failing, the route answers
 * `{ source: "unavailable" }` and the UI keeps its rule-based insights. The key never
 * leaves the server.
 */
import { z } from "zod";
import { createHash } from "node:crypto";

const ZoneSchema = z.object({
  zone: z.number().int().min(1).max(10),
  label: z.string().max(40),
  areaAc: z.number().min(0).max(100000),
  primary: z.number().nullable(),
  sufficiency: z.number().nullable(),
  rateLbAc: z.number().min(0).max(1000),
  totalLbN: z.number(),
});

const BodySchema = z.object({
  mode: z.enum(["field", "zone"]),
  focusZone: z.number().int().min(1).max(10).optional(),
  fieldName: z.string().max(120),
  indexName: z.enum(["NDRE", "VARI"]),
  imagery: z.object({ source: z.string().max(20), date: z.string().max(40).nullable(), cloudPct: z.number().nullable() }),
  areaAc: z.number(),
  baseRate: z.number(),
  pricePerLbN: z.number(),
  healthScore: z.number(),
  sufficientSharePct: z.number(),
  variabilityPct: z.number(),
  referenceKind: z.enum(["strip", "virtual"]),
  totals: z.object({ flatLbN: z.number(), variableLbN: z.number(), savedLbN: z.number(), savedUsd: z.number() }),
  zones: z.array(ZoneSchema).max(10),
  ruleInsights: z.array(z.string().max(600)).max(8),
});

type Body = z.infer<typeof BodySchema>;

// --- tiny in-memory protections (per server instance) ---
const cache = new Map<string, { at: number; insights: string[] }>();
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function prompt(b: Body): string {
  const task =
    b.mode === "zone"
      ? `Explain ZONE ${b.focusZone} to the farmer in 2-3 short sentences: what its numbers mean, why it gets its rate, and one practical thing to check in the field.`
      : "Write 3 to 5 short insights (one or two sentences each) a Missouri corn farmer would find useful before sidedressing.";
  return [
    "You are an agronomy assistant inside NitroZone, a variable-rate nitrogen tool for corn.",
    "Rules: use ONLY the numbers in the JSON below; never invent statistics, yields or prices. Round sensibly.",
    `Vegetation indices (${b.indexName}) are a stress proxy, not a direct nitrogen measurement: low vigor may also be water stress, compaction, disease or poor stand. Say "estimated" for savings.`,
    "Plain English, no jargon without explanation, no markdown headings, no emojis.",
    task,
    "",
    "DATA:",
    JSON.stringify(b),
  ].join("\n");
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ source: "unavailable", reason: "not-configured" });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 20_000) return Response.json({ source: "unavailable", reason: "too-large" }, { status: 413 });

  let body: Body;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ source: "unavailable", reason: "bad-request" }, { status: 400 });
  }

  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < 60 * 60_000) return Response.json({ source: "gemini", insights: hit.insights, cached: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ source: "unavailable", reason: "rate-limited" }, { status: 429 });

  const models = [process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-flash-lite-latest"];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt(body) }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { insights: { type: "ARRAY", items: { type: "STRING" } } }, required: ["insights"] },
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (res.status === 429 || res.status >= 500) continue; // quota or outage: try the lighter model
      if (!res.ok) break;
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const parsed = z.object({ insights: z.array(z.string()).min(1).max(6) }).safeParse(JSON.parse(text));
      if (!parsed.success) continue;
      const insights = parsed.data.insights.map((s) => s.trim()).filter(Boolean).slice(0, 5);
      cache.set(hash, { at: Date.now(), insights });
      return Response.json({ source: "gemini", model, insights });
    } catch {
      // timeout / network / JSON parse: try next model, then give up gracefully
    }
  }
  return Response.json({ source: "unavailable", reason: "upstream" });
}

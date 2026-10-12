/**
 * Persistence for saved fields, saved prescriptions, share links and run analytics.
 *
 * Supabase is used when configured and reachable. Everything falls back to localStorage,
 * so the app works fully offline or before the database tables exist. Every function
 * resolves (never throws) and reports which backend it used.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Backend = "supabase" | "local";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const LS = { device: "nz.device", fields: "nz.fields", rx: "nz.prescriptions", shares: "nz.shares" };

export function deviceId(): string {
  try {
    let id = localStorage.getItem(LS.device);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LS.device, id);
    }
    return id;
  } catch {
    return "00000000-0000-4000-8000-000000000000";
  }
}

let client: SupabaseClient | null | undefined;
function sb(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!URL_ || !KEY || typeof window === "undefined") return (client = null);
  client = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-device-id": deviceId() } },
  });
  return client;
}

export const supabaseConfigured = () => Boolean(URL_ && KEY);

function readLocal<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}
function writeLocal<T>(key: string, rows: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* storage full or blocked: nothing else we can do */
  }
}

/** Race a Supabase call against a timeout so a slow network never blocks the UI. */
async function withTimeout<T>(p: PromiseLike<T>, ms = 6000): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

// ------------------------------------------------------------------ fields
export interface SavedField {
  id: string;
  name: string;
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  area_ac: number;
  updated_at: string;
}

export async function listFields(): Promise<{ rows: SavedField[]; backend: Backend }> {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await withTimeout(c.from("fields").select("id,name,boundary,area_ac,updated_at").order("updated_at", { ascending: false }).limit(50));
      if (!error && data) return { rows: data as SavedField[], backend: "supabase" };
    } catch {
      /* fall through */
    }
  }
  return { rows: readLocal<SavedField>(LS.fields), backend: "local" };
}

export async function saveField(f: Omit<SavedField, "id" | "updated_at">): Promise<{ row: SavedField; backend: Backend }> {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await withTimeout(
        c.from("fields").insert({ ...f, device_id: deviceId() }).select("id,name,boundary,area_ac,updated_at").single(),
      );
      if (!error && data) return { row: data as SavedField, backend: "supabase" };
    } catch {
      /* fall through */
    }
  }
  const row: SavedField = { ...f, id: crypto.randomUUID(), updated_at: new Date().toISOString() };
  writeLocal(LS.fields, [row, ...readLocal<SavedField>(LS.fields)].slice(0, 50));
  return { row, backend: "local" };
}

export async function deleteField(id: string): Promise<Backend> {
  writeLocal(LS.fields, readLocal<SavedField>(LS.fields).filter((r) => r.id !== id));
  const c = sb();
  if (c) {
    try {
      const { error } = await withTimeout(c.from("fields").delete().eq("id", id));
      if (!error) return "supabase";
    } catch {
      /* ignore */
    }
  }
  return "local";
}

// ----------------------------------------------------------- prescriptions
export interface SavedPrescription {
  id: string;
  field_name: string;
  settings: unknown;
  summary: unknown;
  zones: string | null;
  created_at: string;
}

export async function savePrescription(p: Omit<SavedPrescription, "id" | "created_at">): Promise<{ row: SavedPrescription; backend: Backend }> {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await withTimeout(c.from("prescriptions").insert({ ...p, device_id: deviceId() }).select("id,field_name,settings,summary,zones,created_at").single());
      if (!error && data) return { row: data as SavedPrescription, backend: "supabase" };
    } catch {
      /* fall through */
    }
  }
  const row: SavedPrescription = { ...p, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  writeLocal(LS.rx, [row, ...readLocal<SavedPrescription>(LS.rx)].slice(0, 30));
  return { row, backend: "local" };
}

export async function listPrescriptions(): Promise<{ rows: SavedPrescription[]; backend: Backend }> {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await withTimeout(c.from("prescriptions").select("id,field_name,settings,summary,zones,created_at").order("created_at", { ascending: false }).limit(30));
      if (!error && data) return { rows: data as SavedPrescription[], backend: "supabase" };
    } catch {
      /* fall through */
    }
  }
  return { rows: readLocal<SavedPrescription>(LS.rx), backend: "local" };
}

// ------------------------------------------------------------ share links
/** Short random slug (URL-safe, ~95 bits of entropy). */
export function newSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 16);
}

export async function createShare(payload: unknown): Promise<{ slug: string; backend: Backend }> {
  const slug = newSlug();
  const c = sb();
  if (c) {
    try {
      const { error } = await withTimeout(c.from("shared_reports").insert({ slug, payload }), 10_000);
      if (!error) return { slug, backend: "supabase" };
    } catch {
      /* fall through */
    }
  }
  const shares = readLocal<{ slug: string; payload: unknown }>(LS.shares);
  writeLocal(LS.shares, [{ slug, payload }, ...shares].slice(0, 10));
  return { slug, backend: "local" };
}

export async function getShare(slug: string): Promise<{ payload: unknown; backend: Backend } | null> {
  const local = readLocal<{ slug: string; payload: unknown }>(LS.shares).find((s) => s.slug === slug);
  const c = sb();
  if (c) {
    try {
      const { data, error } = await withTimeout(c.rpc("get_shared_report", { p_slug: slug }), 10_000);
      if (!error && data) return { payload: data, backend: "supabase" };
    } catch {
      /* fall through */
    }
  }
  return local ? { payload: local.payload, backend: "local" } : null;
}

// --------------------------------------------------------------- analytics
export function logRun(run: {
  source: "live" | "cached" | "synthetic" | "drone";
  area_ac?: number;
  zone_count?: number;
  cell_size_m?: number;
  duration_ms?: number;
  success: boolean;
  error?: string;
  is_demo?: boolean;
}) {
  const c = sb();
  if (!c) return;
  // Fire and forget: analytics must never affect the farmer's experience.
  void Promise.resolve(
    c.from("analysis_runs").insert({
      ...run,
      area_ac: run.area_ac !== undefined ? Math.round(run.area_ac * 100) / 100 : undefined,
      duration_ms: run.duration_ms !== undefined ? Math.round(run.duration_ms) : undefined,
      error: run.error?.slice(0, 400),
    }),
  ).catch(() => undefined);
}

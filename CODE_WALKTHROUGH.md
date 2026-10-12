# Code walkthrough

A plain-English tour of the files that matter, in the order data flows through the app.

## 1. Imagery in
- **`src/lib/imagery/sentinel.ts`** searches the Planetary Computer STAC catalog for Sentinel-2 scenes over the field, gets a free read token, and reads only the small window of bands B4, B5, B8 and SCL that covers the field from each Cloud-Optimized GeoTIFF. `bandsToIndexRaster` turns digital numbers into reflectance (removing the +1000 offset), drops cloud/shadow pixels using SCL, samples the 20 m red-edge band onto the 10 m grid, and computes **NDRE** and **NDVI** per pixel.
- **`src/lib/imagery/cached.ts`** loads the bundled real scene (`public/demo/…json`, made by `scripts/cache-demo-imagery.mjs`). It goes through the same `bandsToIndexRaster`.
- **`src/lib/imagery/synthetic.ts`** is the last-resort fake raster (fractal noise plus a swale). It's always labeled.
- **`src/lib/imagery/drone.ts`** handles drone GeoTIFFs and photos and computes **VARI** and **ExG**.

## 2. The agronomy engine (`src/lib/agronomy/`), pure and unit-tested
- **`indices.ts`** has the index formulas, the reflectance offset and the SCL mask list, all commented.
- **`grid.ts`** lays a square grid over the field (in UTM metres), clips edge cells to the boundary, averages the clear pixels in each cell (ignoring a thin edge buffer), and gap-fills cloudy cells from neighbours.
- **`kmeans.ts`** is k-means with k-means++ seeding and a fixed random seed, so results are reproducible.
- **`zones.ts`** clusters cells, ranks clusters so Zone 1 = least vigor, runs a 3×3 majority filter, merges patches smaller than the minimum into the neighbour with the longest shared border, and applies the farmer's manual edits.
- **`rates.ts`** holds **all the money math**: `zone rate = base × (1 + adjustment)`, totals, `savings = (flat − variable) × price`, the reference value for the sufficiency index, and the "From SI" suggestion.
- **`health.ts`** computes the health score, the data-confidence checklist, and the rule-based insights.
- **`prescription.ts`** has `derivePrescription()`, the single function every screen and export reads from.
- **`pipeline.ts`** chains raster → grid → zones.

## 3. Off the main thread
- **`src/lib/worker/analysis.worker.ts`** runs downloads and all raster math in a Web Worker, implements the live → bundled → synthetic fallback chain, and reports progress. **`client.ts`** wraps it in a promise.

## 4. The UI
- **`src/store/app-store.ts`** (zustand) holds inputs, the analysis, zone edits with undo/redo, and map/filter state. **`src/hooks/use-prescription.ts`** derives live numbers from it.
- **`src/components/map/field-map.tsx`** is MapLibre with Esri imagery, Terra Draw drawing, zone/rate/index layers, the reveal sweep, hover, click-to-inspect, keyboard navigation and brush painting.
- **`src/components/workspace/`** contains the four steps (field, imagery, rates), the analysis overlay, and **`run-analysis.ts`** (which source to use, toasts, analytics).
- **`src/components/results/`** has the summary (health ring, KPIs, confidence), zone strip, AI insights, the five charts in **`charts.tsx`**, zone table, zone editor, formulas card and download menu.

## 5. Out the door
- **`src/lib/export/features.ts`** turns cells into GeoJSON polygons (correct ring orientation, multi-part cells split).
- **`formats.ts`** builds the shapefile (RATE_LBAC/ZONE/AREA_AC, WGS84 `.prj`), GeoJSON, KML, CSVs and README. **`pdf.ts`** draws the one-page report with a vector map. **`bundle.ts`** zips everything.
- **`tests/unit/exports.test.ts`** writes every format and reads it back with independent parsers.

## 6. Backend
- **`supabase/migrations/…sql`** defines the tables with RLS (device-scoped rows, insert-only analytics, slug-only shared reports). **`src/lib/storage/repo.ts`** talks to Supabase and falls back to localStorage.
- **`src/app/api/insights/route.ts`** calls Gemini server-side with only summary numbers, JSON-schema output, rate limits, a cache and a model fallback. **`src/app/api/geocode/route.ts`** proxies OpenStreetMap search.

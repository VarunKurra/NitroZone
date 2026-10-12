# Decisions log

Judgment calls made while building NitroZone, each with a one-line reason.

## Product & agronomy
- **Corn only, in-season sidedress (about V6–V12).** Satellite vegetation indices need a canopy; soybeans fix their own N.
- **NDRE is the primary signal, NDVI secondary.** NDVI saturates in closed corn canopies; red-edge keeps separating (the app shows this with a live NDVI-vs-NDRE chart for each field).
- **Lower vigor gets more N by default (+15/+5/−10/−20% for 4 zones).** Matches sensor-based practice ("dark crop = low N rate, light crop = high N", MU/Scharf). Defaults are editable starting points, never presented as recommendations.
- **Base rate default 120 lb N/ac.** A plausible sidedress starting point; explicitly labeled "your planned flat rate", not a University of Missouri recommendation.
- **N price default $0.75/lb N.** DTN's UAN32 average for the last week of Sept 2026 (the most common sidedress product).
- **"No application" toggle per zone (−100%).** The demo's Zone 1 is mostly a grassed waterway; farmers need a clean way to zero out non-crop areas.
- **Virtual reference = 95th percentile NDRE when no N-rich strip is drawn.** Gives a sufficiency index without extra field work; the UI always says which reference was used.
- **SI-based "From SI" suggestion uses a transparent heuristic `3 × (0.95 − SI)`, capped ±40%.** I couldn't verify the exact Holland–Schepers coefficients from a primary source, so the app doesn't claim that algorithm.
- **Health score = 100 × area-weighted mean of min(SI, 1).** Simple, explainable, and bounded. It's described as relative vigor uniformity, not N.
- **Savings are fertilizer cost only and warn when VR uses more N.** Required honesty; yield response isn't modeled.

## Data
- **Demo field: a real Audrain County, MO field, 193 ac.** CDL 2025 = 93.3% corn, CDL 2024 = 88.6% soybeans (checked with CropScape rasters), so the corn claim is verifiable.
- **Demo scene 2025-07-01 (3.2% scene cloud, 100% of field clear).** The cleanest canopy-closed scene in the sidedress window. June 21 was considered but showed partial canopy and stronger row/waterway effects.
- **Cache raw digital numbers, not indices.** The cached scene goes through exactly the same code as live imagery.
- **Fallback chain: live → bundled (demo only) → synthetic.** The workflow never dead-ends; synthetic data is always labeled and gets Low confidence.
- **Live imagery from Microsoft Planetary Computer.** Anonymous and free, with CORS-enabled COGs, so all raster reads happen in the browser (Web Worker) with no backend.
- **Baseline 04.00 offset handled.** L2A DNs since 2022 carry +1000; ignoring it skews NDVI/NDRE.
- **Address search via a server proxy to Nominatim.** Needed for its User-Agent and rate-limit policy; it sends no user identifiers.

## Zoning
- **k-means on standardized NDRE (weight 1) + NDVI (weight 0.35), area-weighted, fixed seed.** Deterministic, explainable, and NDRE-led.
- **20 m default grid, 0.75 ac minimum zone, 8 m edge buffer, 3×3 majority filter.** These are practical machinery and data-quality defaults, all editable.
- **Grid-cell prescriptions (not dissolved zones) in exports.** Every controller reads simple polygons; cells keep exact areas and edits.
- **Multi-part clipped cells are split into single polygons for the shapefile.** shp-write would otherwise write polygons and multipolygons to the same filename and one would overwrite the other.

## Design
- **The ui-ux-pro-max design system was generated but its navy/Fira suggestion was overridden.** Corporate navy didn't fit agriculture. I used its agriculture palette search (earth green + harvest gold) and picked distinctive type (Bricolage Grotesque + Geist).
- **Zone palette validated with the dataviz skill's CVD validator.** Rust → orange → olive-gold → green-teal → blue: adjacent CVD ΔE ≥ 12, normal-vision ≥ 16. The contrast WARN is covered by zone numbers on the map and a table view.
- **No red-green encoding anywhere.** Colorblind farmers are common.
- **Light theme only.** It's easier for judges to read, as the brief specified.
- **Footer reference image (`reference/footer-reference.png`) was not present in the repo.** I built the YC-style footer from the written description: company info + socials, link columns, stacked CTAs, and a full-width halftone wordmark.

## Engineering
- **Next.js 16 App Router with Cache Components (defaults from create-next-app).** I read the bundled docs; dynamic data stays in client components or inside Suspense.
- **MapLibre worker served from `/public/vendor` (copied on `postinstall`).** MapLibre v6 resolves its worker relative to its module URL, which breaks once a bundler relocates it.
- **Supabase anonymous access is scoped by an `x-device-id` header checked in RLS.** It's unlisted, not authentication, but devices can't read each other's rows; shared reports are only readable by slug via a security-definer function.
- **Migrations applied with `supabase db push`.** The linked CLI didn't need the DB password; the same SQL is in `SUPABASE_SETUP.sql`.
- **Gemini runs server-side only, with JSON schema output, a model fallback (2.5-flash → flash-lite), a per-IP rate limit and a cache.** Rule-based insights are always shown first, so the app works without AI.
- **Lockfile regenerated cleanly after dependency changes.** npm's optional-dependency bug drops native bindings (rolldown) on partial installs.
- **Playwright uses full Chromium (`channel: "chromium"`) with SwiftShader.** The headless shell has no WebGL, so MapLibre wouldn't render.

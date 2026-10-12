# Design notes

How NitroZone's visual design was decided, and what it borrows from. The persisted design system lives in [`design-system/nitrozone/MASTER.md`](design-system/nitrozone/MASTER.md) (generated with the ui-ux-pro-max skill); the choices below refine it.

## Research

| Reference | What I looked at | What NitroZone borrows |
|---|---|---|
| [OneSoil](https://onesoil.ai/en) | Hero with satellite field imagery, audience-split sections, NDVI zone maps as the core visual | The field map *is* the hero; zones over real imagery instead of stock photos |
| [Felt](https://felt.com) | Map-first product UI with floating panels, legends, coordinate/status chrome | Floating glass panels over a full-bleed map, compact legend, layer switcher |
| [Climate FieldView](https://climate.com) | Prescription ("script") workflow: field → imagery → zones → rates → export | Four-step stepper and the "review zones before export" step |
| [Sentinel Hub EO Browser](https://apps.sentinel-hub.com/eo-browser/) | Scene picker with date + cloud %, index layer switching | Scene cards with field-cropped thumbnails, NDRE/NDVI/True-color layers |
| [Planet](https://www.planet.com) | Dark imagery-forward sections | Dark "How it works" band for contrast and rhythm |
| [Linear](https://linear.app), [Vercel](https://vercel.com), [Stripe](https://stripe.com), [Raycast](https://raycast.com) | Type scale, tight display tracking, restrained motion, layered soft shadows | Bricolage display at −3% to −4% tracking, 3-step shadow scale, spring pill transitions |
| [Magic UI](https://magicui.design/docs/components) | Number ticker, dot/grid patterns, bento grids, border/scan effects | Re-implemented NumberTicker, dot/grid backgrounds, bento features, scan-line loader |
| [shadcn/ui](https://ui.shadcn.com) blocks, [21st.dev](https://21st.dev), [Aceternity](https://ui.aceternity.com), [Origin UI](https://originui.com) | Accessible primitives and polished form controls | Radix-based shadcn components restyled to the brand |
| YC-style footer (from the written brief; the reference PNG wasn't in the repo) | Logo + info + socials, link columns, stacked CTAs, giant halftone wordmark | Canvas-rendered halftone "NITROZONE" whose dot size follows glyph coverage |

## System
- **Palette.** Field green `#15653d` (primary), harvest amber `#e59a1e` (accent), river blue `#0b6e99` (info / runoff), warm soil neutrals, ink `#14201a`. All text pairs ≥ 4.5:1 (checked).
- **Zone colors.** `#9f2f12 → #d6631c → #c4b42f → #2fae8a → #0072a3`, validated for protan/deutan separation with the dataviz skill's validator. Used identically in the map, legends, charts, PDF and KML (`src/lib/palette.ts`). Zones are always labeled Z1–Z5 too.
- **Type.** Bricolage Grotesque (display; agricultural warmth with confidence), Geist (UI/body), Geist Mono (formulas). Tabular figures for every number.
- **Space.** 4 px base; cards 16–24 px padding; section rhythm 96–128 px on the landing page.
- **Motion.** Expo-out easing, 0.4–0.9 s reveals, a scan-line sweep that reveals zones north → south, number tickers, spring pills. `prefers-reduced-motion` turns it all off (MotionConfig + global CSS).
- **Charts.** Each chart answers one farmer question in its title and gives a one-line computed answer underneath. Thin marks, 4 px rounded bar ends, recessive grid, tooltips everywhere, and a sortable table as the accessible alternative.

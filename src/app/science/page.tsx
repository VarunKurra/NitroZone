import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/landing/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ZONE_PALETTE_5 } from "@/lib/palette";
import { PageTransition } from "@/components/common/page-transition";

export const metadata: Metadata = {
  title: "The science",
  description: "How NitroZone turns Sentinel-2 red-edge imagery into a variable-rate nitrogen prescription: indices, cloud masking, zoning, rates, savings and limitations.",
};

const TOC = [
  ["timing", "When to use it"],
  ["imagery", "Imagery & cloud masking"],
  ["formulas", "Indices & formulas"],
  ["zones", "Building zones"],
  ["rates", "Rates & savings"],
  ["reference", "N-rich strip & sufficiency"],
  ["scores", "Health & confidence"],
  ["drone", "Drone images"],
  ["limitations", "Limitations"],
  ["sources", "Sources"],
] as const;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-display text-[1.75rem] font-bold tracking-[-0.02em]">
      {children}
    </h2>
  );
}

function F({ children }: { children: React.ReactNode }) {
  return <pre className="my-4 overflow-x-auto rounded-2xl border bg-white px-5 py-4 font-mono text-[0.9rem] leading-relaxed shadow-[var(--shadow-soft)]">{children}</pre>;
}

function Src({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline">
      {children}
      <ArrowUpRight className="size-3" />
    </a>
  );
}

export default function SciencePage() {
  return (
    <PageTransition>
      <SiteNav />
      <main id="main" className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8">
        <header className="max-w-3xl">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-primary">Methodology</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[3.4rem]">The science behind NitroZone</h1>
          <p className="mt-5 text-[1.1rem] leading-relaxed text-muted-foreground">
            Every number in NitroZone comes from the steps on this page. The same formulas appear inside the app with your own numbers filled in.
          </p>
        </header>

        <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">On this page</p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {TOC.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-foreground/75 hover:text-primary">
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="max-w-3xl space-y-14 text-[1.02rem] leading-relaxed text-foreground/85">
            <section>
              <H2 id="timing">When to use it</H2>
              <p className="mt-4">
                NitroZone is for crops that need nitrogen fertilizer during the season, like corn, wheat and sorghum, and it was built and tested on <strong>Missouri corn</strong> (legumes such as soybeans make their own nitrogen). It is designed for <strong>in-season sidedress</strong>, once the canopy is established, roughly V6 to V12. Earlier, bare soil between the rows dominates what the satellite sees. Iowa State University guidance for canopy sensing notes that corn N uptake becomes rapid around V8, and suggests sensing from about V10 and finishing before tasseling (VT), with high-clearance equipment for later applications (<Src href="https://www.agronext.iastate.edu/soilfertility/info/inseasonnstress.pdf">Iowa State, In-Season Sensing for Nitrogen Stress in Corn</Src>).
              </p>
            </section>

            <section>
              <H2 id="imagery">Imagery &amp; cloud masking</H2>
              <p className="mt-4">
                NitroZone reads <strong>Sentinel-2 Level-2A</strong> surface reflectance from the free <Src href="https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a">Microsoft Planetary Computer</Src> catalog. Bands B4 (red) and B8 (near-infrared) are 10 m; B5 (red edge, 705 nm) is 20 m and is sampled onto the 10 m grid. Only the small window around your field is downloaded from each Cloud-Optimized GeoTIFF.
              </p>
              <p className="mt-4">
                Since processing baseline 04.00 (2022), L2A digital numbers carry a +1000 offset, so reflectance = (DN − 1000) / 10000. Pixels classed in the Scene Classification (SCL) band as no data (0), saturated (1), cloud shadow (3), medium- or high-probability cloud (8, 9), thin cirrus (10) or snow (11) are removed. Grid cells left with no clear pixels borrow the average of their nearest clear neighbours and are flagged <em>estimated</em> everywhere they appear.
              </p>
              <p className="mt-4">If live imagery can&apos;t be loaded, NitroZone falls back to a bundled copy of a real scene (demo field only), then to a synthetic raster that is clearly labeled and gets a Low confidence rating.</p>
            </section>

            <section>
              <H2 id="formulas">Indices &amp; formulas</H2>
              <F>{`NDVI = (B8 − B4) / (B8 + B4)        general greenness
NDRE = (B8 − B5) / (B8 + B5)        red edge, chlorophyll / nitrogen sensitive`}</F>
              <p>
                NDVI tends to saturate once a corn canopy closes: many healthy-looking cells end up with almost the same value. NDRE uses the red-edge band, which keeps responding to leaf chlorophyll, so NitroZone uses <strong>NDRE as the primary nitrogen-stress signal</strong> and NDVI as a secondary feature. The results page includes a live NDVI-vs-NDRE chart so you can check this on your own field.
              </p>
            </section>

            <section>
              <H2 id="zones">Building zones</H2>
              <ol className="mt-4 list-decimal space-y-2.5 pl-5">
                <li>A square prescription grid (10, 20 or 30 m; default 20 m) is laid over the field and clipped to your boundary. Pixels within a few metres of the edge are ignored because they mix crop with roads and ditches.</li>
                <li>Each cell gets the mean NDRE and NDVI of its clear pixels.</li>
                <li><strong>k-means clustering</strong> (k-means++ seeding, fixed random seed so results are reproducible) groups cells by standardized NDRE (main weight) and NDVI.</li>
                <li>Clusters are ranked by mean NDRE, so <strong>Zone 1 is always the least vigorous</strong>.</li>
                <li>A 3 × 3 majority filter removes salt-and-pepper speckle.</li>
                <li>Patches smaller than your minimum (default 0.75 ac) are merged into the neighbouring zone they share the longest border with, so the map is practical for a moving applicator.</li>
                <li>You review the result and can repaint any cell; edits are undoable and flow through every number and export.</li>
              </ol>
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 text-sm shadow-[var(--shadow-soft)]">
                <span className="font-medium">Zone colours (colorblind-safe, same everywhere):</span>
                {ZONE_PALETTE_5.map((c, i) => (
                  <span key={c} className="flex items-center gap-1.5">
                    <span className="size-4 rounded" style={{ background: c }} />
                    {i === 0 ? "least vigor" : i === 4 ? "most vigor" : ""}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <H2 id="rates">Rates &amp; savings</H2>
              <F>{`zone rate (lb N/ac)  = base rate × (1 + zone adjustment)     clamped to your applicator range
zone total (lb N)    = zone rate × zone acres
flat total (lb N)    = base rate × field acres
savings ($)          = (flat total − variable total) × N price ($/lb N)`}</F>
              <p>
                The base rate, every zone adjustment and the nitrogen price are yours to set. Defaults are a starting point only: 120 lb N/ac, and adjustments of +15%, +5%, −10% and −20% for four zones (lower-vigor zones get more N, following the common sensor-based practice of applying more where the crop is paler). The default price of <strong>$0.75/lb N</strong> is the DTN retail average for UAN32 for the last week of September 2026 (<Src href="https://www.dtnpf.com/agriculture/web/ag/crops/article/2026/10/07/uan32-leads-fertilizer-prices-higher">DTN</Src>). Savings are a fertilizer-cost estimate only, and NitroZone warns you if the variable plan uses more nitrogen than the flat rate.
              </p>
            </section>

            <section>
              <H2 id="reference">N-rich strip &amp; sufficiency index</H2>
              <F>{`SI = zone NDRE ÷ reference NDRE`}</F>
              <p>
                A strip that received extra nitrogen early in the season (Iowa State suggests roughly 50–100% more than normal) shows what non-limited corn looks like in the same field, hybrid and weather. If you draw one, it becomes the reference. If not, NitroZone uses a &ldquo;virtual reference&rdquo;: the 95th percentile NDRE of the field. Sufficiency-index research calculates in-season N needs from relative readings in roughly the 0.90–0.95 range (for example <Src href="https://nue.okstate.edu/Index_Yield_Potential/varvel1.pdf">Varvel et al., 2007, Agronomy Journal 99:701–706</Src>, a chlorophyll-meter study). NitroZone counts cells with SI ≥ 0.95 as &ldquo;within 5% of the reference&rdquo;.
              </p>
              <p className="mt-4">
                The optional <strong>&ldquo;From SI&rdquo;</strong> button suggests adjustments with a simple, transparent rule: adjustment = 3 × (0.95 − SI), capped at ±40%. It is a heuristic starting point, not a published calibration. University of Missouri on-farm sensor demos report that canopy-guided sidedressing saved an average of 24 lb N/acre while breaking even on yield across 41 fields (<Src href="https://extension.missouri.edu/media/wysiwyg/Extensiondata/Pro/NutrientManagement/Docs/Crop_Sensors_to_Guide_N_Application_to_Reduce_N_Loss.pdf">Scharf et al., MU</Src>). Those results used ground sensors and MU&apos;s own algorithm, not NitroZone.
              </p>
            </section>

            <section>
              <H2 id="scores">Health score &amp; data confidence</H2>
              <F>{`field health score = 100 × area-weighted mean of min(SI, 1)`}</F>
              <p>
                100 means the whole field looks as vigorous as the reference. It measures uniformity of crop vigor, not nitrogen. <strong>Data confidence</strong> is a simple checklist: real vs synthetic imagery, the share of the field that was cloud-free, how many cells were gap-filled, whether the canopy is established (mean NDVI ≥ 0.4), and how old a live image is. Each reason is listed in the app.
              </p>
            </section>

            <section>
              <H2 id="drone">Drone images</H2>
              <F>{`VARI = (G − R) / (G + R − B)
ExG  = 2g − r − b     where r = R/(R+G+B), g = G/(R+G+B), b = B/(R+G+B)`}</F>
              <p>RGB cameras have no near-infrared or red-edge band, so VARI and Excess Green measure greenness rather than chlorophyll. They are useful for spotting variability, but less specific to nitrogen than satellite NDRE. GeoTIFF orthomosaics are placed using their coordinates; plain photos are stretched over the field&apos;s bounding box with a warning.</p>
            </section>

            <section>
              <H2 id="limitations">Limitations</H2>
              <div className="mt-4 rounded-2xl border border-harvest-200 bg-harvest-50 p-5 text-harvest-700">
                <div className="flex items-center gap-2 font-semibold">
                  <TriangleAlert className="size-4" /> Please read before applying fertilizer
                </div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.98rem]">
                  <li>Vegetation indices are a <strong>stress proxy</strong>. Low vigor can come from water stress, compaction, disease, insects, herbicide injury or poor stand, where extra N won&apos;t help. Scout low zones first.</li>
                  <li>10 m pixels can&apos;t see problems smaller than a few metres, and edge pixels mix crop with field borders.</li>
                  <li>Cloud masks are imperfect; thin haze can slip through.</li>
                  <li>Default rates and adjustments are starting points, not University of Missouri recommendations. Follow MU Extension guidance and your agronomist.</li>
                  <li>Savings are fertilizer-cost estimates only. Yield response is not modeled.</li>
                  <li>Check exported rates and units against your controller before applying.</li>
                </ul>
              </div>
            </section>

            <section>
              <H2 id="sources">Sources</H2>
              <ul className="mt-4 space-y-2.5 text-[0.95rem]">
                <li><Src href="https://www.nass.usda.gov/Statistics_by_State/Missouri/Publications/Press_Releases/2025/20250331-MO-Prospective-Plantings.pdf">USDA NASS, Missouri Prospective Plantings (March 31, 2025)</Src>: 3.80 million acres of corn intended for 2025.</li>
                <li><Src href="https://water.usgs.gov/nawqa/sparrow/gulf_findings/primary_sources.html">USGS SPARROW, sources of nutrients to the Gulf</Src>: 66% of nitrogen from cultivated crops, mostly corn and soybean.</li>
                <li><Src href="https://extension.missouri.edu/media/wysiwyg/Extensiondata/Pro/NutrientManagement/Docs/Crop_Sensors_to_Guide_N_Application_to_Reduce_N_Loss.pdf">Scharf et al., University of Missouri, Crop Sensors to Guide Nitrogen Fertilizer Application</Src>: 2004–2007, 41-field average +$15/ac, broke even on yield, saved 24 lb N/ac.</li>
                <li><Src href="https://www.agronext.iastate.edu/soilfertility/info/inseasonnstress.pdf">Iowa State University, In-Season Sensing for Nitrogen Stress in Corn</Src>: reference strips, sensing timing.</li>
                <li><Src href="https://www.dtnpf.com/agriculture/web/ag/crops/article/2026/10/07/uan32-leads-fertilizer-prices-higher">DTN Retail Fertilizer Trends (Oct 7, 2026)</Src>: UAN32 $0.75/lb N.</li>
                <li><Src href="https://custom-scripts.sentinel-hub.com/sentinel-2/scene-classification">Sentinel-2 L2A Scene Classification classes</Src>.</li>
                <li><Src href="https://nassgeodata.gmu.edu/CropScape/">USDA NASS Cropland Data Layer (CropScape)</Src>: demo field classified 93% corn in 2025 and 89% soybeans in 2024 (our calculation).</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">The full list, including how each number was checked, is in SOURCES.md in the repository.</p>
            </section>

            <div className="flex flex-wrap gap-3 border-t pt-10">
              <Button asChild size="xl" className="rounded-xl">
                <Link href="/app">
                  Try it on the demo field <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="rounded-xl">
                <a href="https://github.com/VarunKurra/NitroZone" target="_blank" rel="noreferrer">
                  Read the source
                </a>
              </Button>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </PageTransition>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CloudOff,
  Download,
  Drone,
  FileStack,
  Layers3,
  MousePointer2,
  PenLine,
  Satellite,
  ScanSearch,
  ShieldCheck,
  Sprout,
  Tractor,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/common/number-ticker";
import { HeroVisual } from "./hero-visual";
import { ZONE_PALETTE_5 } from "@/lib/palette";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, lead, center }: { eyebrow: string; title: React.ReactNode; lead?: React.ReactNode; center?: boolean }) {
  return (
    <Reveal className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[2.1rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]">{title}</h2>
      {lead && <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">{lead}</p>}
    </Reveal>
  );
}

// ------------------------------------------------------------------ hero
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_80%_0%,rgba(195,223,202,0.55),transparent_60%),radial-gradient(50%_40%_at_0%_10%,rgba(251,233,196,0.55),transparent_60%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dots [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-60" aria-hidden />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.12fr_1fr] lg:gap-12 lg:pb-28 lg:pt-16">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <Link href="/science" className="group inline-flex items-center gap-2 rounded-full border border-field-200 bg-white/80 py-1 pl-1 pr-3 text-[0.8rem] font-medium text-field-800 shadow-sm backdrop-blur transition hover:border-field-300">
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-semibold text-white">New</span>
              Red-edge zones for in-season sidedress
              <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease }}
            className="mt-6 font-display text-[2.7rem] font-bold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[3.5rem] xl:text-[3.85rem]"
          >
            Nitrogen only where your corn <span className="relative whitespace-nowrap text-primary">needs it.<Underline /></span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.16, ease }} className="mt-6 max-w-xl text-[1.12rem] leading-relaxed text-muted-foreground">
            NitroZone turns free Sentinel-2 satellite imagery into a variable-rate sidedress prescription for Missouri corn. Draw your field, review the zones, and load the shapefile straight into your controller.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.24, ease }} className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl" className="rounded-xl px-6 text-base">
              <Link href="/app?demo=1" data-testid="hero-demo">
                Try it on a real Missouri field <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="rounded-xl bg-white/70 px-6 text-base backdrop-blur">
              <Link href="/app">
                <PenLine /> Draw your own field
              </Link>
            </Button>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Free, open satellite data", "No account needed", "Shapefile for your controller"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> {t}
              </li>
            ))}
          </motion.ul>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function Underline() {
  return (
    <svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full text-harvest-400" preserveAspectRatio="none" aria-hidden>
      <motion.path d="M3 14 C 70 4, 160 2, 297 10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.7, ease }} />
    </svg>
  );
}

// ------------------------------------------------------------ data sources
export function SourcesStrip() {
  const items = [
    { name: "Copernicus Sentinel-2", sub: "ESA · 10 m multispectral" },
    { name: "Microsoft Planetary Computer", sub: "Open imagery catalog" },
    { name: "USDA NASS Cropland Data Layer", sub: "Crop-type verification" },
    { name: "OpenStreetMap", sub: "Address search" },
    { name: "University of Missouri research", sub: "Sensor-guided N studies" },
  ];
  return (
    <section aria-label="Built on open data" className="border-y bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:gap-10">
        <p className="shrink-0 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Built on open data</p>
        <ul className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((i) => (
            <li key={i.name}>
              <div className="text-[0.92rem] font-semibold leading-tight text-foreground/85">{i.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{i.sub}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- problem
export function Problem() {
  const stats = [
    {
      value: 3.8,
      decimals: 1,
      suffix: "M",
      label: "acres of corn Missouri farmers intended to plant in 2025",
      source: "USDA NASS, Missouri Prospective Plantings (Mar 2025)",
      href: "https://www.nass.usda.gov/Statistics_by_State/Missouri/Publications/Press_Releases/2025/20250331-MO-Prospective-Plantings.pdf",
    },
    {
      value: 66,
      decimals: 0,
      suffix: "%",
      label: "of the nitrogen reaching the Gulf of Mexico from the Mississippi basin comes from cultivated crops, mostly corn and soybeans",
      source: "USGS SPARROW, Gulf hypoxia findings",
      href: "https://water.usgs.gov/nawqa/sparrow/gulf_findings/primary_sources.html",
    },
    {
      value: 24,
      decimals: 0,
      suffix: " lb",
      label: "of N per acre saved on average in University of Missouri sensor-guided sidedress demos (41 fields, 2004–2007), while breaking even on yield",
      source: "Scharf et al., University of Missouri",
      href: "https://extension.missouri.edu/media/wysiwyg/Extensiondata/Pro/NutrientManagement/Docs/Crop_Sensors_to_Guide_N_Application_to_Reduce_N_Loss.pdf",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32" aria-labelledby="problem-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div>
          <SectionHead
            eyebrow="The problem"
            title={<span id="problem-title">Every field is uneven. Flat-rate nitrogen isn&apos;t.</span>}
            lead="Most corn gets one nitrogen rate from fence to fence. Strong parts of the field get more than they can use, and the extra can wash into creeks, the Missouri and the Mississippi. Weak spots may not get enough."
          />
          <Reveal delay={0.1}>
            <RunoffIllustration />
          </Reveal>
        </div>
        <ul className="space-y-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={0.08 * i}>
              <li className="group rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-card)] sm:p-7">
                <div className="font-display text-[3.2rem] font-bold leading-none tracking-[-0.04em] text-field-800">
                  <NumberTicker value={s.value} decimals={s.decimals} suffix={s.suffix} />
                </div>
                <p className="mt-3 text-[1.02rem] leading-relaxed text-foreground/85">{s.label}</p>
                <a href={s.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline">
                  Source: {s.source} <ArrowUpRight className="size-3" />
                </a>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Custom illustration: a field with flat-rate N, excess draining toward a river. */
function RunoffIllustration() {
  return (
    <svg viewBox="0 0 520 250" className="mt-10 w-full" role="img" aria-label="Illustration: flat-rate nitrogen leaves extra nitrogen that drains from the field toward a river">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f3f7f1" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <pattern id="rows" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <rect width="10" height="10" fill="#d9e8c7" />
          <rect width="4" height="10" fill="#9fc98a" />
        </pattern>
      </defs>
      <rect width="520" height="250" rx="24" fill="url(#sky)" />
      {/* field */}
      <path d="M30 150 L330 110 L360 200 L40 230 Z" fill="url(#rows)" stroke="#5ea676" strokeWidth="1.5" />
      {/* weak / strong patches */}
      <ellipse cx="120" cy="190" rx="45" ry="16" fill="#d6631c" opacity="0.28" />
      <ellipse cx="260" cy="150" rx="55" ry="18" fill="#0072a3" opacity="0.22" />
      {/* flat-rate droplets (same everywhere) */}
      {Array.from({ length: 9 }).map((_, i) => (
        <motion.circle key={i} cx={60 + i * 33} cy={135 - i * 3} r="4" fill="#e59a1e" initial={{ y: -30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease }} />
      ))}
      {/* runoff path */}
      <motion.path d="M300 190 C 360 210, 380 230, 430 222 S 500 205, 515 210" fill="none" stroke="#1689bd" strokeWidth="3" strokeDasharray="6 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 1, duration: 1.6 }} />
      {/* river */}
      <path d="M420 250 C 440 200, 470 170, 520 150 L520 250 Z" fill="#1689bd" opacity="0.18" />
      <path d="M420 250 C 440 200, 470 170, 520 150" fill="none" stroke="#1689bd" strokeWidth="2" opacity="0.5" />
      <text x="40" y="40" fontSize="13" fontWeight="600" fill="#14201a">
        One rate, everywhere
      </text>
      <text x="40" y="58" fontSize="11.5" fill="#5b635d">
        Extra N where the crop can&apos;t use it
      </text>
      <text x="400" y="140" fontSize="11.5" fontWeight="600" fill="#0a5677">
        to the river
      </text>
    </svg>
  );
}

// ------------------------------------------------------------ how it works
export function HowItWorks() {
  const steps = [
    { icon: MousePointer2, title: "Find & draw your field", text: "Search your farm and click the corners on the satellite map, or import a boundary shapefile.", visual: <StepDraw /> },
    { icon: Satellite, title: "Analyze the canopy", text: "NitroZone reads Sentinel-2 red-edge (NDRE) and NDVI, masking clouds and shadows, right in your browser.", visual: <StepScan /> },
    { icon: Layers3, title: "Review the zones", text: "k-means groups the field into zones you can actually drive. Repaint any zone you know better than the satellite.", visual: <StepZones /> },
    { icon: Tractor, title: "Load the controller", text: "Download a shapefile with RATE_LBAC per zone, plus a PDF report, KML, GeoJSON and CSV.", visual: <StepExport /> },
  ];
  return (
    <section id="how" className="scroll-mt-20 bg-field-950 py-24 text-white lg:py-32" aria-labelledby="how-title">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-field-300">How it works</p>
          <h2 id="how-title" className="mt-3 font-display text-[2.1rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]">
            From satellite to spreader in four steps.
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-white/65">No GIS degree, no account, no expensive sensors. About a minute from drawing a field to downloading a prescription.</p>
        </Reveal>
        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={0.08 * i}>
              <li className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:border-white/20 hover:bg-white/[0.06]">
                <div className="relative h-44 overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_50%_0%,#1b4a33,#0b1f15)]">{s.visual}</div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-sm font-bold tabular">{i + 1}</span>
                    <s.icon className="size-4 text-field-300" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[0.92rem] leading-relaxed text-white/65">{s.text}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepDraw() {
  const pts = "40,120 70,40 200,30 230,110 150,150";
  return (
    <svg viewBox="0 0 270 176" className="h-full w-full" aria-hidden>
      <rect width="270" height="176" fill="url(#none)" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={i * 45} y1="0" x2={i * 45 - 30} y2="176" stroke="white" strokeOpacity="0.05" />
      ))}
      <motion.polygon points={pts} fill="rgba(255,255,255,0.08)" stroke="white" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease }} />
      {pts.split(" ").map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <motion.circle key={i} cx={x} cy={y} r="5" fill="#15653d" stroke="white" strokeWidth="2" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 * i, type: "spring" }} />;
      })}
    </svg>
  );
}

function StepScan() {
  return (
    <svg viewBox="0 0 270 176" className="h-full w-full" aria-hidden>
      {Array.from({ length: 12 }).map((_, r) =>
        Array.from({ length: 18 }).map((_, c) => {
          const v = 0.5 + 0.5 * Math.sin(c / 3 + r / 4) * Math.cos(r / 5 - c / 7);
          return <rect key={`${r}-${c}`} x={c * 15} y={r * 15} width="14" height="14" fill={`rgba(${Math.round(60 + 100 * (1 - v))},${Math.round(140 + 80 * v)},${Math.round(110 + 40 * v)},${(0.25 + 0.5 * v).toFixed(3)})`} />;
        }),
      )}
      <motion.rect x="0" width="270" height="6" fill="#c3dfca" initial={{ y: 0, opacity: 0.9 }} animate={{ y: [0, 170, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ filter: "drop-shadow(0 0 10px #95c6a2)" }} />
      <g transform="translate(210,22)">
        <rect x="-6" y="-6" width="52" height="24" rx="6" fill="#0f2a1d" stroke="white" strokeOpacity="0.2" />
        <text x="20" y="10" textAnchor="middle" fontSize="10" fontWeight="600" fill="white">NDRE</text>
      </g>
    </svg>
  );
}

function StepZones() {
  const cols = ZONE_PALETTE_5;
  return (
    <svg viewBox="0 0 270 176" className="h-full w-full" aria-hidden>
      {Array.from({ length: 9 }).map((_, r) =>
        Array.from({ length: 14 }).map((_, c) => {
          const v = Math.sin(c / 2.6 + 1) + Math.cos(r / 2.2) + (c > 9 ? 0.8 : 0);
          const z = Math.max(0, Math.min(4, Math.round(v + 1.6)));
          return (
            <motion.rect key={`${r}-${c}`} x={22 + c * 16.5} y={14 + r * 16.5} width="15.5" height="15.5" rx="2" fill={cols[z]} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 0.9, scale: 1 }} viewport={{ once: true }} transition={{ delay: (r + c) * 0.025, duration: 0.4 }} />
          );
        }),
      )}
    </svg>
  );
}

function StepExport() {
  const files = ["nitrozone_rx.shp", "field_report.pdf", "prescription.kml", "zone_summary.csv"];
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-6" aria-hidden>
      {files.map((f, i) => (
        <motion.div key={f} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * i, duration: 0.5, ease }} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/85">
          <FileStack className="size-3.5 text-field-300" /> {f}
          {i === 0 && <span className="ml-auto rounded bg-harvest-400 px-1.5 py-0.5 text-[0.6rem] font-bold text-field-950">CONTROLLER</span>}
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- features
export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32" aria-labelledby="features-title">
      <SectionHead eyebrow="Features" title={<span id="features-title">Built like real agronomy software, because it is.</span>} lead="Everything a sidedress prescription needs, with the math out in the open." />
      <div className="mt-14 grid auto-rows-[minmax(200px,auto)] gap-4 md:grid-cols-6">
        <Bento className="md:col-span-4" icon={ScanSearch} title="Red-edge NDRE, not just NDVI" text="NDVI flattens out once corn canopies close. NDRE uses Sentinel-2's 705 nm red-edge band, which keeps responding to leaf chlorophyll, so it still separates strong and weak corn mid-season.">
          <IndexBars />
        </Bento>
        <Bento className="md:col-span-2" icon={CloudOff} title="Clouds masked, honestly" text="Pixels flagged as cloud, shadow or cirrus in Sentinel-2's scene classification are dropped. Gaps are filled from neighbours and labeled “estimated”.">
          <CloudMask />
        </Bento>
        <Bento className="md:col-span-2" icon={Tractor} title="Zones a spreader can follow" text="k-means zoning, a majority filter and merging of small islands give clean zones on a grid sized to your boom." />
        <Bento className="md:col-span-2" icon={Sprout} title="N-rich strip support" text="Draw your high-N reference strip and every zone gets a sufficiency index against it." />
        <Bento className="md:col-span-2" icon={Download} title="Controller-ready exports" text="Shapefile (RATE_LBAC, ZONE, AREA_AC, WGS84), plus GeoJSON, KML, CSV and a one-page PDF report." />
        <Bento className="md:col-span-3" icon={Bot} title="Plain-English field insights" text="An optional AI summary explains the numbers on screen and why each zone gets its rate. It can only use NitroZone's computed values, and rule-based insights take over if AI is unavailable." />
        <Bento className="md:col-span-3" icon={WifiOff} title="Works anywhere" text="Live imagery when you're online, a bundled real scene for the demo field when you're not, and a clearly-labeled synthetic fallback so the workflow never dead-ends.">
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
            {["Live Sentinel-2", "Bundled scene", "Synthetic (labeled)"].map((t, i) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1">
                <span className={cn("size-1.5 rounded-full", i === 0 ? "bg-field-500" : i === 1 ? "bg-river-500" : "bg-harvest-400")} /> {t}
                {i < 2 && <ArrowRight className="size-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </Bento>
        <Bento className="md:col-span-6" icon={Drone} title="Have a drone? Use it." text="Upload an RGB orthomosaic (GeoTIFF) or photo and NitroZone builds zones from VARI and Excess Green instead. They're greenness indices, so the app tells you they're less nitrogen-specific than red-edge." horizontal />
      </div>
    </section>
  );
}

function Bento({ icon: Icon, title, text, children, className, horizontal }: { icon: React.ElementType; title: string; text: string; children?: React.ReactNode; className?: string; horizontal?: boolean }) {
  return (
    <Reveal className={cn("h-full", className)}>
      <div className={cn("group relative h-full overflow-hidden rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] sm:p-7", horizontal && "sm:flex sm:items-start sm:gap-6")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-field-50 text-field-700 ring-1 ring-field-100 transition group-hover:bg-primary group-hover:text-white">
          <Icon className="size-5" />
        </span>
        <div className={horizontal ? "mt-5 sm:mt-0" : ""}>
          <h3 className={cn("font-display text-[1.15rem] font-semibold tracking-[-0.01em]", !horizontal && "mt-5")}>{title}</h3>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">{text}</p>
          {children}
        </div>
      </div>
    </Reveal>
  );
}

/** Small schematic: a pixel grid where a cloud patch is masked out (hatched). */
function CloudMask() {
  return (
    <svg viewBox="0 0 220 64" className="mt-5 w-full max-w-[260px]" aria-hidden>
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="#f3f4ef" />
          <rect width="1.6" height="5" fill="#c9cdc3" />
        </pattern>
      </defs>
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 14 }).map((_, c) => {
          const cloud = (c - 8.5) ** 2 / 9 + (r - 1.2) ** 2 / 2.2 < 1;
          const v = 0.55 + 0.4 * Math.sin(c / 2.5 + r);
          return <rect key={`${r}-${c}`} x={c * 15.5} y={r * 15.5} width="14" height="14" rx="2.5" fill={cloud ? "url(#hatch)" : `rgba(21,101,61,${v.toFixed(2)})`} />;
        }),
      )}
    </svg>
  );
}

/** Schematic (labeled as such): NDVI saturates in dense canopy, NDRE keeps separating. */
function IndexBars() {
  const rows = [
    { name: "NDVI", vals: [0.84, 0.87, 0.88, 0.89], color: "#8a918b" },
    { name: "NDRE", vals: [0.48, 0.56, 0.63, 0.7], color: "#15653d" },
  ];
  return (
    <div className="mt-6 grid gap-3 sm:max-w-md" aria-label="Schematic: NDVI values bunch together in dense canopy while NDRE values stay spread out">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className="w-12 text-xs font-semibold text-muted-foreground">{r.name}</span>
          <div className="relative h-7 flex-1 rounded-lg bg-muted">
            {r.vals.map((v, i) => (
              <motion.span key={i} className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ background: r.name === "NDRE" ? ZONE_PALETTE_5[i + 1] : r.color }} initial={{ left: "50%", opacity: 0 }} whileInView={{ left: `${((v - 0.4) / 0.55) * 100}%`, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.1 * i, ease }} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-[0.7rem] text-muted-foreground">Schematic illustration of four canopy patches. See the live NDVI vs NDRE chart in the app for your field&apos;s actual data.</p>
    </div>
  );
}

// ---------------------------------------------------------------- science
export function Science() {
  return (
    <section className="border-y bg-soil-50" aria-labelledby="science-title">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-32">
        <div>
          <SectionHead eyebrow="Honest agronomy" title={<span id="science-title">Show the math. Admit the limits.</span>} lead="A prescription is only useful if you can trust it. NitroZone shows every formula with your numbers plugged in, and is upfront about what satellite data can and can't tell you." />
          <Reveal delay={0.1}>
            <Button asChild variant="outline" size="lg" className="mt-8 rounded-xl bg-white">
              <Link href="/science">
                Read the methodology <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
        <div className="space-y-4">
          <Reveal>
            <div className="rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)] sm:p-7">
              <h3 className="font-display text-lg font-semibold">The formulas</h3>
              <dl className="mt-4 space-y-3 font-mono text-[0.85rem]">
                {[
                  ["NDRE", "(B8 − B5) / (B8 + B5)"],
                  ["Zone rate", "base × (1 + adjustment)"],
                  ["Savings", "(flat lb − plan lb) × $/lb N"],
                  ["SI", "zone NDRE ÷ reference NDRE"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 rounded-xl bg-muted/70 px-4 py-2.5">
                    <dt className="font-sans text-sm font-semibold">{k}</dt>
                    <dd className="text-right tabular">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)]">
                <h3 className="font-semibold text-field-800">What it is</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>An in-season sidedress planner for corn (about V6–V12)</li>
                  <li>A map of relative crop vigor, from red-edge imagery</li>
                  <li>A starting prescription you review and edit</li>
                </ul>
              </div>
              <div className="rounded-3xl border bg-white p-6 shadow-[var(--shadow-soft)]">
                <h3 className="font-semibold text-harvest-700">What it isn&apos;t</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>A direct nitrogen measurement (it&apos;s a stress proxy)</li>
                  <li>For soybeans, which fix their own N</li>
                  <li>A replacement for scouting or your agronomist</li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------- FAQ
export function Faq() {
  const qs = [
    ["Is NitroZone free?", "Yes. It uses free, open Sentinel-2 imagery from the European Space Agency's Copernicus program, served by Microsoft Planetary Computer, and runs in your browser. No account is required."],
    ["When in the season should I use it?", "For in-season sidedress, once the corn canopy is established, roughly V6 to V12. Earlier, bare soil between rows dominates the signal. Iowa State guidance for canopy sensing suggests sensing from about V10 and finishing before tasseling."],
    ["Does it measure nitrogen directly?", "No. NDRE and NDVI measure how green and vigorous the canopy is. Nitrogen shortage is a common cause of low vigor, but so are water stress, compaction, disease and poor stand. That's why you review and can repaint the zones before exporting."],
    ["Will my controller read the file?", "The shapefile is a standard polygon shapefile in WGS84 (EPSG:4326) with RATE_LBAC (lb N per acre), ZONE and AREA_AC attributes. Shapefile prescriptions are a common import format for rate controllers and farm software, but every display has its own rules for file naming and rate units, so check yours before heading to the field."],
    ["How are the savings calculated?", "Savings = (flat-rate pounds − variable-rate pounds) × your nitrogen price. It's an estimate of fertilizer cost only, not yield or profit. If your plan uses more N than the flat rate, NitroZone warns you."],
    ["What happens to my data?", "Imagery math runs in your browser. Saved fields are tied to a random ID stored on your device (no login), and AI insights only receive summary numbers, never imagery or your location history."],
  ];
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32" aria-labelledby="faq-title">
      <SectionHead center eyebrow="FAQ" title={<span id="faq-title">Questions farmers ask</span>} />
      <Reveal delay={0.1}>
        <Accordion type="single" collapsible className="mt-12 rounded-3xl border bg-white px-6 shadow-[var(--shadow-soft)] sm:px-8">
          {qs.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="py-5 text-left text-[1.02rem] font-semibold hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[0.98rem] leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

// -------------------------------------------------------------------- CTA
export function FinalCta() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-field-900 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(47,174,138,0.35),transparent_70%)]" aria-hidden />
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.08] invert" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-[2.2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[3rem]">Run your first prescription in about a minute.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Start with the real Audrain County demo field, or draw your own.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="xl" variant="accent" className="rounded-xl px-6 text-base">
                <Link href="/app?demo=1">
                  Try the demo field <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="inverse" className="rounded-xl px-6 text-base">
                <Link href="/app">Draw my field</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

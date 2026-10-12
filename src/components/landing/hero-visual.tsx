"use client";

/**
 * Hero product visual. Not a mock-up: the zones are the real NitroZone prescription for the
 * demo field (src/data/hero.json, generated from the cached Sentinel-2 scene by
 * `npm run gen:hero`), drawn over that scene's true-colour image.
 */
import { motion } from "motion/react";
import { Leaf, Satellite, TrendingDown } from "lucide-react";
import hero from "@/data/hero.json";
import { zoneColor } from "@/lib/palette";

type HeroData = {
  width: number;
  height: number;
  sceneDate: string;
  zoneCount: number;
  outline: number[][];
  cells: { p: number[][]; z: number; v: number }[];
  stats: { areaAc: number; health: number; savedUsd: number; savedLbN: number; reductionPct: number; zones: { zone: number; areaAc: number; rate: number }[] };
};
const H = hero as HeroData;

const path = (pts: number[][]) => `M${pts.map((p) => `${p[0]},${p[1]}`).join("L")}Z`;

export function HeroVisual() {
  const fmtDate = new Date(H.sceneDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
      {/* glow */}
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(60%_50%_at_50%_40%,rgba(47,174,138,0.22),transparent_70%)] blur-2xl" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-field-950 shadow-[0_40px_80px_-24px_rgba(8,23,15,0.55)] ring-1 ring-black/5"
        style={{ transformPerspective: 1200 }}
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="ml-3 truncate rounded-md bg-white/10 px-2.5 py-1 text-[0.7rem] font-medium text-white/70">Audrain County, MO · {H.stats.areaAc} ac</span>
          <span className="ml-auto flex items-center gap-1.5 text-[0.7rem] text-white/60">
            <Satellite className="size-3.5" /> Sentinel-2 · {fmtDate}
          </span>
        </div>
        <div className="relative grid place-items-center bg-[radial-gradient(circle_at_50%_30%,#163426,#08170f)] px-6 py-7">
          <div className="absolute inset-0 bg-grid opacity-[0.07] invert" aria-hidden />
          <svg viewBox={`0 0 ${H.width} ${H.height}`} className="relative h-[clamp(340px,52vh,520px)] w-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)]" role="img" aria-label={`Zone map of the demo field: ${H.zoneCount} management zones computed from Sentinel-2 NDRE`}>
            <defs>
              <clipPath id="hero-field">
                <path d={path(H.outline)} />
              </clipPath>
              <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#c3dfca" stopOpacity="0" />
                <stop offset="0.85" stopColor="#c3dfca" stopOpacity="0.35" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <image href="/demo/hero-tci.png" width={H.width} height={H.height} preserveAspectRatio="none" style={{ imageRendering: "auto" }} opacity={0.95} />
            <g clipPath="url(#hero-field)">
              {H.cells.map((c, i) => {
                const row = c.p[0][1] / H.height;
                const col = c.p[0][0] / H.width;
                return (
                  <path
                    key={i}
                    d={path(c.p)}
                    fill={zoneColor(c.z, H.zoneCount)}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={0.12}
                    className="hero-cell"
                    style={{ animationDelay: `${(0.9 + row * 1.6 + col * 0.25).toFixed(2)}s` }}
                  />
                );
              })}
            </g>
            {(
              <motion.rect
                x={0}
                width={H.width}
                height={18}
                fill="url(#scan)"
                clipPath="url(#hero-field)"
                initial={{ y: -18 }}
                animate={{ y: H.height + 4 }}
                transition={{ duration: 2.1, delay: 0.75, ease: [0.45, 0, 0.55, 1] }}
              />
            )}
            <path d={path(H.outline)} fill="none" stroke="white" strokeWidth={0.55} strokeLinejoin="round" />
          </svg>
        </div>
      </motion.div>

      {/* floating stat cards */}
      <FloatCard className="-left-4 top-24 xl:-left-10" delay={2.4}>
        <div className="flex items-center gap-3">
          <div className="relative grid size-11 place-items-center">
            <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#eef0ea" strokeWidth="5" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#2fae8a" strokeWidth="5" strokeLinecap="round" strokeDasharray={113} strokeDashoffset={113 * (1 - H.stats.health / 100)} />
            </svg>
            <span className="text-sm font-bold tabular">{H.stats.health}</span>
          </div>
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">Field health</div>
            <div className="text-sm font-semibold">Good · score {H.stats.health}/100</div>
          </div>
        </div>
      </FloatCard>
      <FloatCard className="right-2 top-40 xl:-right-8" delay={2.7}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-field-50 text-field-700">
            <TrendingDown className="size-5" />
          </span>
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">Est. N savings</div>
            <div className="font-display text-xl font-bold text-field-700 tabular">${H.stats.savedUsd.toLocaleString()}</div>
            <div className="text-[0.7rem] text-muted-foreground tabular">{H.stats.reductionPct}% less N than flat</div>
          </div>
        </div>
      </FloatCard>
      <FloatCard className="-left-2 bottom-10 xl:-left-12" delay={3}>
        <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
          <Leaf className="size-3.5 text-primary" /> Zone rates
        </div>
        <ul className="mt-2 space-y-1">
          {H.stats.zones.map((z) => (
            <li key={z.zone} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 rounded-[3px]" style={{ background: zoneColor(z.zone, H.zoneCount) }} />
              <span className="font-semibold">Z{z.zone}</span>
              <span className="ml-auto pl-6 font-semibold tabular">{z.rate}</span>
              <span className="text-muted-foreground">lb/ac</span>
            </li>
          ))}
        </ul>
      </FloatCard>
    </div>
  );
}

function FloatCard({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: delay, ease: [0.16, 1, 0.3, 1] }}
      className={`absolute z-10 hidden rounded-2xl bg-white/95 p-3.5 shadow-[var(--shadow-float)] ring-1 ring-black/5 backdrop-blur sm:block ${className}`}
    >
      <div className="animate-float" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </motion.div>
  );
}

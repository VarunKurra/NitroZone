"use client";

/**
 * Hero visual, told as a three-part story:
 *   1. a farmer checking a field (every field has weaker and stronger spots)
 *   2. NitroZone's real zone map for the demo field sweeping in over the satellite image
 *   3. a farmer in a thriving field
 * The map uses the real prescription computed for the demo field (src/data/hero.json).
 * For performance the 2,000+ grid cells are merged into one SVG path per zone, and the
 * sweep is a single animated clip rectangle.
 */
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import hero from "@/data/hero.json";
import { zoneColor } from "@/lib/palette";
import { cn } from "@/lib/utils";

type HeroData = { width: number; height: number; zoneCount: number; outline: number[][]; cells: { p: number[][]; z: number }[] };
const H = hero as unknown as HeroData;

const STAGES = [
  { label: "Some spots struggle. Some thrive.", hold: 3500 },
  { label: "NitroZone maps what each spot needs", hold: 6500 },
  { label: "Healthy crops, less waste", hold: 4500 },
];

const ring = (pts: number[][]) => `M${pts.map((p) => `${p[0]},${p[1]}`).join("L")}Z`;

export function HeroStory() {
  const [stage, setStage] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One path string per zone (much cheaper to draw than one element per cell).
  const zonePaths = useMemo(() => {
    const byZone = new Map<number, string[]>();
    for (const c of H.cells) {
      if (!byZone.has(c.z)) byZone.set(c.z, []);
      byZone.get(c.z)!.push(ring(c.p));
    }
    return [...byZone.entries()].map(([z, parts]) => ({ z, d: parts.join("") }));
  }, []);

  // Loops forever: farmer -> map -> thriving field -> farmer ...
  useEffect(() => {
    timer.current = setTimeout(() => setStage((s) => (s + 1) % STAGES.length), STAGES[stage].hold);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [stage]);

  const go = (i: number) => setStage(i);

  return (
    <div className="relative mx-auto w-fit max-w-full">
      <div className="relative aspect-[4/5] h-[min(68vh,580px)] max-w-full overflow-hidden rounded-[2rem] bg-field-950 shadow-[0_30px_60px_-20px_rgba(20,32,26,0.35)] ring-1 ring-black/5">
        {/* 1. farmer checking the field */}
        <Image
          src="/images/farmer-checking-field.jpg"
          alt="A farmer kneeling to look closely at his crop"
          fill
          priority
          sizes="(max-width: 1024px) 90vw, 520px"
          className={cn("object-cover transition-opacity duration-1000", stage === 0 ? "opacity-100" : "opacity-0")}
        />

        {/* 2. the NitroZone map */}
        <div className={cn("absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,#1d4330,#0b1d14)] transition-opacity duration-1000", stage === 1 ? "opacity-100" : "opacity-0")} aria-hidden={stage !== 1}>
          <svg viewBox={`0 0 ${H.width} ${H.height}`} className="h-[86%] w-auto" role="img" aria-label="NitroZone zone map of a real Missouri field: colors show which parts need more or less fertilizer">
            <defs>
              <clipPath id="hs-field">
                <path d={ring(H.outline)} />
              </clipPath>
              <clipPath id="hs-sweep">
                <rect x="0" y="0" width={H.width} height={H.height} className={cn("origin-top transition-transform ease-out", stage === 1 ? "scale-y-100 duration-[2600ms] delay-500" : "scale-y-0 duration-0")} style={{ transformBox: "fill-box" }} />
              </clipPath>
            </defs>
            <image href="/demo/hero-tci.png" width={H.width} height={H.height} preserveAspectRatio="none" />
            <g clipPath="url(#hs-field)">
              <g clipPath="url(#hs-sweep)" opacity={0.85}>
                {zonePaths.map(({ z, d }) => (
                  <path key={z} d={d} fill={zoneColor(z, H.zoneCount)} />
                ))}
              </g>
            </g>
            <path d={ring(H.outline)} fill="none" stroke="white" strokeWidth={0.6} strokeLinejoin="round" />
          </svg>
        </div>

        {/* 3. thriving field */}
        <Image
          src="/images/farmer-thriving-corn.jpg"
          alt="A farmer walking through a tall, healthy corn field"
          fill
          sizes="(max-width: 1024px) 90vw, 520px"
          className={cn("object-cover transition-opacity duration-1000", stage === 2 ? "opacity-100" : "opacity-0")}
        />

        {/* caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-5 pb-5 pt-16">
          <p key={stage} className="animate-in fade-in slide-in-from-bottom-1 text-[1.02rem] font-semibold leading-snug text-white duration-700" aria-live="polite">
            {STAGES[stage].label}
          </p>
        </div>
      </div>

      {/* step dots */}
      <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Story">
        {STAGES.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={stage === i}
            aria-label={s.label}
            onClick={() => go(i)}
            className={cn("h-1.5 rounded-full transition-all duration-500", stage === i ? "w-8 bg-primary" : "w-3 bg-foreground/20 hover:bg-foreground/35")}
          />
        ))}
      </div>
    </div>
  );
}

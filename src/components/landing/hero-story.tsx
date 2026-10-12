"use client";

/**
 * Hero visual, told as a three-part story:
 *   1. a farmer checking a field (every field has weaker and stronger spots)
 *   2. NitroZone's real zone map for the demo field sweeping in over the satellite image
 *   3. a farmer in a thriving field
 * The map uses the real prescription computed for the demo field (src/data/hero.json).
 * The 2,000+ grid cells are drawn on a canvas and pop in square by square, row by row from
 * the top, behind a soft scan line (one canvas instead of thousands of animated elements).
 */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
          <div className="relative h-[86%]" style={{ aspectRatio: `${H.width} / ${H.height}` }} role="img" aria-label="NitroZone zone map of a real Missouri field: colors show which parts need more or less fertilizer">
            <svg viewBox={`0 0 ${H.width} ${H.height}`} className="absolute inset-0 h-full w-full" aria-hidden>
              <image href="/demo/hero-tci.png" width={H.width} height={H.height} preserveAspectRatio="none" />
            </svg>
            <ZoneFill active={stage === 1} />
            <svg viewBox={`0 0 ${H.width} ${H.height}`} className="absolute inset-0 h-full w-full" aria-hidden>
              <path d={ring(H.outline)} fill="none" stroke="white" strokeWidth={0.6} strokeLinejoin="round" />
            </svg>
          </div>
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

/* ---------- slide 2: zone squares popping in, top to bottom ---------- */

const FILL_DELAY = 500; // ms before the first square
const FILL_SWEEP = 2600; // ms for the scan to reach the bottom row
const POP = 420; // ms for one square to pop in

// Precomputed once: per cell its centre and its start time.
const CELLS = H.cells.map((c, i) => {
  let cx = 0;
  let cy = 0;
  const n = c.p.length - 1;
  for (let k = 0; k < n; k++) {
    cx += c.p[k][0];
    cy += c.p[k][1];
  }
  cx /= n;
  cy /= n;
  const jitter = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const start = FILL_DELAY + (cy / H.height) * FILL_SWEEP + (cx / H.width) * 260 + jitter * 160;
  return { p: c.p, cx, cy, color: zoneColor(c.z, H.zoneCount), start };
});
const FIELD = typeof Path2D === "undefined" ? undefined : new Path2D(ring(H.outline));
const FILL_END =Math.max(...CELLS.map((c) => c.start)) + POP;

function ZoneFill({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t0 = -1;

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };

    const draw = (elapsed: number) => {
      const sx = canvas.width / H.width;
      const sy = canvas.height / H.height;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (!active) return;
      g.setTransform(sx, 0, 0, sy, 0, 0);
      for (const c of CELLS) {
        const t = (elapsed - c.start) / POP;
        if (t <= 0) continue;
        const p = Math.min(1, t);
        const e = 1 - Math.pow(1 - p, 3); // ease-out
        const scale = 0.35 + 0.65 * e + 0.08 * Math.sin(Math.PI * p); // slight overshoot
        g.globalAlpha = 0.85 * e;
        g.fillStyle = c.color;
        g.beginPath();
        for (let k = 0; k < c.p.length; k++) {
          const x = c.cx + (c.p[k][0] - c.cx) * scale;
          const y = c.cy + (c.p[k][1] - c.cy) * scale;
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.fill();
        // brief white flash as each square lands
        if (p < 1) {
          g.globalAlpha = 0.45 * (1 - p);
          g.fillStyle = "#ffffff";
          g.fill();
        }
      }
      // soft scan line just ahead of the filling rows
      const scan = (elapsed - FILL_DELAY) / FILL_SWEEP;
      if (scan > 0 && scan < 1.08) {
        const y = Math.min(1, scan) * H.height + 1.2;
        const fade = scan > 1 ? 1 - (scan - 1) / 0.08 : 1;
        const grad = g.createLinearGradient(0, y - 3, 0, y + 0.6);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,255,0.55)");
        g.save();
        if (FIELD) g.clip(FIELD); // keep the scan line inside the field outline
        g.globalAlpha = fade;
        g.fillStyle = grad;
        g.fillRect(0, y - 3, H.width, 3.6);
        g.restore();
      }
      g.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (t0 < 0) t0 = now;
      const elapsed = now - t0;
      draw(elapsed);
      raf = elapsed < FILL_END + 200 ? requestAnimationFrame(loop) : 0;
    };

    size();
    if (active && !reduced) raf = requestAnimationFrame(loop);
    else draw(active ? Infinity : 0);

    const ro = new ResizeObserver(() => {
      size();
      if (!raf || reduced) draw(active ? Infinity : 0);
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

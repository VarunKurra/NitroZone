"use client";

import { useEffect, useRef } from "react";

type Dot = { x: number; y: number; r: number; delay: number };

/**
 * Giant halftone wordmark. The word is rasterized off-screen, then re-drawn as a dot grid:
 * each dot's radius follows how much of that grid cell the letters cover, multiplied by a
 * vertical fade, which gives the printed-halftone look.
 *
 * Motion (subtle, only while on screen, off for prefers-reduced-motion):
 * - dots grow in left to right the first time the wordmark scrolls into view
 * - a slow wave drifts across, gently swelling and shrinking the dots
 * - dots near the cursor swell softly
 */
export function HalftoneWordmark({ text = "NITROZONE", color = "#15653d", className }: { text?: string; color?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dots: Dot[] = [];
    let step = 1;
    let dpr = 1;
    let raf = 0;
    let visible = false;
    let revealStart = -1; // ms timestamp when the reveal began
    const pointer = { x: 0, y: 0, target: 0, strength: 0 };

    const layout = () => {
      const w = wrap.clientWidth;
      if (!w) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const fontPx = w / (text.length * 0.66);
      const h = Math.round(fontPx * 0.86);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;

      // 1. rasterize text into an offscreen mask
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const o = off.getContext("2d")!;
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-jakarta").trim() || "sans-serif";
      o.fillStyle = "#000";
      o.textBaseline = "alphabetic";
      o.font = `800 ${fontPx * dpr}px ${family}, sans-serif`;
      const measured = o.measureText(text).width;
      const scaleX = (canvas.width * 0.995) / measured;
      o.setTransform(scaleX, 0, 0, 1, (canvas.width - measured * scaleX) / 2, 0);
      o.fillText(text, 0, canvas.height * 0.93);
      const mask = o.getImageData(0, 0, off.width, off.height).data;

      // 2. halftone dots (positions + resting radius)
      step = Math.max(5, Math.round(w / 170)) * dpr;
      dots = [];
      for (let y = step / 2; y < canvas.height; y += step) {
        const fade = 1 - 0.75 * (y / canvas.height); // denser at the top, lighter toward the bottom
        for (let x = step / 2; x < canvas.width; x += step) {
          // coverage of this cell (sample a 3x3 grid inside it)
          let cov = 0;
          for (let sy = -1; sy <= 1; sy++)
            for (let sx = -1; sx <= 1; sx++) {
              const px = Math.min(off.width - 1, Math.max(0, Math.round(x + (sx * step) / 3)));
              const py = Math.min(off.height - 1, Math.max(0, Math.round(y + (sy * step) / 3)));
              cov += mask[(py * off.width + px) * 4 + 3] / 255;
            }
          cov /= 9;
          const r = (step / 2) * Math.sqrt(cov * fade) * 0.95;
          if (r < 0.35 * dpr) continue;
          // reveal sweeps left to right with a little jitter so it feels organic
          const delay = (x / canvas.width) * 900 + ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1 * 260;
          dots.push({ x, y, r, delay });
        }
      }
    };

    const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

    const draw = (now: number) => {
      const g = canvas.getContext("2d")!;
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = color;
      const t = now / 1000;
      const reach = step * 9; // cursor influence radius
      pointer.strength += (pointer.target - pointer.strength) * 0.08;
      const revealT = reduced ? Infinity : revealStart < 0 ? 0 : now - revealStart;

      g.beginPath();
      for (const d of dots) {
        let r = d.r;
        if (!reduced) {
          const p = ease((revealT - d.delay) / 650);
          r *= p;
          // slow diagonal wave: ±9%
          r *= 1 + 0.09 * Math.sin(d.x / (step * 14) - t * 1.1 + d.y / (step * 6));
          if (pointer.strength > 0.01) {
            const dx = d.x - pointer.x;
            const dy = d.y - pointer.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < reach * reach) {
              const k = 1 - Math.sqrt(dist2) / reach;
              r *= 1 + 0.4 * pointer.strength * k * k;
            }
          }
          r = Math.min(r, step * 0.62);
        }
        if (r < 0.3 * dpr) continue;
        g.moveTo(d.x + r, d.y);
        g.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      g.fill();
    };

    const loop = (now: number) => {
      draw(now);
      raf = visible && !reduced ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const relayout = () => {
      layout();
      if (reduced || !visible) draw(performance.now());
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && revealStart < 0) revealStart = performance.now();
        if (visible && !reduced) start();
      },
      { threshold: 0.15 },
    );
    io.observe(wrap);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) * dpr;
      pointer.y = (e.clientY - rect.top) * dpr;
      pointer.target = 1;
    };
    const onLeave = () => {
      pointer.target = 0;
    };
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    // wait for the display font so the shape matches the brand type
    document.fonts?.ready.then(relayout);
    relayout();
    const ro = new ResizeObserver(relayout);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [text, color]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}

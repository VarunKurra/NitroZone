"use client";

import { useEffect, useRef } from "react";

/**
 * Giant halftone wordmark. The word is rasterized off-screen, then re-drawn as a dot grid:
 * each dot's radius follows how much of that grid cell the letters cover, multiplied by a
 * vertical fade, which gives the printed-halftone look. Redraws on resize; static (no animation).
 */
export function HalftoneWordmark({ text = "NITROZONE", color = "#15653d", className }: { text?: string; color?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let raf = 0;
    const draw = () => {
      const w = wrap.clientWidth;
      if (!w) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
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
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-bricolage").trim() || "sans-serif";
      o.fillStyle = "#000";
      o.textBaseline = "alphabetic";
      o.font = `800 ${fontPx * dpr}px ${family}, sans-serif`;
      const measured = o.measureText(text).width;
      const scaleX = (canvas.width * 0.995) / measured;
      o.setTransform(scaleX, 0, 0, 1, (canvas.width - measured * scaleX) / 2, 0);
      o.fillText(text, 0, canvas.height * 0.93);
      const mask = o.getImageData(0, 0, off.width, off.height).data;

      // 2. halftone dots
      const g = canvas.getContext("2d")!;
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = color;
      const step = Math.max(5, Math.round(w / 170)) * dpr;
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
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    // wait for the display font so the shape matches the brand type
    document.fonts?.ready.then(schedule);
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text, color]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}

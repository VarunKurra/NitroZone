"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated number that counts smoothly from its previous value to the new one.
 * Writes to the DOM directly (no React re-render per frame). Honors reduced motion.
 */
export function NumberTicker({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  duration = 0.9,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const fmt = (v: number) =>
    `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value)) {
      if (el) el.textContent = "–";
      return;
    }
    if (!inView) return;
    const first = prev.current === null;
    const from = prev.current ?? 0;
    prev.current = value;
    if (reduce || from === value) {
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(from, value, {
      duration: first ? duration : Math.min(duration, 0.5),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = fmt(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduce, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={cn("tabular", className)} aria-label={fmt(value)}>
      {fmt(0)}
    </span>
  );
}

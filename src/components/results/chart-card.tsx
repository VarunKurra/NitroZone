"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Consistent frame for every chart: a question as the title, a one-line answer, the chart, a footnote. */
export function ChartCard({
  question,
  answer,
  children,
  footnote,
  actions,
  className,
  delay = 0,
  testId,
}: {
  question: string;
  answer?: React.ReactNode;
  children: React.ReactNode;
  footnote?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  delay?: number;
  testId?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex flex-col rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5", className)}
      aria-label={question}
      data-testid={testId}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[1.02rem] font-semibold leading-snug tracking-[-0.01em]">{question}</h3>
          {answer && <p className="mt-1 text-[0.84rem] leading-snug text-muted-foreground">{answer}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
      {footnote && <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">{footnote}</p>}
    </motion.section>
  );
}

/** Tooltip box shared by all charts. */
export function TipBox({ title, rows, swatch }: { title: string; rows: [string, string][]; swatch?: string }) {
  return (
    <div className="min-w-40 rounded-xl border bg-white/97 px-3 py-2 text-xs shadow-[var(--shadow-float)]">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
        {swatch && <span className="size-2.5 rounded-sm" style={{ background: swatch }} />}
        {title}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 text-muted-foreground">
          <span>{k}</span>
          <span className="font-medium text-foreground tabular">{v}</span>
        </div>
      ))}
    </div>
  );
}

export const AXIS = { stroke: "#8a918b", fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = { stroke: "#eceee8", strokeDasharray: "0", vertical: false } as const;

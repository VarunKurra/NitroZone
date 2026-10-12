"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";
import { zoneColor, zoneLabel } from "@/lib/palette";
import type { ZoneSummary } from "@/lib/agronomy/types";
import { cn } from "@/lib/utils";

type Key = "zone" | "areaAc" | "primary" | "sufficiency" | "rateLbAc" | "totalLbN" | "savedLbN";

/** Sortable table: the accessible, exact-number view of every chart. */
export function ZoneTable() {
  const rx = usePrescription();
  const zc = useApp((s) => s.analysis?.zoning.zoneCount ?? 4);
  const filter = useApp((s) => s.zoneFilter);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "zone", dir: 1 });
  if (!rx) return null;
  const rows = [...rx.summaries].sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
  const cols: { key: Key; label: string; fmt: (z: ZoneSummary) => string }[] = [
    { key: "zone", label: "Zone", fmt: (z) => `Z${z.zone}` },
    { key: "areaAc", label: "Acres", fmt: (z) => z.areaAc.toFixed(1) },
    { key: "primary", label: rx.names.primary, fmt: (z) => z.primary.toFixed(3) },
    { key: "sufficiency", label: "SI", fmt: (z) => z.sufficiency.toFixed(2) },
    { key: "rateLbAc", label: "Rate", fmt: (z) => z.rateLbAc.toFixed(0) },
    { key: "totalLbN", label: "Total N", fmt: (z) => Math.round(z.totalLbN).toLocaleString() },
    { key: "savedLbN", label: "vs flat", fmt: (z) => `${z.savedLbN >= 0 ? "−" : "+"}${Math.abs(Math.round(z.savedLbN)).toLocaleString()}` },
  ];
  const t = rx.totals;
  return (
    <section className="@container rounded-2xl border bg-white shadow-[var(--shadow-soft)]" aria-label="Zone table">
      <div className="px-4 pt-4 sm:px-5">
        <h3 className="font-display text-[1.02rem] font-semibold">Zone details</h3>
        <p className="mt-1 text-[0.84rem] text-muted-foreground">Exact numbers behind every chart. Rate in lb N/ac, totals in lb N. Click a column to sort.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-left">
              {cols.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("whitespace-nowrap px-3 py-2 font-medium text-muted-foreground first:pl-5", c.key !== "zone" && "text-right")}>
                    <button className={cn("inline-flex items-center gap-1 hover:text-foreground", c.key !== "zone" && "flex-row-reverse")} onClick={() => setSort({ key: c.key, dir: active ? (-sort.dir as 1 | -1) : 1 })}>
                      {c.label}
                      {active ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((z) => (
              <tr key={z.zone} className={cn("border-b last:border-b-0 hover:bg-muted/30", filter.length && !filter.includes(z.zone) && "opacity-45")}>
                {cols.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 tabular first:pl-5", c.key !== "zone" && "text-right")}>
                    {c.key === "zone" ? (
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <span className="size-3 rounded-[4px]" style={{ background: zoneColor(z.zone, zc) }} />
                        {c.fmt(z)}
                        <span className="hidden whitespace-nowrap font-normal text-muted-foreground @[640px]:inline">{zoneLabel(z.zone, zc)}</span>
                      </span>
                    ) : (
                      c.fmt(z)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-3 py-2.5 pl-5">Field</td>
              <td className="px-3 py-2.5 text-right tabular">{t.areaAc.toFixed(1)}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right tabular">{t.avgRateLbAc.toFixed(0)}</td>
              <td className="px-3 py-2.5 text-right tabular">{Math.round(t.variableLbN).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular">
                {t.savedLbN >= 0 ? "−" : "+"}
                {Math.abs(Math.round(t.savedLbN)).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

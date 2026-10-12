"use client";

/**
 * The results charts. Each answers ONE farmer question:
 *   VigorHistogram   - How is crop vigor distributed across the field?
 *   NitrogenByZone   - How much nitrogen goes where?
 *   SavingsWaterfall - Where do the savings (or extra N) come from?
 *   FieldProfile     - How do different parts of the field compare?
 *   VigorScatter     - Can I trust the signal? (NDRE vs NDVI per cell)
 * All read from usePrescription(), so they update live with settings and zone edits.
 */
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { AXIS, ChartCard, GRID, TipBox } from "./chart-card";
import { usePrescription } from "@/hooks/use-prescription";
import { useApp } from "@/store/app-store";
import { zoneColor, zoneLabel } from "@/lib/palette";
import { percentile } from "@/lib/agronomy/indices";

const fmt0 = (v: number) => Math.round(v).toLocaleString("en-US");
const ANIM = { isAnimationActive: true, animationDuration: 700, animationEasing: "ease-out" as const };

function useCore() {
  const analysis = useApp((s) => s.analysis);
  const zoneFilter = useApp((s) => s.zoneFilter);
  const rx = usePrescription();
  return { analysis, rx, zoneFilter, zc: analysis?.zoning.zoneCount ?? 4 };
}

// ---------------------------------------------------------------- histogram
export function VigorHistogram() {
  const { analysis, rx, zc, zoneFilter } = useCore();
  const valueRange = useApp((s) => s.valueRange);
  const [key, setKey] = useState<"primary" | "secondary">("primary");
  const bins = useMemo(() => {
    if (!analysis || !rx) return [];
    const vals = analysis.cells.map((c) => c[key]);
    const lo = percentile(vals, 1);
    const hi = percentile(vals, 99.5);
    const n = 22;
    const w = (hi - lo) / n || 1e-3;
    const out = Array.from({ length: n }, (_, i) => ({ i, min: lo + i * w, max: lo + (i + 1) * w, acres: 0, byZone: new Array(zc + 1).fill(0) as number[] }));
    analysis.cells.forEach((c, idx) => {
      const v = c[key];
      if (!Number.isFinite(v)) return;
      const b = Math.max(0, Math.min(n - 1, Math.floor((v - lo) / w)));
      out[b].acres += c.areaAc;
      out[b].byZone[rx.zones[idx]] += c.areaAc;
    });
    const total = out.reduce((s, b) => s + b.acres, 0) || 1;
    return out.map((b) => {
      const zone = b.byZone.indexOf(Math.max(...b.byZone));
      return { ...b, zone: zone || 1, pct: (b.acres / total) * 100, mid: (b.min + b.max) / 2 };
    });
  }, [analysis, rx, key, zc]);
  if (!analysis || !rx) return null;
  const name = key === "primary" ? rx.names.primary : rx.names.secondary;
  const ref = key === "primary" ? rx.reference.value : undefined;
  const active = valueRange?.key === key ? valueRange : null;

  return (
    <ChartCard
      testId="chart-histogram"
      question="How is crop vigor spread across the field?"
      answer={
        <>
          Acres in each {name} band, colored by the zone most of those acres belong to. <strong className="font-medium text-foreground">Click a bar</strong> to highlight those cells on the map.
        </>
      }
      actions={
        <ToggleGroup type="single" size="sm" value={key} onValueChange={(v) => v && (setKey(v as "primary" | "secondary"), useApp.setState({ valueRange: null }))} className="rounded-lg bg-muted p-0.5" aria-label="Index">
          <ToggleGroupItem value="primary" className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-white data-[state=on]:shadow-sm">
            {rx.names.primary}
          </ToggleGroupItem>
          <ToggleGroupItem value="secondary" className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-white data-[state=on]:shadow-sm">
            {rx.names.secondary}
          </ToggleGroupItem>
        </ToggleGroup>
      }
      footnote={
        active ? (
          <span className="flex items-center gap-2">
            Showing {name} {active.min.toFixed(3)} to {active.max.toFixed(3)} on the map.
            <Button size="xs" variant="outline" onClick={() => useApp.setState({ valueRange: null })}>
              Clear
            </Button>
          </span>
        ) : ref !== undefined ? (
          `Dashed line: reference ${name} ${ref.toFixed(3)} (${rx.reference.kind === "strip" ? "N-rich strip" : "best 5% of the field"}).`
        ) : undefined
      }
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 6, right: 6, left: -14, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="mid" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => v.toFixed(2)} {...AXIS} tickCount={6} />
            <YAxis {...AXIS} tickFormatter={(v: number) => `${v.toFixed(0)}`} width={44} label={{ value: "acres", angle: -90, position: "insideLeft", offset: 22, fontSize: 10, fill: "#8a918b" }} />
            <Tooltip
              cursor={{ fill: "rgb(20 32 26 / 0.04)" }}
              content={({ active: a, payload }) => {
                const b = a && payload?.[0]?.payload;
                if (!b) return null;
                return <TipBox swatch={zoneColor(b.zone, zc)} title={`${name} ${b.min.toFixed(3)} – ${b.max.toFixed(3)}`} rows={[["Acres", b.acres.toFixed(1)], ["Share of field", `${b.pct.toFixed(1)}%`], ["Mostly", `Zone ${b.zone}`]]} />;
              }}
            />
            {ref !== undefined && <ReferenceLine x={ref} stroke="#14201a" strokeDasharray="4 3" strokeWidth={1.2} ifOverflow="extendDomain" />}
            <Bar
              dataKey="acres"
              radius={[4, 4, 0, 0]}
              {...ANIM}
              onClick={(d: { payload?: { min: number; max: number } }) => {
                const b = d.payload;
                if (!b) return;
                const same = active && Math.abs(active.min - b.min) < 1e-9;
                useApp.setState({ valueRange: same ? null : { key, min: b.min, max: b.max } });
              }}
              className="cursor-pointer"
            >
              {bins.map((b) => {
                const inRange = !active || (b.min >= active.min - 1e-9 && b.max <= active.max + 1e-9);
                const inFilter = !zoneFilter.length || zoneFilter.includes(b.zone);
                return <Cell key={b.i} fill={zoneColor(b.zone, zc)} fillOpacity={inRange && inFilter ? 1 : 0.22} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------- nitrogen by zone
export function NitrogenByZone() {
  const { rx, zc, zoneFilter } = useCore();
  if (!rx) return null;
  const data = rx.summaries.filter((z) => z.areaAc > 0).map((z) => ({ ...z, name: `Z${z.zone}` }));
  const top = [...data].sort((a, b) => b.totalLbN - a.totalLbN)[0];
  return (
    <ChartCard
      testId="chart-nitrogen"
      delay={0.05}
      question="How much nitrogen goes where?"
      answer={top ? `Zone ${top.zone} takes the most N (${fmt0(top.totalLbN)} lb, ${((top.totalLbN / rx.totals.variableLbN) * 100).toFixed(0)}% of the plan) because it covers ${top.areaAc.toFixed(1)} ac at ${top.rateLbAc.toFixed(0)} lb/ac.` : undefined}
      footnote="Colored bars: pounds of N in this plan. Gray bars: what a flat rate would put on the same acres."
    >
      <div className="mb-2 flex items-center gap-4 text-[0.72rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-gradient-to-r from-zone-1 via-zone-3 to-zone-5" /> Variable rate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-[#d9ddd3]" /> Flat rate
        </span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: -6, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid {...GRID} horizontal={false} vertical />
            <XAxis type="number" {...AXIS} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)} />
            <YAxis type="category" dataKey="name" {...AXIS} width={38} />
            <Tooltip
              cursor={{ fill: "rgb(20 32 26 / 0.04)" }}
              content={({ active, payload }) => {
                const z = active && payload?.[0]?.payload;
                if (!z) return null;
                return (
                  <TipBox
                    swatch={zoneColor(z.zone, zc)}
                    title={`Zone ${z.zone}: ${zoneLabel(z.zone, zc)}`}
                    rows={[
                      ["Area", `${z.areaAc.toFixed(1)} ac`],
                      ["Rate", `${z.rateLbAc.toFixed(0)} lb N/ac`],
                      ["This plan", `${fmt0(z.totalLbN)} lb N`],
                      ["Flat rate", `${fmt0(z.flatLbN)} lb N`],
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="flatLbN" fill="#d9ddd3" radius={[0, 4, 4, 0]} barSize={9} {...ANIM} />
            <Bar dataKey="totalLbN" radius={[0, 4, 4, 0]} barSize={14} {...ANIM} onClick={(d: { payload?: { zone: number } }) => d.payload && useApp.getState().toggleZoneFilter(d.payload.zone)} className="cursor-pointer">
              {data.map((z) => (
                <Cell key={z.zone} fill={zoneColor(z.zone, zc)} fillOpacity={!zoneFilter.length || zoneFilter.includes(z.zone) ? 1 : 0.25} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// -------------------------------------------------------------- waterfall
export function SavingsWaterfall() {
  const { rx } = useCore();
  const price = useApp((s) => s.rateSettings.pricePerLbN);
  if (!rx) return null;
  const t = rx.totals;
  let running = t.flatLbN;
  const rows: { name: string; base: number; value: number; kind: "total" | "less" | "more"; delta: number; zone?: number }[] = [{ name: "Flat", base: 0, value: t.flatLbN, kind: "total", delta: 0 }];
  for (const z of rx.summaries) {
    if (z.areaAc <= 0) continue;
    const delta = z.totalLbN - z.flatLbN; // negative = saves N
    const next = running + delta;
    rows.push({ name: `Z${z.zone}`, base: Math.min(running, next), value: Math.abs(delta), kind: delta <= 0 ? "less" : "more", delta, zone: z.zone });
    running = next;
  }
  rows.push({ name: "Plan", base: 0, value: t.variableLbN, kind: "total", delta: 0 });
  const minV = Math.min(...rows.map((r) => r.base + (r.kind === "total" ? r.value : 0)).filter((v) => v > 0), t.variableLbN, t.flatLbN);
  const floor = Math.max(0, Math.floor((minV * 0.82) / 100) * 100);
  const biggest = rows.filter((r) => r.kind === "less").sort((a, b) => b.value - a.value)[0];

  return (
    <ChartCard
      testId="chart-waterfall"
      delay={0.1}
      question="Where do the savings come from?"
      answer={
        t.usesMoreThanFlat
          ? `This plan adds ${fmt0(-t.savedLbN)} lb of N compared with flat. Lower the stressed-zone increases to save.`
          : biggest
            ? `Most of the ${fmt0(t.savedLbN)} lb saved comes from Zone ${biggest.zone} (${fmt0(biggest.value)} lb, about $${fmt0(biggest.value * price)}).`
            : "No change from the flat rate."
      }
      footnote={<>Starts from the flat-rate total, then each zone adds (amber) or removes (blue) pounds of N. Savings = (flat lb − plan lb) × ${price.toFixed(2)}/lb.</>}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 6, left: -4, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis {...AXIS} domain={[floor, "auto"]} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)} width={44} allowDataOverflow />
            <Tooltip
              cursor={{ fill: "rgb(20 32 26 / 0.04)" }}
              content={({ active, payload }) => {
                const r = active && payload?.[0]?.payload;
                if (!r) return null;
                return r.kind === "total" ? (
                  <TipBox title={r.name === "Flat" ? "Flat-rate total" : "Variable-rate total"} rows={[["Nitrogen", `${fmt0(r.value)} lb`], ["Cost", `$${fmt0(r.value * price)}`]]} />
                ) : (
                  <TipBox
                    title={`Zone ${r.zone}`}
                    rows={[
                      [r.kind === "less" ? "Less N" : "More N", `${fmt0(r.value)} lb`],
                      [r.kind === "less" ? "Saves" : "Costs", `$${fmt0(r.value * price)}`],
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value" stackId="w" radius={[4, 4, 4, 4]} {...ANIM}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.kind === "total" ? "#2b3a32" : r.kind === "less" ? "#1689bd" : "#e59a1e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ----------------------------------------------------------------- profile
export function FieldProfile() {
  const { analysis, rx } = useCore();
  const [axis, setAxis] = useState<"ns" | "we">("ns");
  const data = useMemo(() => {
    if (!analysis || !rx) return [];
    const n = axis === "ns" ? analysis.rows : analysis.cols;
    const bands = Array.from({ length: n }, () => [] as number[]);
    const rates = Array.from({ length: n }, () => [0, 0]);
    analysis.cells.forEach((c, i) => {
      const k = axis === "ns" ? c.row : c.col;
      if (Number.isFinite(c.primary)) bands[k].push(c.primary);
      rates[k][0] += rx.rates[i] * c.areaAc;
      rates[k][1] += c.areaAc;
    });
    const cell = (analysis.cells[0] && Math.sqrt((analysis.cells[0].areaAc * 4046.86))) || 20;
    return bands
      .map((b, k) => ({
        k,
        dist: Math.round(k * cell),
        mean: b.length ? b.reduce((s, v) => s + v, 0) / b.length : null,
        band: b.length >= 3 ? [percentile(b, 10), percentile(b, 90)] : null,
        rate: rates[k][1] ? rates[k][0] / rates[k][1] : null,
      }))
      .filter((d) => d.mean !== null);
  }, [analysis, rx, axis]);
  if (!analysis || !rx) return null;
  const vals = data.map((d) => d.mean as number);
  const lowIdx = vals.indexOf(Math.min(...vals));
  const highIdx = vals.indexOf(Math.max(...vals));
  const dirLabel = axis === "ns" ? ["north edge", "south"] : ["west edge", "east"];
  return (
    <ChartCard
      testId="chart-profile"
      delay={0.05}
      question="How do different parts of the field compare?"
      answer={
        data.length
          ? `Average ${rx.names.primary} along the field from the ${dirLabel[0]}. Weakest around ${data[lowIdx].dist} m, strongest around ${data[highIdx].dist} m.`
          : undefined
      }
      actions={
        <ToggleGroup type="single" size="sm" value={axis} onValueChange={(v) => v && setAxis(v as "ns" | "we")} className="rounded-lg bg-muted p-0.5" aria-label="Direction">
          <ToggleGroupItem value="ns" className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-white data-[state=on]:shadow-sm">
            N → S
          </ToggleGroupItem>
          <ToggleGroupItem value="we" className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-white data-[state=on]:shadow-sm">
            W → E
          </ToggleGroupItem>
        </ToggleGroup>
      }
      footnote={`Line: mean ${rx.names.primary} of each ${useApp.getState().analysisSettings.cellSizeM} m strip. Shaded: middle 80% of cells in that strip (wider = more uneven).`}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="dist" {...AXIS} tickFormatter={(v: number) => `${v} m`} minTickGap={28} />
            <YAxis {...AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)} width={46} />
            <Tooltip
              cursor={{ stroke: "#8a918b", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const d = active && payload?.[0]?.payload;
                if (!d) return null;
                return (
                  <TipBox
                    title={`${d.dist} m from the ${dirLabel[0]}`}
                    rows={[
                      [`Mean ${rx.names.primary}`, (d.mean as number).toFixed(3)],
                      ...(d.band ? ([["Middle 80%", `${d.band[0].toFixed(3)} – ${d.band[1].toFixed(3)}`]] as [string, string][]) : []),
                      ...(d.rate ? ([["Avg rate", `${d.rate.toFixed(0)} lb N/ac`]] as [string, string][]) : []),
                    ]}
                  />
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill="#2fae8a" fillOpacity={0.16} {...ANIM} />
            <ReferenceLine y={rx.reference.value} stroke="#14201a" strokeDasharray="4 3" strokeWidth={1} />
            <Line dataKey="mean" stroke="#15653d" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ----------------------------------------------------------------- scatter
export function VigorScatter() {
  const { analysis, rx, zc, zoneFilter } = useCore();
  const series = useMemo(() => {
    if (!analysis || !rx) return [];
    return Array.from({ length: zc }, (_, k) => ({
      zone: k + 1,
      points: analysis.cells
        .map((c, i) => ({ x: c.secondary, y: c.primary, id: c.id, zone: rx.zones[i], filled: c.filled, area: c.areaAc }))
        .filter((p) => p.zone === k + 1 && Number.isFinite(p.x) && Number.isFinite(p.y)),
    }));
  }, [analysis, rx, zc]);
  if (!analysis || !rx) return null;
  const isS2 = analysis.scene.sensor === "sentinel2";
  return (
    <ChartCard
      testId="chart-scatter"
      delay={0.1}
      question={isS2 ? "Is the red-edge signal adding information?" : "Do the two drone indices agree?"}
      answer={
        isS2
          ? "Each dot is a grid cell. Where NDVI bunches up near its ceiling, NDRE still spreads cells apart. That's why NitroZone zones on NDRE."
          : "Each dot is a grid cell. Cells where VARI and ExG disagree deserve a look in the field."
      }
      footnote={<>Hover a dot to find that cell on the map; click to inspect it. Hollow dots were gap-filled under cloud.</>}
    >
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] text-muted-foreground">
        {series.map((s) => (
          <span key={s.zone} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: zoneColor(s.zone, zc) }} /> Zone {s.zone}
          </span>
        ))}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 8, left: -10, bottom: 4 }}>
            <CartesianGrid {...GRID} vertical />
            <XAxis type="number" dataKey="x" name={rx.names.secondary} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)} {...AXIS} label={{ value: rx.names.secondary, position: "insideBottomRight", offset: -2, fontSize: 10, fill: "#8a918b" }} />
            <YAxis type="number" dataKey="y" name={rx.names.primary} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)} {...AXIS} width={46} label={{ value: rx.names.primary, angle: -90, position: "insideLeft", offset: 20, fontSize: 10, fill: "#8a918b" }} />
            <ZAxis range={[14, 14]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#8a918b" }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return <TipBox swatch={zoneColor(p.zone, zc)} title={`Cell ${p.id} · Zone ${p.zone}`} rows={[[rx.names.primary, p.y.toFixed(3)], [rx.names.secondary, p.x.toFixed(3)], ["Area", `${p.area.toFixed(2)} ac`]]} />;
              }}
            />
            {series.map((s) => (
              <Scatter
                key={s.zone}
                data={s.points}
                fill={zoneColor(s.zone, zc)}
                fillOpacity={!zoneFilter.length || zoneFilter.includes(s.zone) ? 0.75 : 0.08}
                isAnimationActive={false}
                onMouseEnter={(d) => {
                  const id = (d.payload as { id?: number } | undefined)?.id;
                  if (id !== undefined) useApp.setState({ hoveredCell: id });
                }}
                onMouseLeave={() => useApp.setState({ hoveredCell: null })}
                onClick={(d) => {
                  const id = (d.payload as { id?: number } | undefined)?.id;
                  if (id !== undefined) useApp.setState({ inspectedCell: id });
                }}
                shape={(props: { cx?: number; cy?: number; payload?: { filled: boolean }; fill?: string; fillOpacity?: number }) => (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={3.2}
                    fill={props.payload?.filled ? "#fff" : props.fill}
                    fillOpacity={props.fillOpacity}
                    stroke={props.fill}
                    strokeWidth={props.payload?.filled ? 1.2 : 0}
                    className="cursor-pointer"
                  />
                )}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

"use client";

/**
 * Fallback map for browsers WITHOUT WebGL (e.g. Chrome with graphics acceleration turned off).
 * MapLibre needs WebGL2, so this draws the same thing with plain <img> satellite tiles and SVG:
 * pan (drag), zoom (wheel / buttons), field + strip outlines, zone / fertilizer / crop-health
 * layers, hover + click to inspect, drawing and editing the boundary, and zone painting.
 */
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { usePrescription } from "@/hooks/use-prescription";
import { RATE_RAMP, rampColor, zoneColor } from "@/lib/palette";
import { polygonsOf } from "@/lib/agronomy/geo";
import type { FieldPolygon } from "@/lib/agronomy/types";
import { mapBridge, type Bounds } from "./map-bridge";
import { indexImage, stretchOf, trueColorImage } from "./raster-image";

const TILE = 256;
const IMAGERY = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const LABELS = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;
const MIN_Z = 5;
const MAX_Z = 18;

/** Web Mercator: lon/lat -> world pixels at zoom z. */
function project([lon, lat]: number[], z: number): [number, number] {
  const s = TILE * 2 ** z;
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
}
function unproject([x, y]: number[], z: number): [number, number] {
  const s = TILE * 2 ** z;
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return [lon, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))];
}

const ring = (pts: [number, number][]) => `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}Z`;

export default function SimpleMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ center: [-94.6, 38.4] as [number, number], zoom: 7 });
  // vertices while drawing, tagged with the draw mode they belong to (switching mode discards them)
  const [draftState, setDraftState] = useState<{ mode: string; pts: [number, number][] }>({ mode: "idle", pts: [] });
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; vertex: number | null } | null>(null);
  const painting = useRef<Set<number> | null>(null);

  const field = useApp((s) => s.field);
  const reference = useApp((s) => s.reference);
  const drawMode = useApp((s) => s.drawMode);
  const analysis = useApp((s) => s.analysis);
  const step = useApp((s) => s.step);
  const mapLayer = useApp((s) => s.mapLayer);
  const zoneFilter = useApp((s) => s.zoneFilter);
  const valueRange = useApp((s) => s.valueRange);
  const inspected = useApp((s) => s.inspectedCell);
  const hoveredCell = useApp((s) => s.hoveredCell);
  const brushZone = useApp((s) => s.brushZone);
  const rx = usePrescription();
  const draft = draftState.mode === drawMode ? draftState.pts : [];
  const setDraft = (u: [number, number][] | ((p: [number, number][]) => [number, number][])) =>
    setDraftState((d) => ({ mode: drawMode, pts: typeof u === "function" ? u(d.mode === drawMode ? d.pts : []) : u }));

  // ---- size
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const z = view.zoom;
  const [cx, cy] = project(view.center, z);
  const ox = cx - size.w / 2;
  const oy = cy - size.h / 2;
  const toScreen = useCallback((p: number[]): [number, number] => {
    const [x, y] = project(p, z);
    return [x - ox, y - oy];
  }, [z, ox, oy]);
  const toLngLat = useCallback((sx: number, sy: number) => unproject([sx + ox, sy + oy], z), [z, ox, oy]);

  // ---- fit / fly (also exposed to address search)
  const fitBounds = useCallback((b: Bounds, padding: number) => {
    const el = wrap.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    // On wide screens the step panel covers the left side of the map (except on Results).
    const left = useApp.getState().step !== "results" && w > 900 ? Math.min(440, w * 0.46) : 0;
    let zoom = MAX_Z - 1;
    for (; zoom > MIN_Z; zoom--) {
      const [x0, y1] = project(b[0], zoom);
      const [x1, y0] = project(b[1], zoom);
      if (x1 - x0 <= w - left - 2 * padding && y1 - y0 <= h - 2 * padding) break;
    }
    // shift the centre left so the field sits in the visible part, right of the panel
    const [mx, my] = project([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], zoom);
    setView({ center: unproject([mx - left / 2, my], zoom), zoom });
  }, []);
  useEffect(() => {
    mapBridge.set({ flyTo: (center, zoom) => setView({ center, zoom: Math.round(Math.min(MAX_Z, Math.max(MIN_Z, zoom))) }), fitBounds });
    return () => mapBridge.set(null);
  }, [fitBounds]);

  const fieldKey = field ? JSON.stringify(polygonsOf(field.geometry)[0][0].slice(0, 3)) : "";
  useEffect(() => {
    if (!field || drawMode !== "idle") return;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const rings of polygonsOf(field.geometry)) for (const [x, y] of rings[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
    const raf = requestAnimationFrame(() => fitBounds([[w, s], [e, n]], 60));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldKey]);

  // ---- tiles
  const tiles = useMemo(() => {
    const out: { key: string; x: number; y: number; tx: number; ty: number }[] = [];
    const n = 2 ** z;
    const tx0 = Math.floor(ox / TILE), tx1 = Math.floor((ox + size.w) / TILE);
    const ty0 = Math.max(0, Math.floor(oy / TILE)), ty1 = Math.min(n - 1, Math.floor((oy + size.h) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) out.push({ key: `${z}/${tx}/${ty}`, x: tx * TILE - ox, y: ty * TILE - oy, tx: ((tx % n) + n) % n, ty });
    return out;
  }, [z, ox, oy, size]);

  // ---- cells (projected once per view)
  const showCells = step === "rates" || step === "results";
  const cells = useMemo(() => {
    if (!analysis || !rx || !showCells) return [];
    let rMin = Infinity, rMax = -Infinity;
    for (const r of rx.rates) { rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); }
    const span = rMax - rMin || 1;
    return analysis.cells.map((c, i) => {
      const zn = rx.zones[i];
      const color = mapLayer === "rate" ? `rgb(${rampColor(RATE_RAMP, (rx.rates[i] - rMin) / span).map(Math.round).join(",")})` : zoneColor(zn, analysis.zoning.zoneCount);
      const out = valueRange ? !(c[valueRange.key] >= valueRange.min && c[valueRange.key] <= valueRange.max) : false;
      return { id: c.id, d: ring(c.ringsLngLat[0].map(toScreen)), color, dim: (zoneFilter.length > 0 && !zoneFilter.includes(zn)) || out };
    });
  }, [analysis, rx, showCells, mapLayer, zoneFilter, valueRange, toScreen]);
  const cellsVisible = showCells && (mapLayer === "zones" || mapLayer === "rate");

  // raster overlay for crop health / true colour
  const overlay = useMemo(() => {
    if (!analysis || !showCells || (mapLayer !== "primary" && mapLayer !== "truecolor")) return null;
    const p = analysis.preview;
    const url = mapLayer === "primary" ? indexImage(p, "primary", stretchOf(p.primary)) : trueColorImage(p);
    return url ? { url, corners: p.corners } : null;
  }, [analysis, showCells, mapLayer]);

  // ---- interactions
  const cellAt = (e: React.PointerEvent | React.MouseEvent) => {
    const el = (e.target as Element).closest("[data-cell]");
    return el ? Number(el.getAttribute("data-cell")) : null;
  };
  const local = (e: React.PointerEvent | React.MouseEvent | React.WheelEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as [number, number];
  };
  const fieldScreen = field && field.geometry.type === "Polygon" ? field.geometry.coordinates[0].map(toScreen) : [];

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const vtx = (e.target as Element).getAttribute("data-vertex");
    drag.current = { x: e.clientX, y: e.clientY, moved: false, vertex: vtx !== null ? Number(vtx) : null };
    if (brushZone && cellsVisible) {
      const id = cellAt(e);
      painting.current = new Set(id !== null ? [id] : []);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && (Math.abs(e.clientX - d.x) > 3 || Math.abs(e.clientY - d.y) > 3)) d.moved = true;
    if (d && painting.current) {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell]");
      if (el) painting.current.add(Number(el.getAttribute("data-cell")));
      return;
    }
    if (d?.vertex !== null && d?.vertex !== undefined && field && field.geometry.type === "Polygon") {
      const [sx, sy] = local(e);
      const ll = toLngLat(sx, sy);
      const coords = field.geometry.coordinates[0].slice();
      coords[d.vertex] = ll;
      if (d.vertex === 0) coords[coords.length - 1] = ll;
      useApp.getState().setField({ ...field, geometry: { type: "Polygon", coordinates: [coords] } } as FieldPolygon, { name: useApp.getState().fieldName });
      useApp.setState({ drawMode: "edit-field" });
      return;
    }
    if (d && d.moved && !brushZone) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      setView((v) => ({ ...v, center: unproject([project(v.center, v.zoom)[0] - dx, project(v.center, v.zoom)[1] - dy], v.zoom) }));
      return;
    }
    if (!d && cellsVisible) {
      const id = cellAt(e);
      const [sx, sy] = local(e);
      setHover(id !== null ? { id, x: sx, y: sy } : null);
      if (id !== hoveredCell) useApp.setState({ hoveredCell: id });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (painting.current) {
      const ids = [...painting.current];
      painting.current = null;
      if (brushZone && ids.length) useApp.getState().paintCells(ids, brushZone);
      return;
    }
    if (!d || d.moved || d.vertex !== null) return;
    const [sx, sy] = local(e);
    if (drawMode === "draw-field" || drawMode === "draw-strip") {
      // click near the first vertex (or 3+ points and double-click) finishes the shape
      if (draft.length >= 3) {
        const first = toScreen(draft[0]);
        if (Math.hypot(first[0] - sx, first[1] - sy) < 12) return finish(draft);
      }
      setDraft((p) => [...p, toLngLat(sx, sy)]);
      return;
    }
    if (cellsVisible) useApp.setState({ inspectedCell: cellAt(e) });
  };
  const finish = (pts: [number, number][]) => {
    if (pts.length < 3) return;
    const poly = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } } as FieldPolygon;
    if (drawMode === "draw-strip") useApp.setState({ reference: poly, drawMode: "idle" });
    else {
      useApp.getState().setField(poly, { name: useApp.getState().fieldName === "Audrain County demo field" ? "My field" : useApp.getState().fieldName });
      useApp.setState({ drawMode: "idle" });
    }
    setDraft([]);
  };
  const zoomBy = (dz: number, at?: [number, number]) =>
    setView((v) => {
      const nz = Math.min(MAX_Z, Math.max(MIN_Z, v.zoom + dz));
      if (nz === v.zoom) return v;
      if (!at) return { ...v, zoom: nz };
      // keep the point under the cursor fixed
      const [px, py] = project(v.center, v.zoom);
      const anchor = unproject([px - size.w / 2 + at[0], py - size.h / 2 + at[1]], v.zoom);
      const [ax, ay] = project(anchor, nz);
      return { zoom: nz, center: unproject([ax - at[0] + size.w / 2, ay - at[1] + size.h / 2], nz) };
    });
  const wheelLock = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelLock.current < 180) return;
    wheelLock.current = now;
    zoomBy(e.deltaY < 0 ? 1 : -1, local(e));
  };

  const zc = analysis?.zoning.zoneCount ?? 4;
  const hoverCell = hover && analysis && rx ? analysis.cells[hover.id] : null;
  const cursor = drawMode === "draw-field" || drawMode === "draw-strip" || brushZone ? "crosshair" : "grab";

  return (
    <div
      ref={wrap}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-field-950"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={() => (drawMode === "draw-field" || drawMode === "draw-strip") && finish(draft)}
      onWheel={onWheel}
      role="application"
      aria-label="Satellite map of the field (simple mode). Use the side panel for all actions."
    >
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={t.key} src={IMAGERY(z, t.tx, t.ty)} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: t.x, top: t.y, width: TILE, height: TILE }} />
      ))}
      {z <= 14 &&
        tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`l${t.key}`} src={LABELS(z, t.tx, t.ty)} alt="" draggable={false} className="pointer-events-none absolute opacity-90" style={{ left: t.x, top: t.y, width: TILE, height: TILE }} />
        ))}

      <svg className="absolute inset-0 h-full w-full" width={size.w} height={size.h}>
        {overlay && (() => {
          const [tl, tr, br, bl] = overlay.corners.map(toScreen);
          const x = Math.min(tl[0], bl[0]);
          const y = Math.min(tl[1], tr[1]);
          return <image href={overlay.url} x={x} y={y} width={Math.max(tr[0], br[0]) - x} height={Math.max(bl[1], br[1]) - y} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} opacity={0.95} />;
        })()}
        {cellsVisible &&
          cells.map((c) => (
            <path key={c.id} data-cell={c.id} d={c.d} fill={c.color} fillOpacity={c.dim ? 0.12 : 0.78} stroke={c.id === inspected || c.id === hoveredCell ? "#fff" : "rgba(255,255,255,0.25)"} strokeWidth={c.id === inspected ? 2.5 : c.id === hoveredCell ? 1.6 : 0.4} />
          ))}
        {reference && reference.geometry.type === "Polygon" && <path d={ring(reference.geometry.coordinates[0].map(toScreen))} fill="#f2b14a" fillOpacity={0.25} stroke="#f2b14a" strokeWidth={2} strokeDasharray="6 4" />}
        {fieldScreen.length > 0 && (
          <>
            <path d={ring(fieldScreen)} fill={cellsVisible ? "none" : "rgba(255,255,255,0.08)"} stroke="#0f2a1d" strokeOpacity={0.4} strokeWidth={5} />
            <path d={ring(fieldScreen)} fill="none" stroke="#fff" strokeWidth={2.2} />
            {drawMode === "edit-field" &&
              fieldScreen.slice(0, -1).map((p, i) => <circle key={i} data-vertex={i} cx={p[0]} cy={p[1]} r={7} fill="#15653d" stroke="#fff" strokeWidth={2} style={{ cursor: "move" }} />)}
          </>
        )}
        {draft.length > 0 && (
          <>
            <polyline points={draft.map(toScreen).map((p) => p.join(",")).join(" ")} fill="rgba(255,255,255,0.1)" stroke="#fff" strokeWidth={2.2} />
            {draft.map(toScreen).map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 ? 7 : 5} fill={i === 0 ? "#15653d" : "#fff"} stroke={i === 0 ? "#fff" : "#15653d"} strokeWidth={2} />
            ))}
          </>
        )}
      </svg>

      {hover && hoverCell && rx && analysis && !brushZone && (
        <div className="pointer-events-none absolute z-10 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs shadow-[var(--shadow-float)] ring-1 ring-black/5" style={{ left: Math.min(hover.x + 14, size.w - 190), top: hover.y + 14 }}>
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-sm" style={{ background: zoneColor(rx.zones[hover.id], zc) }} />
            Zone {rx.zones[hover.id]} · {rx.rates[hover.id].toFixed(0)} lb/acre
          </div>
          <div className="mt-0.5 text-muted-foreground tabular">Crop health {Math.round((hoverCell.primary / rx.reference.value) * 100)}%</div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-[10px] bg-white shadow-[var(--shadow-card)]" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button type="button" className="grid size-[29px] place-items-center hover:bg-muted" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button type="button" className="grid size-[29px] place-items-center border-t hover:bg-muted" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
      </div>
      {(drawMode === "draw-field" || drawMode === "draw-strip") && draft.length >= 3 && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={() => finish(draft)}
          className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full bg-field-800 px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-float)]"
        >
          Finish shape
        </button>
      )}
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-white/75 px-1.5 py-0.5 text-[10px] text-foreground/80">Imagery © Esri, Maxar, Earthstar Geographics</div>
    </div>
  );
}

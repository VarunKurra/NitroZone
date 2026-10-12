"use client";

/**
 * Fallback map for browsers WITHOUT WebGL (e.g. Chrome with graphics acceleration turned off).
 * Plain <img> satellite tiles + SVG, built to feel smooth:
 *  - dragging moves one layer with a CSS transform (no React re-render until you let go)
 *  - wheel / button zoom animates with a CSS scale, then swaps in the new tiles
 *  - tiles fade in, with lower-resolution tiles underneath while sharp ones load
 *  - the 2,000+ zone squares are memoized, so hovering only redraws one highlight outline
 */
import { Minus, Plus } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { usePrescription } from "@/hooks/use-prescription";
import { cellFill } from "./cell-colors";
import { MapTools } from "./map-tools";
import { zoneColor } from "@/lib/palette";
import { polygonsOf } from "@/lib/agronomy/geo";
import type { FieldPolygon } from "@/lib/agronomy/types";
import { mapBridge, START_VIEW, type Bounds } from "./map-bridge";

const TILE = 256;
const IMAGERY = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MIN_Z = 5;
const MAX_Z = 18;

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

type Cell = { id: number; d: string; color: string; dim: boolean };

/** All zone squares in one memoized SVG group: re-renders only when data or the view changes. */
const CellLayer = memo(function CellLayer({ cells }: { cells: Cell[] }) {
  return (
    <g>
      {cells.map((c) => (
        <path key={c.id} data-cell={c.id} d={c.d} fill={c.color} fillOpacity={c.dim ? 0.12 : 0.82} stroke="rgba(255,255,255,0.22)" strokeWidth={0.4} />
      ))}
    </g>
  );
});

/** Tiles for one zoom level (plus a one-tile margin), fading in as they load. */
const TileLayer = memo(function TileLayer({ z, ox, oy, w, h, scale = 1 }: { z: number; ox: number; oy: number; w: number; h: number; scale?: number }) {
  const n = 2 ** z;
  const size = TILE * scale;
  const tx0 = Math.floor(ox / size) - 1;
  const tx1 = Math.floor((ox + w) / size) + 1;
  const ty0 = Math.max(0, Math.floor(oy / size) - 1);
  const ty1 = Math.min(n - 1, Math.floor((oy + h) / size) + 1);
  const out = [];
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      out.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${z}/${tx}/${ty}`}
          src={IMAGERY(z, ((tx % n) + n) % n, ty)}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={(e) => (e.currentTarget.style.opacity = "1")}
          className="pointer-events-none absolute max-w-none transition-opacity duration-300"
          style={{ left: tx * size - ox, top: ty * size - oy, width: size, height: size, opacity: 0 }}
        />,
      );
  return <>{out}</>;
});

export default function SimpleMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState(START_VIEW);
  const [draftState, setDraftState] = useState<{ mode: string; pts: [number, number][] }>({ mode: "idle", pts: [] });
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const drag = useRef<{ x0: number; y0: number; dx: number; dy: number; moved: boolean; vertex: number | null } | null>(null);
  const painting = useRef<Set<number> | null>(null);
  const zooming = useRef(false);
  // zoom level of the previous view: its (cached) tiles stay underneath during big zoom jumps
  const [prevZoom, setPrevZoom] = useState<number | null>(null);
  const lastZoom = useRef(START_VIEW.zoom);

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
  const drawing = drawMode === "draw-field" || drawMode === "draw-strip";
  const draft = draftState.mode === drawMode ? draftState.pts : [];
  const setDraft = (u: [number, number][] | ((p: [number, number][]) => [number, number][])) =>
    setDraftState((d) => ({ mode: drawMode, pts: typeof u === "function" ? u(d.mode === drawMode ? d.pts : []) : u }));

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // After a committed view change, drop the temporary drag/zoom transform in the same frame.
  useLayoutEffect(() => {
    if (layer.current) {
      layer.current.style.transition = "none";
      layer.current.style.transform = "";
    }
    zooming.current = false;
    if (lastZoom.current !== view.zoom) {
      setPrevZoom(lastZoom.current);
      lastZoom.current = view.zoom;
    }
  }, [view]);

  const z = view.zoom;
  const [cx, cy] = project(view.center, z);
  const ox = cx - size.w / 2;
  const oy = cy - size.h / 2;
  const toScreen = useCallback((p: number[]): [number, number] => {
    const [x, y] = project(p, z);
    return [x - ox, y - oy];
  }, [z, ox, oy]);
  const toLngLat = useCallback((sx: number, sy: number) => unproject([sx + ox, sy + oy], z), [z, ox, oy]);

  const fitBounds = useCallback((b: Bounds, padding: number) => {
    const el = wrap.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    const left = useApp.getState().step !== "results" && w > 900 ? Math.min(440, w * 0.46) : 0;
    let zoom = MAX_Z - 1;
    for (; zoom > MIN_Z; zoom--) {
      const [x0, y1] = project(b[0], zoom);
      const [x1, y0] = project(b[1], zoom);
      if (x1 - x0 <= w - left - 2 * padding && y1 - y0 <= h - 2 * padding) break;
    }
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

  // ---- zone squares (recomputed only when data or the committed view changes)
  const showCells = step === "rates" || step === "results";
  const cellsVisible = showCells && mapLayer !== "truecolor";
  const cells = useMemo<Cell[]>(() => {
    if (!analysis || !rx || !cellsVisible) return [];
    const fill = cellFill(analysis, rx, mapLayer);
    return analysis.cells.map((c, i) => {
      const zn = rx.zones[i];
      const out = valueRange ? !(c[valueRange.key] >= valueRange.min && c[valueRange.key] <= valueRange.max) : false;
      return { id: c.id, d: ring(c.ringsLngLat[0].map(toScreen)), color: fill(i), dim: (zoneFilter.length > 0 && !zoneFilter.includes(zn)) || out };
    });
  }, [analysis, rx, cellsVisible, mapLayer, zoneFilter, valueRange, toScreen]);
  const cellById = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);

  // ---- pointer helpers
  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as [number, number];
  };
  const cellAtPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest("[data-cell]");
    return el ? Number(el.getAttribute("data-cell")) : null;
  };

  // ---- smooth zoom: animate a CSS scale around a point, then commit the new zoom level
  const zoomBy = (dz: number, at?: [number, number]) => {
    const nz = Math.min(MAX_Z, Math.max(MIN_Z, view.zoom + dz));
    if (nz === view.zoom || zooming.current) return;
    zooming.current = true;
    const p = at ?? [size.w / 2, size.h / 2];
    const anchor = toLngLat(p[0], p[1]);
    const commit = () => {
      const [ax, ay] = project(anchor, nz);
      setView({ zoom: nz, center: unproject([ax - p[0] + size.w / 2, ay - p[1] + size.h / 2], nz) });
    };
    const el = layer.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return commit();
    el.style.transformOrigin = `${p[0]}px ${p[1]}px`;
    el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = `scale(${2 ** (nz - view.zoom)})`;
    setTimeout(commit, 220);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 4) return;
    zoomBy(e.deltaY < 0 ? 1 : -1, local(e));
  };

  const fieldScreen = field && field.geometry.type === "Polygon" ? field.geometry.coordinates[0].map(toScreen) : [];

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-ui]")) return;
    wrap.current?.setPointerCapture(e.pointerId);
    const vtx = (e.target as Element).getAttribute("data-vertex");
    drag.current = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false, vertex: vtx !== null ? Number(vtx) : null };
    if (brushZone && cellsVisible) {
      const id = cellAtPoint(e.clientX, e.clientY);
      painting.current = new Set(id !== null ? [id] : []);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) {
      d.dx = e.clientX - d.x0;
      d.dy = e.clientY - d.y0;
      if (Math.abs(d.dx) > 3 || Math.abs(d.dy) > 3) d.moved = true;
      if (painting.current) {
        const id = cellAtPoint(e.clientX, e.clientY);
        if (id !== null) painting.current.add(id);
        return;
      }
      if (d.vertex !== null && field && field.geometry.type === "Polygon") {
        const [sx, sy] = local(e);
        const ll = toLngLat(sx, sy);
        const coords = field.geometry.coordinates[0].slice();
        coords[d.vertex] = ll;
        if (d.vertex === 0) coords[coords.length - 1] = ll;
        useApp.getState().setField({ ...field, geometry: { type: "Polygon", coordinates: [coords] } } as FieldPolygon, { name: useApp.getState().fieldName });
        useApp.setState({ drawMode: "edit-field" });
        return;
      }
      // pan: move the whole layer with a transform, commit on release
      if (d.moved && layer.current) {
        layer.current.style.transition = "none";
        layer.current.style.transform = `translate(${d.dx}px, ${d.dy}px)`;
      }
      return;
    }
    if (cellsVisible && !brushZone) {
      const id = cellAtPoint(e.clientX, e.clientY);
      if (id !== (hover?.id ?? null)) {
        const [sx, sy] = local(e);
        setHover(id !== null ? { id, x: sx, y: sy } : null);
        useApp.setState({ hoveredCell: id });
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (painting.current) {
      const ids = [...painting.current];
      painting.current = null;
      if (brushZone && ids.length) useApp.getState().paintCells(ids, brushZone);
      return;
    }
    if (d.vertex !== null) return;
    if (d.moved) {
      setView((v) => {
        const [px, py] = project(v.center, v.zoom);
        return { ...v, center: unproject([px - d.dx, py - d.dy], v.zoom) };
      });
      return;
    }
    const [sx, sy] = local(e);
    if (drawing) {
      if (draft.length >= 3) {
        const first = toScreen(draft[0]);
        if (Math.hypot(first[0] - sx, first[1] - sy) < 12) return finish(draft);
      }
      setDraft((p) => [...p, toLngLat(sx, sy)]);
      return;
    }
    if (cellsVisible) useApp.setState({ inspectedCell: cellAtPoint(e.clientX, e.clientY) });
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

  const zc = analysis?.zoning.zoneCount ?? 4;
  const hoverCell = hover && analysis && rx ? analysis.cells[hover.id] : null;
  const highlight = [inspected, hoveredCell].filter((id): id is number => id !== null && cellById.has(id));

  return (
    <div
      ref={wrap}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-[#2a3a2c]"
      style={{ cursor: drawing || brushZone ? "crosshair" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={() => drawing && finish(draft)}
      onWheel={onWheel}
      role="application"
      aria-label="Satellite map of the field. Use the side panel for all actions."
    >
      <div ref={layer} className="absolute inset-0 will-change-transform">
        {/* low-res tiles underneath (usually cached already), so there are no blank gaps while sharp tiles load */}
        {prevZoom !== null && prevZoom !== z && prevZoom !== z - 1 && prevZoom >= z - 3 && (
          <TileLayer z={prevZoom} ox={ox} oy={oy} w={size.w} h={size.h} scale={2 ** (z - prevZoom)} />
        )}
        {z > MIN_Z && <TileLayer z={z - 1} ox={ox} oy={oy} w={size.w} h={size.h} scale={2} />}
        <TileLayer z={z} ox={ox} oy={oy} w={size.w} h={size.h} />
        <svg className="absolute inset-0 h-full w-full overflow-visible" width={size.w} height={size.h}>
          {cellsVisible && <CellLayer cells={cells} />}
          {highlight.map((id) => (
            <path key={`hl${id}`} d={cellById.get(id)!.d} fill="none" stroke="#fff" strokeWidth={id === inspected ? 2.5 : 1.6} pointerEvents="none" />
          ))}
          {reference && reference.geometry.type === "Polygon" && (
            <path d={ring(reference.geometry.coordinates[0].map(toScreen))} fill="#f2b14a" fillOpacity={0.25} stroke="#f2b14a" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
          )}
          {fieldScreen.length > 0 && (
            <>
              <path d={ring(fieldScreen)} fill={cellsVisible ? "none" : "rgba(255,255,255,0.06)"} stroke="#0f2a1d" strokeOpacity={0.4} strokeWidth={5} pointerEvents="none" />
              <path d={ring(fieldScreen)} fill="none" stroke="#fff" strokeWidth={2.2} pointerEvents="none" />
              {drawMode === "edit-field" &&
                fieldScreen.slice(0, -1).map((p, i) => <circle key={i} data-vertex={i} cx={p[0]} cy={p[1]} r={7} fill="#15653d" stroke="#fff" strokeWidth={2} style={{ cursor: "move" }} />)}
            </>
          )}
          {draft.length > 0 && (
            <>
              <polyline points={draft.map(toScreen).map((p) => p.join(",")).join(" ")} fill="rgba(255,255,255,0.12)" stroke="#fff" strokeWidth={2.2} pointerEvents="none" />
              {draft.map(toScreen).map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 ? 7 : 5} fill={i === 0 ? "#15653d" : "#fff"} stroke={i === 0 ? "#fff" : "#15653d"} strokeWidth={2} pointerEvents="none" />
              ))}
            </>
          )}
        </svg>
      </div>

      {hover && hoverCell && rx && analysis && !brushZone && (
        <div className="pointer-events-none absolute z-10 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs shadow-[var(--shadow-float)] ring-1 ring-black/5" style={{ left: Math.min(hover.x + 14, size.w - 190), top: hover.y + 14 }}>
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-sm" style={{ background: zoneColor(rx.zones[hover.id], zc) }} />
            Zone {rx.zones[hover.id]} · {rx.rates[hover.id].toFixed(0)} lb/acre
          </div>
          <div className="mt-0.5 text-muted-foreground tabular">Crop health {Math.round((hoverCell.primary / rx.reference.value) * 100)}%</div>
        </div>
      )}

      <MapTools />

      <div data-ui className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-[10px] bg-white shadow-[var(--shadow-card)]">
        <button type="button" className="grid size-[30px] place-items-center hover:bg-muted" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button type="button" className="grid size-[30px] place-items-center border-t hover:bg-muted" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
      </div>
      {drawing && draft.length >= 3 && (
        <button data-ui type="button" onClick={() => finish(draft)} className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full bg-field-800 px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-float)]">
          Finish outline
        </button>
      )}
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-white/75 px-1.5 py-0.5 text-[10px] text-foreground/80">Imagery © Esri, Maxar, Earthstar Geographics</div>
    </div>
  );
}

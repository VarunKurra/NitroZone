"use client";

/**
 * The one map. MapLibre GL + Esri World Imagery, with:
 *  - Terra Draw for drawing/editing the field boundary and the N-rich strip
 *  - prescription cells (zones / N rate) as a vector layer, index heat maps as an image overlay
 *  - the "reveal" sweep when a prescription is generated
 *  - hover, click-to-inspect, keyboard cell navigation and brush painting of zones
 */
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent, MapTouchEvent } from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRenderMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { useApp } from "@/store/app-store";
import { usePrescription } from "@/hooks/use-prescription";
import { RATE_RAMP, rampColor, zoneColor } from "@/lib/palette";
import { mapBridge } from "./map-bridge";
import { indexImage, stretchOf, trueColorImage } from "./raster-image";
import { polygonsOf } from "@/lib/agronomy/geo";
import type { FieldPolygon } from "@/lib/agronomy/types";

const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ESRI_ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
// shifted west so Missouri sits in the open area to the right of the step panel
const MISSOURI: [number, number] = [-94.1, 38.4];

// Served from /public (copied on npm install), see scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function FieldMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ id: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipPos = useRef("translate(0px, 0px)");

  const field = useApp((s) => s.field);
  const reference = useApp((s) => s.reference);
  const drawMode = useApp((s) => s.drawMode);
  const analysis = useApp((s) => s.analysis);
  const analysisVersion = useApp((s) => s.analysisVersion);
  const step = useApp((s) => s.step);
  const mapLayer = useApp((s) => s.mapLayer);
  const zoneFilter = useApp((s) => s.zoneFilter);
  const valueRange = useApp((s) => s.valueRange);
  const inspected = useApp((s) => s.inspectedCell);
  const brushZone = useApp((s) => s.brushZone);
  const generated = useApp((s) => s.generated);
  const rx = usePrescription();

  // ------------------------------------------------------------------ create map
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          imagery: { type: "raster", tiles: [ESRI_IMAGERY], tileSize: 256, maxzoom: 19, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, and the GIS User Community" },
          roads: { type: "raster", tiles: [ESRI_ROADS], tileSize: 256, maxzoom: 19 },
          labels: { type: "raster", tiles: [ESRI_LABELS], tileSize: 256, maxzoom: 19 },
        },
        layers: [
          { id: "imagery", type: "raster", source: "imagery", paint: { "raster-fade-duration": 250 } },
          { id: "roads", type: "raster", source: "roads", paint: { "raster-opacity": 0.55 } },
          { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.9 } },
        ],
      },
      center: MISSOURI,
      zoom: 6.3,
      maxZoom: 18.5,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial", maxWidth: 110 }), "bottom-right");
    map.getCanvas().setAttribute("aria-label", "Satellite map of the field. Use the side panel for all actions.");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("overlay", { type: "image", url: transparentPng(), coordinates: [[0, 0], [1, 0], [1, -1], [0, -1]] });
      map.addLayer({ id: "overlay", type: "raster", source: "overlay", paint: { "raster-opacity": 0, "raster-fade-duration": 0, "raster-resampling": "nearest" } });

      map.addSource("cells", { type: "geojson", data: EMPTY, promoteId: "id" });
      map.addLayer({
        id: "cells-fill",
        type: "fill",
        source: "cells",
        paint: {
          "fill-color": ["case", ["boolean", ["feature-state", "painted"], false], "#ffffff", ["get", "color"]],
          "fill-opacity": 0,
          "fill-antialias": false,
        },
      });
      map.addLayer({
        id: "cells-line",
        type: "line",
        source: "cells",
        minzoom: 14.2,
        paint: { "line-color": "#ffffff", "line-opacity": 0, "line-width": 0.4 },
      });
      map.addLayer({
        id: "cells-focus",
        type: "line",
        source: "cells",
        paint: {
          "line-color": "#ffffff",
          "line-width": ["case", ["boolean", ["feature-state", "inspected"], false], 3, 2],
          "line-opacity": ["case", ["any", ["boolean", ["feature-state", "inspected"], false], ["boolean", ["feature-state", "hover"], false]], 1, 0],
        },
      });

      map.addSource("strip", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "strip-fill", type: "fill", source: "strip", paint: { "fill-color": "#f2b14a", "fill-opacity": 0.25 } });
      map.addLayer({ id: "strip-line", type: "line", source: "strip", paint: { "line-color": "#f2b14a", "line-width": 2, "line-dasharray": [2, 1.5] } });

      map.addSource("field", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "field-fill", type: "fill", source: "field", paint: { "fill-color": "#ffffff", "fill-opacity": 0.08 } });
      map.addLayer({ id: "field-halo", type: "line", source: "field", paint: { "line-color": "#0f2a1d", "line-width": 5, "line-opacity": 0.35, "line-blur": 2 } });
      map.addLayer({ id: "field-line", type: "line", source: "field", paint: { "line-color": "#ffffff", "line-width": 2.25 } });

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPolygonMode({
            styles: { fillColor: "#ffffff", fillOpacity: 0.12, outlineColor: "#ffffff", outlineWidth: 2.5, closingPointColor: "#15653d", closingPointOutlineColor: "#ffffff", closingPointWidth: 6, closingPointOutlineWidth: 2 },
          }),
          new TerraDrawPolygonMode({
            modeName: "strip",
            styles: { fillColor: "#f2b14a", fillOpacity: 0.3, outlineColor: "#f2b14a", outlineWidth: 2, closingPointColor: "#b46c0a", closingPointOutlineColor: "#ffffff", closingPointWidth: 6, closingPointOutlineWidth: 2 },
          }),
          new TerraDrawSelectMode({
            flags: {
              polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
              strip: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
            },
            styles: { selectedPolygonColor: "#ffffff", selectedPolygonFillOpacity: 0.12, selectedPolygonOutlineColor: "#ffffff", selectedPolygonOutlineWidth: 2.5, selectionPointColor: "#15653d", selectionPointOutlineColor: "#ffffff", selectionPointWidth: 6, selectionPointOutlineWidth: 2, midPointColor: "#ffffff", midPointOutlineColor: "#15653d", midPointWidth: 4 },
          }),
          new TerraDrawRenderMode({ modeName: "render", styles: {} }),
        ],
      });
      draw.start();
      draw.setMode("render");
      draw.on("finish", (id, ctx) => {
        const f = draw.getSnapshotFeature(id);
        if (!f || f.geometry.type !== "Polygon") return;
        const poly = { type: "Feature", properties: {}, geometry: f.geometry } as FieldPolygon;
        const st = useApp.getState();
        if (ctx.mode === "strip" || f.properties.mode === "strip") {
          useApp.setState({ reference: poly, drawMode: "idle" });
        } else if (ctx.action === "draw") {
          st.setField(poly, { name: st.fieldName === "Audrain County demo field" ? "My field" : st.fieldName });
          useApp.setState({ drawMode: "idle" });
        } else {
          // vertex drag / midpoint insert / feature drag while editing
          st.setField(poly, { name: st.fieldName, savedFieldId: null });
          useApp.setState({ drawMode: "edit-field" });
        }
      });
      drawRef.current = draw;
      mapBridge.set({
        flyTo: (center, zoom) => map.flyTo({ center, zoom, duration: reducedMotion() ? 0 : 1600, essential: true }),
        fitBounds: (b, padding) => map.fitBounds(b, { padding, duration: reducedMotion() ? 0 : 1200, maxZoom: 17 }),
      });
      setReady(true);
    });

    return () => {
      mapBridge.set(null);
      drawRef.current?.stop();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ------------------------------------------------------- field + strip sources
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const editingField = drawMode === "edit-field" || drawMode === "draw-field";
    (map.getSource("field") as GeoJSONSource).setData(field && !editingField ? field : EMPTY);
    (map.getSource("strip") as GeoJSONSource).setData(reference && drawMode !== "draw-strip" ? reference : EMPTY);
  }, [ready, field, reference, drawMode]);

  // Fit to a new field (demo, saved, imported) when it isn't being edited by hand.
  const fieldKey = field ? JSON.stringify(polygonsOf(field.geometry)[0][0].slice(0, 3)) : "";
  useEffect(() => {
    if (!ready || !field || drawMode !== "idle") return;
    const b = new maplibregl.LngLatBounds();
    for (const rings of polygonsOf(field.geometry)) for (const p of rings[0]) b.extend(p as [number, number]);
    mapRef.current?.fitBounds(b, { padding: { top: 80, bottom: 80, left: 80, right: 80 }, duration: reducedMotion() ? 0 : 1400, maxZoom: 16.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fieldKey]);

  // ------------------------------------------------------------- draw modes
  useEffect(() => {
    const draw = drawRef.current;
    if (!ready || !draw) return;
    draw.clear();
    if (drawMode === "draw-field") draw.setMode("polygon");
    else if (drawMode === "draw-strip") draw.setMode("strip");
    else if (drawMode === "edit-field" && field && field.geometry.type === "Polygon") {
      const [id] = [crypto.randomUUID()];
      draw.addFeatures([{ id, type: "Feature", properties: { mode: "polygon" }, geometry: field.geometry }]);
      draw.setMode("select");
      draw.selectFeature(id);
    } else draw.setMode("render");
    // Only react to mode switches; field updates while editing come FROM terra-draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drawMode]);

  // --------------------------------------------------------------- cells data
  const showCells = step === "rates" || step === "results";
  const cellData = useMemo<FeatureCollection<Polygon>>(() => {
    if (!analysis || !rx || !showCells) return EMPTY as FeatureCollection<Polygon>;
    const zc = analysis.zoning.zoneCount;
    let rMin = Infinity;
    let rMax = -Infinity;
    for (const r of rx.rates) {
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    const span = rMax - rMin || 1;
    const rows = analysis.rows || 1;
    const features: Feature<Polygon>[] = [];
    analysis.cells.forEach((c, i) => {
      const z = rx.zones[i];
      const color =
        mapLayer === "rate"
          ? rgbHex(rampColor(RATE_RAMP, (rx.rates[i] - rMin) / span))
          : zoneColor(z, zc);
      const outOfRange = valueRange ? !(c[valueRange.key] >= valueRange.min && c[valueRange.key] <= valueRange.max) : false;
      const dim = (zoneFilter.length > 0 && !zoneFilter.includes(z)) || outOfRange;
      // reveal order: north to south with a slight diagonal, so the sweep feels like a scan
      const order = (c.row + c.col * 0.18) / (rows + analysis.cols * 0.18);
      for (const ring of c.ringsLngLat.slice(0, 1))
        features.push({ type: "Feature", id: c.id, properties: { id: c.id, color, dim, order, zone: z }, geometry: { type: "Polygon", coordinates: [ring] } });
    });
    return { type: "FeatureCollection", features };
  }, [analysis, rx, mapLayer, zoneFilter, valueRange, showCells]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("cells") as GeoJSONSource).setData(cellData);
  }, [ready, cellData]);

  // ------------------------------------------------------- cell opacity + reveal
  const revealRef = useRef(1);
  const cellsVisible = showCells && (mapLayer === "zones" || mapLayer === "rate");
  const applyCellPaint = (reveal: number) => {
    const map = mapRef.current;
    if (!map?.getLayer("cells-fill")) return;
    const base = step === "results" || generated ? 0.78 : 0.62;
    map.setPaintProperty("cells-fill", "fill-opacity", cellsVisible ? ["case", ["<", ["get", "order"], reveal], ["case", ["get", "dim"], 0.12, base], 0] : 0);
    map.setPaintProperty("cells-line", "line-opacity", cellsVisible ? ["case", ["<", ["get", "order"], reveal], 0.32, 0] : 0.18);
  };
  useEffect(() => {
    if (!ready) return;
    applyCellPaint(revealRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cellsVisible, step, generated, cellData]);

  // Replay the sweep whenever a new analysis lands or the prescription is generated.
  useEffect(() => {
    if (!ready || !analysis) return;
    if (reducedMotion()) {
      revealRef.current = 1.01;
      applyCellPaint(1.01);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1500;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      revealRef.current = eased * 1.02;
      applyCellPaint(revealRef.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, analysisVersion, generated]);

  // ------------------------------------------------------------- raster overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !analysis) return;
    const src = map.getSource("overlay") as maplibregl.ImageSource;
    const p = analysis.preview;
    let url: string | null = null;
    if (showCells && (mapLayer === "primary" || mapLayer === "secondary")) url = indexImage(p, mapLayer, stretchOf(p[mapLayer]));
    else if (showCells && mapLayer === "truecolor") url = trueColorImage(p);
    if (url) {
      src.updateImage({ url, coordinates: p.corners });
      map.setPaintProperty("overlay", "raster-opacity", 0.95);
    } else map.setPaintProperty("overlay", "raster-opacity", 0);
  }, [ready, analysis, mapLayer, showCells]);

  // --------------------------------------------------- hover / inspect state
  const prevInspected = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getSource("cells")) return;
    if (prevInspected.current !== null) map.setFeatureState({ source: "cells", id: prevInspected.current }, { inspected: false });
    if (inspected !== null) map.setFeatureState({ source: "cells", id: inspected }, { inspected: true });
    prevInspected.current = inspected;
  }, [ready, inspected, cellData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let hovered: number | null = null;
    const setHover = (id: number | null) => {
      hovered = id;
      useApp.setState({ hoveredCell: id });
    };
    const onMove = (e: MapMouseEvent) => {
      if (useApp.getState().drawMode !== "idle") return;
      const f = map.queryRenderedFeatures(e.point, { layers: ["cells-fill"] })[0];
      const id = f ? Number(f.id) : null;
      if (id !== hovered) setHover(id);
      map.getCanvas().style.cursor = id !== null ? (useApp.getState().brushZone ? "crosshair" : "pointer") : "";
      // Only re-render React when the hovered cell changes; move the tooltip directly.
      setHoverInfo((prev) => (prev?.id === id ? prev : id !== null ? { id } : null));
      tipPos.current = `translate(${Math.min(e.point.x + 14, map.getContainer().clientWidth - 190)}px, ${e.point.y + 14}px)`;
      if (tipRef.current) tipRef.current.style.transform = tipPos.current;
    };
    const onLeave = () => {
      setHover(null);
      setHoverInfo(null);
    };
    const onClick = (e: MapMouseEvent) => {
      const st = useApp.getState();
      if (st.drawMode !== "idle" || st.brushZone) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ["cells-fill"] })[0];
      useApp.setState({ inspectedCell: f ? Number(f.id) : null });
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
      map.off("click", onClick);
    };
  }, [ready]);

  // Hover highlight comes from the store, so chart hovers light up map cells too.
  const hoveredCell = useApp((s) => s.hoveredCell);
  const prevHovered = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getSource("cells")) return;
    if (prevHovered.current !== null) map.setFeatureState({ source: "cells", id: prevHovered.current }, { hover: false });
    if (hoveredCell !== null) map.setFeatureState({ source: "cells", id: hoveredCell }, { hover: true });
    prevHovered.current = hoveredCell;
  }, [ready, hoveredCell, cellData]);

  // ----------------------------------------------------------- brush painting
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (brushZone && analysis) map.setPaintProperty("cells-fill", "fill-color", ["case", ["boolean", ["feature-state", "painted"], false], zoneColor(brushZone, analysis.zoning.zoneCount), ["get", "color"]]);
    let painting = false;
    const pending = new Set<number>();
    const add = (pt: maplibregl.PointLike) => {
      const f = map.queryRenderedFeatures(pt, { layers: ["cells-fill"] })[0];
      if (!f) return;
      const id = Number(f.id);
      if (pending.has(id)) return;
      pending.add(id);
      map.setFeatureState({ source: "cells", id }, { painted: true });
    };
    const down = (e: MapMouseEvent | MapTouchEvent) => {
      if (!useApp.getState().brushZone) return;
      painting = true;
      map.dragPan.disable();
      add(e.point);
    };
    const move = (e: MapMouseEvent | MapTouchEvent) => {
      if (painting) add(e.point);
    };
    const up = () => {
      if (!painting) return;
      painting = false;
      map.dragPan.enable();
      const z = useApp.getState().brushZone;
      const ids = [...pending];
      for (const id of ids) map.setFeatureState({ source: "cells", id }, { painted: false });
      pending.clear();
      if (z && ids.length) useApp.getState().paintCells(ids, z);
    };
    map.on("mousedown", down);
    map.on("touchstart", down);
    map.on("mousemove", move);
    map.on("touchmove", move);
    map.on("mouseup", up);
    map.on("touchend", up);
    window.addEventListener("mouseup", up);
    return () => {
      map.off("mousedown", down);
      map.off("touchstart", down);
      map.off("mousemove", move);
      map.off("touchmove", move);
      map.off("mouseup", up);
      map.off("touchend", up);
      window.removeEventListener("mouseup", up);
      map.dragPan.enable();
    };
  }, [ready, brushZone, analysis]);

  // -------------------------------------------------------------- zone labels
  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const map = mapRef.current;
    if (!ready || !map || !analysis || !rx || !showCells || mapLayer !== "zones") return;
    const handle = setTimeout(() => {
      for (const lab of zoneLabelPoints(analysis, rx.zones)) {
        const el = document.createElement("div");
        el.className = "pointer-events-none select-none rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-md ring-1 ring-white/70 tabular";
        el.style.background = zoneColor(lab.zone, analysis.zoning.zoneCount);
        el.textContent = `Z${lab.zone}`;
        el.setAttribute("aria-hidden", "true");
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(lab.at).addTo(map));
      }
    }, reducedMotion() ? 0 : 900);
    return () => clearTimeout(handle);
  }, [ready, analysis, rx, showCells, mapLayer]);

  // ------------------------------------------------- keyboard cell navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useApp.getState();
      if (!st.analysis || st.inspectedCell === null) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=slider], select, [contenteditable]")) return;
      const dirs: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (e.key === "Escape") return useApp.setState({ inspectedCell: null });
      const d = dirs[e.key];
      if (!d) return;
      const cell = st.analysis.cells[st.inspectedCell];
      const { cols, rows, lookup } = st.analysis;
      for (let k = 1; k < Math.max(cols, rows); k++) {
        const r = cell.row + d[0] * k;
        const c = cell.col + d[1] * k;
        if (r < 0 || c < 0 || r >= rows || c >= cols) break;
        const idx = lookup[r * cols + c];
        if (idx >= 0) {
          e.preventDefault();
          useApp.setState({ inspectedCell: idx });
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // place a freshly mounted tooltip at the last pointer position
  useLayoutEffect(() => {
    if (tipRef.current) tipRef.current.style.transform = tipPos.current;
  }, [hoverInfo]);

  const hoverCell = hoverInfo && analysis && rx ? analysis.cells[hoverInfo.id] : null;
  return (
    <div className="relative h-full w-full overflow-hidden bg-field-950">
      <div ref={container} className="h-full w-full" />
      {hoverInfo && hoverCell && rx && showCells && !brushZone && (
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs shadow-[var(--shadow-float)] ring-1 ring-black/5"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 rounded-sm" style={{ background: zoneColor(rx.zones[hoverInfo.id], analysis!.zoning.zoneCount) }} />
            Zone {rx.zones[hoverInfo.id]} · {rx.rates[hoverInfo.id].toFixed(0)} lb/acre
          </div>
          <div className="mt-0.5 text-muted-foreground tabular">
            Crop health {Math.round((hoverCell.primary / rx.reference.value) * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}

function rgbHex([r, g, b]: [number, number, number]) {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function transparentPng() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
}

/** One label per sizeable connected zone patch, placed at the patch's most central cell. */
function zoneLabelPoints(analysis: NonNullable<ReturnType<typeof useApp.getState>["analysis"]>, zones: Int8Array) {
  const { cells, cols, rows, lookup } = analysis;
  const seen = new Int8Array(cells.length);
  const out: { zone: number; at: [number, number] }[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (seen[i]) continue;
    const z = zones[i];
    const stack = [i];
    seen[i] = 1;
    const members: number[] = [];
    let area = 0;
    while (stack.length) {
      const j = stack.pop()!;
      members.push(j);
      area += cells[j].areaAc;
      const c = cells[j];
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = c.row + dr;
        const cc = c.col + dc;
        if (r < 0 || cc < 0 || r >= rows || cc >= cols) continue;
        const k = lookup[r * cols + cc];
        if (k >= 0 && !seen[k] && zones[k] === z) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    if (area < 3) continue;
    // most "interior" member: max distance to a member with a different neighbour (approx by centroid closeness)
    const cr = members.reduce((s, m) => s + cells[m].row, 0) / members.length;
    const cc = members.reduce((s, m) => s + cells[m].col, 0) / members.length;
    let best = members[0];
    let bestD = Infinity;
    for (const m of members) {
      const d = (cells[m].row - cr) ** 2 + (cells[m].col - cc) ** 2;
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    out.push({ zone: z, at: cells[best].center });
  }
  return out.slice(0, 24);
}

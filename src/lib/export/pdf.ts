/**
 * One-page PDF field report (US Letter). The zone map is drawn as vector polygons so it
 * stays sharp when printed. Everything comes from the same ReportContext as the other files.
 */
import { jsPDF } from "jspdf";
import { hexToRgb, zoneColor, zoneLabel } from "@/lib/palette";
import { polygonsOf } from "@/lib/agronomy/geo";
import { DISCLAIMER, indexNames, type ReportContext } from "./formats";

export interface PdfFonts {
  /** Base64 TTF data for a regular and a bold weight (optional; Helvetica otherwise). */
  regular?: string;
  bold?: string;
}

const INK: [number, number, number] = [22, 27, 24];
const MUTED: [number, number, number] = [92, 99, 94];
const LINE: [number, number, number] = [226, 228, 222];
const BRAND: [number, number, number] = [21, 101, 61];

export function buildPdf(ctx: ReportContext, fonts: PdfFonts = {}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let family = "helvetica";
  if (fonts.regular && fonts.bold) {
    doc.addFileToVFS("NZ-Regular.ttf", fonts.regular);
    doc.addFont("NZ-Regular.ttf", "NZ", "normal");
    doc.addFileToVFS("NZ-Bold.ttf", fonts.bold);
    doc.addFont("NZ-Bold.ttf", "NZ", "bold");
    family = "NZ";
  }
  const W = 612;
  const M = 36;
  const font = (style: "normal" | "bold", size: number, color = INK) => {
    doc.setFont(family, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const names = indexNames(ctx.scene);
  const t = ctx.totals;
  const fmt = (v: number, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------- Header ----------
  doc.setFillColor(...BRAND);
  doc.roundedRect(M, M, 22, 22, 5, 5, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.6);
  doc.line(M + 6, M + 16, M + 6, M + 6);
  doc.line(M + 6, M + 6, M + 16, M + 16);
  doc.line(M + 16, M + 16, M + 16, M + 6);
  font("bold", 15);
  doc.text("NitroZone", M + 30, M + 11);
  font("normal", 8.5, MUTED);
  doc.text("Variable-rate nitrogen prescription  |  Estimated, review before applying", M + 30, M + 22);
  font("normal", 8.5, MUTED);
  doc.text(`Generated ${ctx.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`, W - M, M + 11, { align: "right" });
  doc.text(`${ctx.scene.source === "synthetic" ? "SYNTHETIC DATA - DEMONSTRATION ONLY" : "Corn, in-season sidedress"}`, W - M, M + 22, { align: "right" });

  font("bold", 20);
  doc.text(ctx.fieldName, M, M + 56);
  font("normal", 9.5, MUTED);
  const imageryLine = `${fmt(t.areaAc, 1)} acres  |  ${ctx.scene.provider}${ctx.scene.acquired ? `  |  imagery ${ctx.scene.acquired.slice(0, 10)}` : ""}${
    ctx.scene.sceneCloudPct !== null ? `  |  scene cloud ${fmt(ctx.scene.sceneCloudPct, 1)}%` : ""
  }`;
  doc.text(doc.splitTextToSize(imageryLine, W - 2 * M), M, M + 72);

  // ---------- Map ----------
  const mapX = M;
  const mapY = M + 88;
  const mapW = 300;
  const mapH = 330;
  doc.setFillColor(247, 247, 243);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.roundedRect(mapX, mapY, mapW, mapH, 6, 6, "FD");
  const polys = polygonsOf(ctx.field.geometry);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of polys)
    for (const [x, y] of rings[0]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const kx = Math.cos(((minY + maxY) / 2) * (Math.PI / 180)); // shrink longitude so the map isn't stretched
  const pad = 18;
  const scale = Math.min((mapW - 2 * pad) / ((maxX - minX) * kx), (mapH - 2 * pad - 14) / (maxY - minY));
  const ox = mapX + (mapW - (maxX - minX) * kx * scale) / 2;
  const oy = mapY + 14 + (mapH - 14 - (maxY - minY) * scale) / 2;
  const P = (x: number, y: number): [number, number] => [ox + (x - minX) * kx * scale, oy + (maxY - y) * scale];
  const path = (ring: number[][], style: "F" | "S" | "FD") => {
    const pts = ring.map((p) => P(p[0], p[1]));
    const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
  };
  ctx.cells.forEach((cell, i) => {
    const [r, g, b] = hexToRgb(zoneColor(ctx.zones[i], ctx.zoneCount));
    doc.setFillColor(r, g, b);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.3);
    for (const ring of cell.ringsLngLat.slice(0, 1)) path(ring, "FD");
  });
  doc.setDrawColor(...INK);
  doc.setLineWidth(1.1);
  for (const rings of polys) for (const ring of rings) path(ring, "S");
  // north arrow
  font("bold", 8, INK);
  doc.text("N", mapX + mapW - 16, mapY + 16, { align: "center" });
  doc.setFillColor(...INK);
  doc.triangle(mapX + mapW - 16, mapY + 20, mapX + mapW - 20, mapY + 30, mapX + mapW - 12, mapY + 30, "F");
  // scale bar: 200 m
  const metersPerDegLon = 111_320 * kx;
  const barM = 200;
  const barPt = (barM / metersPerDegLon) * kx * scale;
  doc.setDrawColor(...INK);
  doc.setLineWidth(1.2);
  doc.line(mapX + 12, mapY + mapH - 12, mapX + 12 + barPt, mapY + mapH - 12);
  font("normal", 7, MUTED);
  doc.text(`${barM} m`, mapX + 12 + barPt + 4, mapY + mapH - 9.5);
  font("normal", 7, MUTED);
  doc.text(`Zone map, ${ctx.cellSizeM} m grid`, mapX + 12, mapY + 14);

  // ---------- Legend / zone table ----------
  const tx = mapX + mapW + 20;
  const tw = W - M - tx;
  let y = mapY + 6;
  font("bold", 10.5);
  doc.text("Zones and rates", tx, y + 6);
  y += 18;
  const cols = [0, 64, 108, 152, 196];
  font("bold", 7.5, MUTED);
  ["ZONE", "ACRES", "SI", "LB N/AC", "TOTAL LB"].forEach((h, i) => doc.text(h, tx + cols[i] + (i ? 30 : 0), y, { align: i ? "right" : "left" }));
  y += 6;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(tx, y, tx + tw, y);
  for (const z of ctx.summaries) {
    y += 17;
    const [r, g, b] = hexToRgb(zoneColor(z.zone, ctx.zoneCount));
    doc.setFillColor(r, g, b);
    doc.roundedRect(tx, y - 8, 10, 10, 2, 2, "F");
    font("bold", 8.5);
    doc.text(`Z${z.zone}`, tx + 15, y);
    font("normal", 6.5, MUTED);
    doc.text(zoneLabel(z.zone, ctx.zoneCount), tx + 15, y + 7);
    font("normal", 8.5);
    doc.text(fmt(z.areaAc, 1), tx + cols[1] + 30, y, { align: "right" });
    doc.text(Number.isFinite(z.sufficiency) ? z.sufficiency.toFixed(2) : "-", tx + cols[2] + 30, y, { align: "right" });
    font("bold", 8.5);
    doc.text(fmt(z.rateLbAc, 0), tx + cols[3] + 30, y, { align: "right" });
    font("normal", 8.5);
    doc.text(fmt(z.totalLbN, 0), tx + cols[4] + 30, y, { align: "right" });
    y += 4;
    doc.setDrawColor(...LINE);
    doc.line(tx, y + 2, tx + tw, y + 2);
  }

  // ---------- Key numbers ----------
  y += 22;
  font("bold", 10.5);
  doc.text("Field summary", tx, y);
  y += 8;
  const stats: [string, string][] = [
    ["Field health score", `${ctx.health.score}/100 (${ctx.health.label})`],
    ["Average rate", `${fmt(t.avgRateLbAc, 1)} lb N/ac`],
    ["Variable-rate total", `${fmt(t.variableLbN)} lb N`],
    [`Flat-rate total (${ctx.settings.baseRate} lb/ac)`, `${fmt(t.flatLbN)} lb N`],
    ["N difference", `${t.savedLbN >= 0 ? "" : "+"}${fmt(Math.abs(t.savedLbN))} lb ${t.savedLbN >= 0 ? "less" : "MORE"}`],
    ["Estimated N cost savings", `${t.savedUsd >= 0 ? "" : "-"}$${fmt(Math.abs(t.savedUsd))} (${t.savedUsd >= 0 ? "" : "-"}$${fmt(Math.abs(t.savedUsdPerAc), 2)}/ac)`],
    ["N price used", `$${ctx.settings.pricePerLbN.toFixed(2)} / lb N`],
    ["Data confidence", `${ctx.confidence.level} (${ctx.confidence.score}/100)`],
    [`${names.primary} reference`, `${ctx.reference.value.toFixed(3)} (${ctx.reference.kind === "strip" ? "N-rich strip" : "best 5% of field"})`],
  ];
  for (const [k, v] of stats) {
    y += 14;
    font("normal", 8.5, MUTED);
    doc.text(k, tx, y);
    font("bold", 8.5);
    doc.text(v, tx + tw, y, { align: "right" });
  }
  if (t.usesMoreThanFlat) {
    y += 16;
    doc.setFillColor(254, 243, 226);
    doc.roundedRect(tx, y - 9, tw, 16, 3, 3, "F");
    font("bold", 7.5, [154, 72, 8]);
    doc.text("This plan uses MORE nitrogen than the flat rate.", tx + 6, y + 1.5);
  }

  // ---------- Formula + insights ----------
  y = Math.max(y, mapY + mapH) + 22;
  doc.setFillColor(244, 247, 243);
  doc.roundedRect(M, y, W - 2 * M, 44, 6, 6, "F");
  font("bold", 8.5);
  doc.text("How the numbers are calculated", M + 12, y + 15);
  font("normal", 8, MUTED);
  doc.text(
    `zone rate = base rate x (1 + zone adjustment)     savings = (flat total lb - variable total lb) x N price     SI = zone ${names.primary} / reference ${names.primary}`,
    M + 12,
    y + 30,
  );
  y += 62;
  if (ctx.insights?.length) {
    font("bold", 10.5);
    doc.text(`Field insights ${ctx.insightsSource === "gemini" ? "(AI summary of the numbers above)" : ""}`, M, y);
    y += 6;
    font("normal", 8.5, INK);
    for (const line of ctx.insights.slice(0, 5)) {
      const wrapped = doc.splitTextToSize(line, W - 2 * M - 14) as string[];
      if (y + wrapped.length * 11 > 720) break;
      y += 13;
      doc.setFillColor(...BRAND);
      doc.circle(M + 3, y - 3, 1.6, "F");
      doc.text(wrapped, M + 12, y);
      y += (wrapped.length - 1) * 11;
    }
  }

  // ---------- Footer ----------
  doc.setDrawColor(...LINE);
  doc.line(M, 728, W - M, 728);
  font("normal", 6.8, MUTED);
  doc.text(doc.splitTextToSize(DISCLAIMER, W - 2 * M), M, 740);
  return doc;
}

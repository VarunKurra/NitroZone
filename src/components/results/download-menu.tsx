"use client";

import { Check, ChevronDown, Download, FileArchive, FileJson, FileSpreadsheet, FileText, Globe2, Link2, Loader2, Map as MapIcon, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildReportContext } from "@/hooks/use-prescription";
import { insightsCache } from "@/components/results/insights-card";
import { buildBundle, downloadBlob } from "@/lib/export/bundle";
import { cellsCsv, fileStem, geojsonString, kmlString, shapefileZip, zonesCsv, type ReportContext } from "@/lib/export/formats";
import { buildPdf } from "@/lib/export/pdf";
import { loadPdfFonts } from "@/lib/export/pdf-fonts";
import { createShare, savePrescription } from "@/lib/storage/repo";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils";

function ctx(): ReportContext {
  const c = buildReportContext(insightsCache.lines.length ? insightsCache : undefined);
  if (!c) throw new Error("Generate a prescription first.");
  return c;
}

type Kind = "bundle" | "shp" | "geojson" | "kml" | "csv" | "zones" | "pdf";

export async function runExport(kind: Kind) {
  const c = ctx();
  const stem = fileStem(c);
  switch (kind) {
    case "bundle":
      return downloadBlob(await buildBundle(c, await loadPdfFonts()), `${stem}.zip`);
    case "shp":
      return downloadBlob(new Blob([await shapefileZip(c)], { type: "application/zip" }), `${stem}_shapefile.zip`);
    case "geojson":
      return downloadBlob(new Blob([geojsonString(c)], { type: "application/geo+json" }), `${stem}.geojson`);
    case "kml":
      return downloadBlob(new Blob([kmlString(c)], { type: "application/vnd.google-earth.kml+xml" }), `${stem}.kml`);
    case "csv":
      return downloadBlob(new Blob([cellsCsv(c)], { type: "text/csv" }), `${stem}_cells.csv`);
    case "zones":
      return downloadBlob(new Blob([zonesCsv(c)], { type: "text/csv" }), `${stem}_zones.csv`);
    case "pdf":
      return downloadBlob(new Blob([buildPdf(c, await loadPdfFonts()).output("arraybuffer")], { type: "application/pdf" }), `${stem}_report.pdf`);
  }
}

/** The primary, always-reachable download action. One click = everything; menu = single files. */
export function DownloadMenu({ size = "lg", className }: { size?: "lg" | "xl" | "default"; className?: string }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [done, setDone] = useState(false);
  const generated = useApp((s) => s.generated);
  const go = async (k: Kind) => {
    setBusy(k);
    try {
      await runExport(k);
      if (k === "bundle") {
        setDone(true);
        setTimeout(() => setDone(false), 2200);
        toast.success("Prescription downloaded", { description: "Shapefile, GeoJSON, KML, CSV and PDF report in one ZIP." });
      }
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={cn("flex", className)}>
      <Button size={size} className="rounded-r-none pr-3.5" disabled={!generated || busy !== null} onClick={() => go("bundle")} data-testid="download-all">
        {busy === "bundle" ? <Loader2 className="animate-spin" /> : done ? <Check /> : <Download />}
        {done ? "Downloaded" : "Download prescription"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} className="rounded-l-none border-l border-white/20 px-2.5" disabled={!generated || busy !== null} aria-label="More download formats" data-testid="download-menu">
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Individual files</DropdownMenuLabel>
          <Item icon={<MapIcon />} title="Shapefile (.zip)" sub="For your rate controller · WGS84" onClick={() => go("shp")} testId="dl-shp" />
          <Item icon={<FileText />} title="PDF field report" sub="One page: map, rates, savings" onClick={() => go("pdf")} testId="dl-pdf" />
          <Item icon={<FileJson />} title="GeoJSON" sub="Cells with indices and SI" onClick={() => go("geojson")} testId="dl-geojson" />
          <Item icon={<Globe2 />} title="KML" sub="Open in Google Earth" onClick={() => go("kml")} testId="dl-kml" />
          <Item icon={<FileSpreadsheet />} title="CSV: grid cells" sub="One row per cell" onClick={() => go("csv")} testId="dl-csv" />
          <Item icon={<FileSpreadsheet />} title="CSV: zone summary" sub="One row per zone + totals" onClick={() => go("zones")} testId="dl-zones" />
          <DropdownMenuSeparator />
          <Item icon={<FileArchive />} title="Everything (.zip)" sub="All of the above" onClick={() => go("bundle")} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Item({ icon, title, sub, onClick, testId }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; testId?: string }) {
  return (
    <DropdownMenuItem onSelect={onClick} className="gap-3 py-2" data-testid={testId}>
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </DropdownMenuItem>
  );
}

/** Save the prescription (Supabase or this device) and create a shareable read-only link. */
export function SaveShareActions() {
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const c = ctx();
      const { backend } = await savePrescription({
        field_name: c.fieldName,
        settings: { rate: c.settings, zoneCount: c.zoneCount, cellSizeM: c.cellSizeM },
        summary: { totals: c.totals, health: c.health, zones: c.summaries, scene: c.scene },
        zones: btoa(String.fromCharCode(...Array.from(c.zones as Int8Array, (z) => z + 48))),
      });
      toast.success("Prescription saved", { description: backend === "supabase" ? "Saved to your cloud workspace." : "Saved on this device." });
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const c = ctx();
      const payload = sharePayload(c);
      const { slug, backend } = await createShare(payload);
      const url = `${window.location.origin}/report/${slug}`;
      setLink(url);
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      toast.success("Share link copied", { description: backend === "supabase" ? "Anyone with the link can view this report (read-only)." : "Database unavailable: this link only works on this device." });
    } catch (e) {
      toast.error("Could not create link", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={save} disabled={saving} data-testid="save-rx">
        {saving ? <Loader2 className="animate-spin" /> : <Save />} Save prescription
      </Button>
      <Button variant="outline" onClick={share} disabled={sharing} data-testid="share-rx">
        {sharing ? <Loader2 className="animate-spin" /> : <Link2 />} Share read-only link
      </Button>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="max-w-full truncate text-xs text-primary underline underline-offset-2" data-testid="share-link">
          {link}
        </a>
      )}
    </div>
  );
}

/** Everything the public report page needs, small enough to store (cells as compact arrays). */
export function sharePayload(c: ReportContext) {
  const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    v: 1,
    fieldName: c.fieldName,
    field: c.field,
    generatedAt: c.generatedAt.toISOString(),
    scene: c.scene,
    settings: c.settings,
    zoneCount: c.zoneCount,
    cellSizeM: c.cellSizeM,
    reference: c.reference,
    totals: c.totals,
    health: c.health,
    confidence: c.confidence,
    summaries: c.summaries,
    insights: c.insights ?? [],
    insightsSource: c.insightsSource ?? "rules",
    cells: c.cells.map((cell, i) => ({
      z: c.zones[i],
      r: r(c.rates[i], 1),
      p: r(cell.primary, 4),
      s: r(cell.secondary, 4),
      a: r(cell.areaAc, 4),
      g: cell.ringsLngLat[0].map((pt) => [r(pt[0], 6), r(pt[1], 6)]),
    })),
  };
}
export type SharePayload = ReturnType<typeof sharePayload>;

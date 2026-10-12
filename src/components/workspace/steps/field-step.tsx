"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Cloud, FileUp, HardDrive, Loader2, MousePointerClick, PenLine, Save, Sparkles, Trash2, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { AddressSearch } from "@/components/workspace/address-search";
import { StepHeader, PanelSection } from "@/components/workspace/panel-parts";
import { useApp } from "@/store/app-store";
import { DEMO_FIELD } from "@/lib/demo/demo-field";
import { areaAcresLngLat } from "@/lib/agronomy/geo";
import { importBoundary } from "@/lib/imagery/boundary-import";
import { deleteField, listFields, saveField, supabaseConfigured } from "@/lib/storage/repo";
import { validateField } from "@/components/workspace/run-analysis";
import { cn } from "@/lib/utils";

export function loadDemoField() {
  useApp.getState().setField(DEMO_FIELD, { name: "Audrain County demo field", isDemo: true });
  useApp.setState({ drawMode: "idle" });
}

export function FieldStep() {
  const field = useApp((s) => s.field);
  const fieldName = useApp((s) => s.fieldName);
  const drawMode = useApp((s) => s.drawMode);
  const isDemo = useApp((s) => s.isDemo);
  const savedFieldId = useApp((s) => s.savedFieldId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["fields"], queryFn: listFields });

  const area = field ? areaAcresLngLat(field.geometry) : 0;
  const problem = field ? validateField() : null;

  const onImport = async (file: File) => {
    try {
      const { feature, name } = await importBoundary(file);
      useApp.getState().setField({ ...feature, properties: { name } }, { name });
      toast.success("Boundary imported", { description: `${areaAcresLngLat(feature.geometry).toFixed(1)} acres from ${file.name}` });
    } catch (e) {
      toast.error("Could not import boundary", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const onSave = async () => {
    if (!field) return;
    setSaving(true);
    const { row, backend } = await saveField({ name: fieldName.trim() || "Field", boundary: field.geometry, area_ac: Math.round(area * 100) / 100 });
    setSaving(false);
    useApp.setState({ savedFieldId: row.id });
    qc.invalidateQueries({ queryKey: ["fields"] });
    toast.success("Field saved", { description: backend === "supabase" ? "Saved to your NitroZone cloud workspace." : "Saved on this device (cloud database unavailable)." });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 scrollbar-thin">
        <StepHeader index={1} title="Find your field" description="Search for your farm, then click around the edges of your field on the map. Or try a real Missouri field." />

        <AddressSearch />

        {!field && drawMode !== "draw-field" && (
          <div className="grid gap-3">
            <OptionCard
              icon={<PenLine className="size-5" />}
              title="Outline my field"
              text="Click the corners of your field on the map."
              onClick={() => useApp.setState({ drawMode: "draw-field" })}
              primary
            />
            <OptionCard
              icon={<Sparkles className="size-5" />}
              title="Use the demo field"
              text="A real 193-acre field in Audrain County, Missouri, with a real satellite photo from July 2025."
              onClick={loadDemoField}
              testId="load-demo"
            />
            <OptionCard icon={<FileUp className="size-5" />} title="Upload a field outline" text="Use a file from your farm software (shapefile, KML or GeoJSON)." onClick={() => fileRef.current?.click()} />
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.kml,.geojson,.json"
          className="sr-only"
          aria-label="Import field boundary file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />

        {drawMode === "draw-field" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-field-200 bg-field-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-field-800">
              <MousePointerClick className="size-4" /> Drawing your boundary
            </div>
            <ol className="mt-2 space-y-1.5 text-sm text-field-900/80">
              <li>1. Click each corner of the field on the map.</li>
              <li>2. Click the first corner again (or double-click) to finish.</li>
              <li>
                3. Press <Kbd>Esc</Kbd> to cancel.
              </li>
            </ol>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => useApp.setState({ drawMode: "idle" })}>
              Cancel drawing
            </Button>
          </motion.div>
        )}

        {field && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor="field-name" className="text-xs font-medium text-muted-foreground">
                  Field name
                </Label>
                <Input id="field-name" value={fieldName} maxLength={80} onChange={(e) => useApp.setState({ fieldName: e.target.value })} className="mt-1.5 h-10 font-medium" />
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-muted-foreground">Area</div>
                <div className="mt-1.5 font-display text-2xl font-bold tabular" data-testid="field-area">
                  {area.toFixed(1)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">ac</span>
                </div>
              </div>
            </div>
            {isDemo && (
              <p className="mt-3 rounded-lg bg-river-50 px-3 py-2 text-xs text-river-700">
                Real field: USDA Cropland Data Layer shows 93% corn in 2025 (soybeans in 2024).
              </p>
            )}
            {problem && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{problem}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {drawMode === "edit-field" ? (
                <Button size="sm" onClick={() => useApp.setState({ drawMode: "idle" })}>
                  <Check /> Done editing
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => useApp.setState({ drawMode: "edit-field" })} disabled={field.geometry.type !== "Polygon"}>
                  <PenLine /> Edit corners
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { useApp.getState().setField(null); useApp.setState({ drawMode: "draw-field" }); }}>
                <Undo2 /> Redraw
              </Button>
              <Button size="sm" variant="outline" onClick={onSave} disabled={saving || Boolean(savedFieldId)}>
                {saving ? <Loader2 className="animate-spin" /> : savedFieldId ? <Check /> : <Save />} {savedFieldId ? "Saved" : "Save field"}
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => useApp.getState().setField(null)} aria-label="Remove field">
                <Trash2 />
              </Button>
            </div>
            {drawMode === "edit-field" && <p className="mt-3 text-xs text-muted-foreground">Drag corners to move them, drag a midpoint to add a corner, right-click a corner to delete it.</p>}
          </motion.div>
        )}

        <PanelSection
          title="Saved fields"
          aside={
            <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground" data-dev-only>
              {saved.data?.backend === "supabase" ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
              {saved.data?.backend === "supabase" ? "Cloud" : supabaseConfigured() ? "This device (offline)" : "This device"}
            </span>
          }
        >
          {saved.isLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : saved.data?.rows.length ? (
            <ul className="space-y-1.5">
              {saved.data.rows.slice(0, 6).map((f) => (
                <li key={f.id} className="group flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm transition hover:border-field-300 hover:bg-field-50"
                    onClick={() => useApp.getState().setField({ type: "Feature", properties: { name: f.name }, geometry: f.boundary }, { name: f.name, savedFieldId: f.id })}
                  >
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground tabular">{Number(f.area_ac).toFixed(1)} ac</span>
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Delete ${f.name}`}
                    onClick={async () => {
                      await deleteField(f.id);
                      qc.invalidateQueries({ queryKey: ["fields"] });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No saved fields yet. Save a field to reuse it next season.</p>
          )}
        </PanelSection>
      </div>
      <div className="border-t bg-white/80 px-5 py-4">
        <Button size="xl" className="w-full" disabled={!field || Boolean(problem) || drawMode === "draw-field"} onClick={() => useApp.setState({ step: "imagery", drawMode: "idle" })} data-testid="to-imagery">
          Continue to imagery <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function OptionCard({ icon, title, text, onClick, primary, testId }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; primary?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "group flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]",
        primary ? "border-field-200 bg-gradient-to-br from-field-50 to-white hover:border-field-300" : "bg-white hover:border-field-200",
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", primary ? "bg-primary text-white" : "bg-muted text-field-700")}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold">
          {title}
          <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

"use client";

/**
 * Step 1: find the field. Three things only: search, upload an outline, saved fields.
 * Drawing is always on: click the map to outline the field.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Cloud, FileUp, HardDrive, Loader2, MousePointerClick, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddressSearch } from "@/components/workspace/address-search";
import { StepHeader, PanelSection } from "@/components/workspace/panel-parts";
import { useApp } from "@/store/app-store";
import { DEMO_FIELD } from "@/lib/demo/demo-field";
import { areaAcresLngLat } from "@/lib/agronomy/geo";
import { importBoundary } from "@/lib/imagery/boundary-import";
import { deleteField, listFields, saveField, supabaseConfigured } from "@/lib/storage/repo";
import { validateField } from "@/components/workspace/run-analysis";

/** Used by presentation mode (?present=1) and ?demo=1 links. */
export function loadDemoField() {
  useApp.getState().setField(DEMO_FIELD, { name: "Audrain County demo field", isDemo: true });
  useApp.setState({ drawMode: "idle" });
}

export function FieldStep() {
  const field = useApp((s) => s.field);
  const fieldName = useApp((s) => s.fieldName);
  const drawMode = useApp((s) => s.drawMode);
  const savedFieldId = useApp((s) => s.savedFieldId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["fields"], queryFn: listFields });

  // Drawing is the default: whenever there's no field, the map is ready for clicks.
  useEffect(() => {
    if (!field && drawMode === "idle") useApp.setState({ drawMode: "draw-field" });
  }, [field, drawMode]);

  const area = field ? areaAcresLngLat(field.geometry) : 0;
  const problem = field ? validateField() : null;

  const onImport = async (file: File) => {
    try {
      const { feature, name } = await importBoundary(file);
      useApp.getState().setField({ ...feature, properties: { name } }, { name });
      useApp.setState({ drawMode: "idle" });
      toast.success("Field outline added", { description: `${areaAcresLngLat(feature.geometry).toFixed(0)} acres from ${file.name}` });
    } catch (e) {
      toast.error("Couldn't read that file", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const onSave = async () => {
    if (!field) return;
    setSaving(true);
    const name = fieldName.trim() && fieldName !== "My field" ? fieldName.trim() : `Field, ${area.toFixed(0)} acres`;
    const { row, backend } = await saveField({ name, boundary: field.geometry, area_ac: Math.round(area * 100) / 100 });
    setSaving(false);
    useApp.setState({ savedFieldId: row.id, fieldName: name });
    qc.invalidateQueries({ queryKey: ["fields"] });
    toast.success("Field saved", { description: backend === "supabase" ? "You can find it under Saved fields." : "Saved on this device." });
  };

  const redraw = () => {
    useApp.getState().setField(null);
    useApp.setState({ drawMode: "draw-field" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 scrollbar-thin">
        <StepHeader index={1} title="Find your field" description="Search for your farm, then click around the edges of your field on the map." />

        <AddressSearch />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group flex w-full items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-field-200 hover:shadow-[var(--shadow-card)]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-field-700">
            <FileUp className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold">
              Upload a field outline
              <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">From your farm software (shapefile, KML or GeoJSON).</span>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.kml,.geojson,.json"
          className="sr-only"
          aria-label="Upload a field outline file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />

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
                    onClick={() => {
                      useApp.getState().setField({ type: "Feature", properties: { name: f.name }, geometry: f.boundary }, { name: f.name, savedFieldId: f.id });
                      useApp.setState({ drawMode: "idle" });
                    }}
                  >
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground tabular">{Number(f.area_ac).toFixed(0)} acres</span>
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
            <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No saved fields yet.</p>
          )}
        </PanelSection>
      </div>

      <div className="border-t bg-white/80 px-5 pb-4 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {field ? (
            <motion.div key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="size-4 text-primary" />
                <span data-testid="field-area" className="tabular">{area.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span> acres outlined
              </span>
              <span className="ml-auto flex items-center gap-3">
                <button type="button" onClick={redraw} className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Redraw
                </button>
                <button type="button" onClick={onSave} disabled={saving || Boolean(savedFieldId)} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline">
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  {savedFieldId ? "Saved" : "Save"}
                </button>
              </span>
              {problem && <p className="w-full text-xs font-medium text-destructive">{problem}</p>}
            </motion.div>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MousePointerClick className="size-4 shrink-0" /> Click the map to add corners. Click the first corner to finish.
            </motion.p>
          )}
        </AnimatePresence>
        <Button size="xl" className="w-full" disabled={!field || Boolean(problem)} onClick={() => useApp.setState({ step: "imagery", drawMode: "idle" })} data-testid="to-imagery">
          Continue <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

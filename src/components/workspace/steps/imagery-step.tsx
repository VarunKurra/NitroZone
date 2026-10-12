"use client";

import { AlertTriangle, ArrowLeft, CloudSun, Drone, ImageUp, Loader2, Ruler, Satellite, ScanLine, Sprout, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PanelSection, StepHeader } from "@/components/workspace/panel-parts";
import { runAnalysis } from "@/components/workspace/run-analysis";
import { sceneThumbUrl, useScenes } from "@/hooks/use-scenes";
import { useApp } from "@/store/app-store";
import { defaultWindow } from "@/lib/imagery/sentinel";
import { DEMO_REFERENCE_STRIP, DEMO_SCENE_ID } from "@/lib/demo/demo-field";
import { boundsOf, polygonsOf } from "@/lib/agronomy/geo";
import { cn } from "@/lib/utils";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ImageryStep() {
  const field = useApp((s) => s.field);
  const isDemo = useApp((s) => s.isDemo);
  const source = useApp((s) => s.source);
  const scene = useApp((s) => s.scene);
  const drone = useApp((s) => s.drone);
  const reference = useApp((s) => s.reference);
  const settings = useApp((s) => s.analysisSettings);
  const status = useApp((s) => s.status);
  const presentation = useApp((s) => s.presentation);
  const [useBundled, setUseBundled] = useState(true);

  const base = useMemo(() => defaultWindow(), []);
  const baseYear = base.start.getUTCFullYear();
  const [year, setYear] = useState<number>(isDemo ? 2025 : baseYear);
  const window_ = useMemo(() => {
    if (year === baseYear) return base;
    return { start: new Date(Date.UTC(year, 5, 10)), end: new Date(Date.UTC(year, 6, 20, 23, 59, 59)), inSeason: false, label: `${year} sidedress window (Jun 10 - Jul 20)` };
  }, [year, base, baseYear]);
  const scenes = useScenes(source === "satellite" ? field : null, window_, 40);

  const bbox = useMemo(() => (field ? (boundsOf(polygonsOf(field.geometry)) as [number, number, number, number]) : null), [field]);

  // Auto-pick a scene: the pinned demo scene, else the newest one under 10% cloud, else the clearest.
  useEffect(() => {
    if (!scenes.data?.length) return;
    if (scene && scenes.data.some((s) => s.id === scene.id)) return;
    const pick =
      (isDemo && scenes.data.find((s) => s.id === DEMO_SCENE_ID)) ||
      scenes.data.find((s) => s.cloudCover <= 10) ||
      [...scenes.data].sort((a, b) => a.cloudCover - b.cloudCover)[0];
    useApp.setState({ scene: pick });
  }, [scenes.data, scene, isDemo]);

  const recommended = useMemo(() => {
    if (!scenes.data?.length) return null;
    return (isDemo && scenes.data.find((s) => s.id === DEMO_SCENE_ID)?.id) || scenes.data.find((s) => s.cloudCover <= 10)?.id || null;
  }, [scenes.data, isDemo]);

  const canAnalyze = source === "drone" ? Boolean(drone) : true;
  const running = status === "running";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 scrollbar-thin">
        <StepHeader index={2} title="Pick a satellite photo" description="NitroZone reads how green and healthy your crop is. Pick a clear photo from mid-season, once the crop covers the ground." />

        <ToggleGroup
          type="single"
          value={source}
          onValueChange={(v) => v && useApp.setState({ source: v as "satellite" | "drone" })}
          className="grid w-full grid-cols-2 rounded-xl bg-muted p-1"
          aria-label="Imagery source"
        >
          <ToggleGroupItem value="satellite" className="h-10 rounded-lg data-[state=on]:bg-white data-[state=on]:shadow-sm">
            <Satellite className="size-4" /> Satellite
          </ToggleGroupItem>
          <ToggleGroupItem value="drone" className="h-10 rounded-lg data-[state=on]:bg-white data-[state=on]:shadow-sm">
            <Drone className="size-4" /> Drone image
          </ToggleGroupItem>
        </ToggleGroup>

        {source === "satellite" ? (
          <PanelSection
            title="Satellite photos"
            aside={
              !isDemo && (
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-xs" aria-label="Season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[baseYear, baseYear - 1, baseYear - 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y === baseYear ? base.label : `${y} season`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
          >
            {!window_.inSeason && !isDemo && (
              <p className="flex items-start gap-2 rounded-xl bg-harvest-50 px-3 py-2.5 text-xs leading-relaxed text-harvest-700">
                <CloudSun className="mt-px size-4 shrink-0" />
                It&apos;s not growing season, so these photos are from last summer.
              </p>
            )}
            {isDemo && (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5">
                <div>
                  <Label htmlFor="bundled" className="text-sm font-medium">
                    Load instantly
                  </Label>
                  <p className="text-xs text-muted-foreground">Same photo, saved with the app. Works offline.</p>
                </div>
                <Switch id="bundled" checked={useBundled || presentation} disabled={presentation} onCheckedChange={setUseBundled} />
              </div>
            )}
            {scenes.isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[132px] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : scenes.isError ? (
              <EmptyNote icon={<AlertTriangle className="size-4" />} tone="warn">
                Couldn&apos;t reach the satellite service. {isDemo ? "We'll use the saved photo." : "We'll use practice data so you can still try it."}
              </EmptyNote>
            ) : !scenes.data?.length ? (
              <EmptyNote icon={<CloudSun className="size-4" />}>
                No clear photos for this field in that window. Try another year{isDemo ? "" : " above"}.
              </EmptyNote>
            ) : (
              <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto pr-0.5 scrollbar-thin" role="radiogroup" aria-label="Satellite scene">
                {scenes.data.slice(0, 12).map((s) => {
                  const active = scene?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => useApp.setState({ scene: s })}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-white text-left transition-all",
                        active ? "border-primary ring-2 ring-primary/25" : "hover:border-field-300",
                      )}
                    >
                      {bbox && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sceneThumbUrl(s.id, bbox)} alt="" loading="lazy" className="h-20 w-full bg-field-900 object-cover" />
                      )}
                      <div className="px-2.5 py-2">
                        <div className="text-[0.8rem] font-semibold tabular">{fmtDate(s.datetime)}</div>
                        <div className="text-[0.7rem] text-muted-foreground tabular">{s.cloudCover.toFixed(0)}% cloudy</div>
                      </div>
                      {recommended === s.id && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[0.62rem] font-semibold text-primary shadow-sm">
                          {isDemo ? "Demo photo" : "Best pick"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </PanelSection>
        ) : (
          <DroneUpload />
        )}

        <PanelSection title="Extra-fertilizer strip (optional)">
          <p className="text-sm leading-relaxed text-muted-foreground">If part of your field got extra fertilizer this year, draw it here and we&apos;ll compare the rest of the field to it.</p>
          {reference ? (
            <div className="flex items-center justify-between rounded-xl border border-harvest-200 bg-harvest-50 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium text-harvest-700">
                <Sprout className="size-4" /> Strip added
              </span>
              <Button size="sm" variant="ghost" onClick={() => useApp.setState({ reference: null })}>
                <Trash2 /> Remove
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => useApp.setState({ drawMode: "draw-strip" })}>
                <ScanLine /> Draw it on the map
              </Button>
              {isDemo && (
                <Button size="sm" variant="ghost" onClick={() => useApp.setState({ reference: DEMO_REFERENCE_STRIP })}>
                  Add an example
                </Button>
              )}
            </div>
          )}
        </PanelSection>

        <Accordion type="single" collapsible className="rounded-xl border bg-white px-3">
          <AccordionItem value="adv" className="border-none">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                <Ruler className="size-4 text-muted-foreground" /> Zone settings
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pb-4">
              <ZoningSettings />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <p className="text-xs text-muted-foreground" data-dev-only>
          {settings.zoneCount} zones · {settings.cellSizeM} m squares
        </p>
      </div>
      <div className="flex gap-2 border-t bg-white/80 px-5 py-4">
        <Button size="xl" variant="outline" onClick={() => useApp.setState({ step: "field" })} aria-label="Back to field">
          <ArrowLeft />
        </Button>
        <Button size="xl" className="flex-1" disabled={!canAnalyze || running} onClick={() => runAnalysis({ useBundled: useBundled || presentation })} data-testid="analyze">
          {running ? <Loader2 className="animate-spin" /> : <Satellite />} {running ? "Checking…" : "Check my field"}
        </Button>
      </div>
    </div>
  );
}

export function ZoningSettings() {
  const s = useApp((st) => st.analysisSettings);
  const set = useApp((st) => st.setAnalysisSettings);
  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Number of zones</Label>
        <ToggleGroup type="single" value={String(s.zoneCount)} onValueChange={(v) => v && set({ zoneCount: Number(v) as 3 | 4 | 5 })} className="grid w-full grid-cols-3 rounded-lg bg-muted p-1" aria-label="Number of zones">
          {[3, 4, 5].map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="h-8 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Detail level</Label>
        <ToggleGroup type="single" value={String(s.cellSizeM)} onValueChange={(v) => v && set({ cellSizeM: Number(v) })} className="grid w-full grid-cols-3 rounded-lg bg-muted p-1" aria-label="Grid cell size">
          {[10, 20, 30].map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="h-8 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
              {n} m
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">Smaller squares = more detail. Match your spreader width.</p>
      </div>
      <SliderRow label="Smallest zone" value={s.minZoneAc} min={0} max={3} step={0.25} unit="acres" onChange={(v) => set({ minZoneAc: v })} />
      <SliderRow label="Skip field edges" value={s.edgeBufferM} min={0} max={20} step={1} unit="m" onChange={(v) => set({ edgeBufferM: v })} />
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="smooth" className="text-sm font-medium">
            Smooth out zones
          </Label>

        </div>
        <Switch id="smooth" checked={s.smooth} onCheckedChange={(v) => set({ smooth: v })} />
      </div>
    </>
  );
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  hint?: string;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm font-semibold tabular">
          {format ? format(value) : value} <span className="font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DroneUpload() {
  const drone = useApp((s) => s.drone);
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const accept = async (file: File) => {
    if (file.size > 300 * 1024 * 1024) return alertLarge();
    useApp.setState({ drone: { name: file.name, type: file.type, size: file.size, buffer: await file.arrayBuffer() } });
  };
  return (
    <PanelSection title="Drone image">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) accept(f);
        }}
        className={cn("flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition", drag ? "border-primary bg-field-50" : "border-border bg-white hover:border-field-300")}
      >
        <ImageUp className="size-7 text-primary" />
        <span className="mt-2 font-semibold">{drone ? drone.name : "Drop your drone photo here"}</span>
        <span className="mt-1 text-xs text-muted-foreground">{drone ? `${(drone.size / 1e6).toFixed(1)} MB · click to replace` : "Map image (GeoTIFF), JPG or PNG"}</span>
      </button>
      <input ref={ref} type="file" accept=".tif,.tiff,image/tiff,image/jpeg,image/png" className="sr-only" aria-label="Upload drone image" onChange={(e) => e.target.files?.[0] && accept(e.target.files[0])} />

    </PanelSection>
  );
}

function alertLarge() {
  import("sonner").then(({ toast }) => toast.error("File too large", { description: "Use an image under 300 MB (export a lower-resolution orthomosaic)." }));
}

function EmptyNote({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: "warn" }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl border border-dashed px-3 py-3 text-sm", tone === "warn" ? "border-harvest-200 bg-harvest-50 text-harvest-700" : "text-muted-foreground")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

"use client";

/**
 * Picks the map renderer: the full MapLibre (WebGL) map when the browser supports WebGL2,
 * otherwise the simple map, so the app never crashes on computers with graphics acceleration off.
 */
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { hasWebGL2 } from "./map-bridge";
import SimpleMap from "./simple-map";

const FieldMap = dynamic(() => import("./field-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gradient-to-br from-field-900 to-field-950" />,
});

/** If the WebGL map still fails at runtime, fall back instead of breaking the page. */
class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[NitroZone] WebGL map failed, using simple map instead:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function MapView() {
  const [webgl] = useState(() => hasWebGL2());
  const [tip, setTip] = useState(true);
  const simple = (
    <div className="relative h-full w-full">
      <SimpleMap />
      {tip && (
        <div className="absolute bottom-8 right-3 z-20 flex max-w-xs items-start gap-2 rounded-xl bg-white/95 p-3 text-xs leading-relaxed shadow-[var(--shadow-float)] ring-1 ring-black/5" data-testid="simple-map-tip">
          <Info className="mt-0.5 size-4 shrink-0 text-river-600" />
          <span>
            Simple map mode. For the full map, turn on <strong>&ldquo;Use graphics acceleration&rdquo;</strong> in your browser settings.
          </span>
          <button type="button" onClick={() => setTip(false)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
  if (!webgl) return simple;
  return (
    <MapBoundary fallback={simple}>
      <FieldMap />
    </MapBoundary>
  );
}

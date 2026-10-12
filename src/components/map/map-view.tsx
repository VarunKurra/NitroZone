"use client";

/**
 * Picks the map renderer: the full MapLibre (WebGL) map when the browser supports WebGL2,
 * otherwise the simple map, so the app never crashes on computers with graphics acceleration off.
 */
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
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
  if (!webgl) return <SimpleMap />;
  return (
    <MapBoundary fallback={<SimpleMap />}>
      <FieldMap />
    </MapBoundary>
  );
}

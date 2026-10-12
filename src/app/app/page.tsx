import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/workspace";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Draw your field, analyze Sentinel-2 imagery and build a variable-rate nitrogen prescription.",
};

export default function AppPage() {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-field-950" />}>
      <Workspace />
    </Suspense>
  );
}

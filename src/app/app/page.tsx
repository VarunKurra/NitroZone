import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/workspace";
import { PageTransition } from "@/components/common/page-transition";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Draw your field, analyze Sentinel-2 imagery and build a variable-rate nitrogen prescription.",
};

export default function AppPage() {
  return (
    <PageTransition>
      <Suspense fallback={<div className="h-dvh bg-background" />}>
        <Workspace />
      </Suspense>
    </PageTransition>
  );
}

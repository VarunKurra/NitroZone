import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedReport } from "@/components/report/shared-report";

export const metadata: Metadata = {
  title: "Shared prescription report",
  description: "A read-only NitroZone variable-rate nitrogen prescription.",
  robots: { index: false },
};

async function Loader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SharedReport slug={slug} />;
}

export default function ReportPage({ params }: PageProps<"/report/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 h-96 max-w-5xl animate-pulse rounded-3xl bg-muted" />}>
      <Loader params={params} />
    </Suspense>
  );
}

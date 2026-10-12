"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

/** Errors that just mean "this tab is running an old version of the site" (e.g. after an update). */
const STALE = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch|Importing a module script failed/i;

/**
 * Friendly error screen. If the problem is a stale page after the site was updated, it
 * reloads once automatically so the visitor never sees an error at all.
 */
export function ErrorView({ error, reset, retry }: { error: Error & { digest?: string }; reset?: () => void; retry?: () => void }) {
  useEffect(() => {
    if (!STALE.test(`${error?.name} ${error?.message}`)) return;
    try {
      if (sessionStorage.getItem("nz.reloaded")) return;
      sessionStorage.setItem("nz.reloaded", "1");
      setTimeout(() => sessionStorage.removeItem("nz.reloaded"), 10_000);
    } catch {
      /* storage blocked: still try a reload */
    }
    window.location.reload();
  }, [error]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-[#f8f5ee] px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Sorry about that. Try again, or head back to the home page.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => (STALE.test(error?.message ?? "") ? window.location.reload() : (retry ?? reset ?? (() => window.location.reload()))())}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15653d] px-5 font-medium text-white hover:bg-[#105233]"
          >
            <RefreshCw className="size-4" /> Try again
          </button>
          <Link href="/" className="inline-flex h-11 items-center rounded-xl border bg-white px-5 font-medium">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

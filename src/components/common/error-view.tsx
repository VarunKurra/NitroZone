"use client";

import Link from "next/link";
import { Check, ChevronDown, Copy, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Errors that just mean "this tab is running an old version of the site" (e.g. after an update). */
const STALE = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i;

/**
 * Friendly error screen with a "Copy error details" button for debugging.
 * If the problem is a stale page after the site was updated, it reloads once automatically.
 */
export function ErrorView({ error, reset, retry }: { error: Error & { digest?: string }; reset?: () => void; retry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const details = useMemo(() => {
    const lines = [
      `Error: ${error?.name ?? "Error"}: ${error?.message ?? "(no message)"}`,
      error?.digest ? `Digest: ${error.digest}` : null,
      typeof window !== "undefined" ? `Page: ${window.location.href}` : null,
      typeof navigator !== "undefined" ? `Browser: ${navigator.userAgent}` : null,
      `Time: ${new Date().toISOString()}`,
      "",
      error?.stack ?? "(no stack trace)",
    ];
    return lines.filter((l) => l !== null).join("\n");
  }, [error]);

  useEffect(() => {
    console.error("[NitroZone] page error:", error);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
    } catch {
      // clipboard blocked: fall back to a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = details;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-[#f8f5ee] px-6 text-center">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Sorry about that. Try again, or head back to the home page.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
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
          <button type="button" onClick={copy} className="inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-5 font-medium" data-testid="copy-error">
            {copied ? <Check className="size-4 text-[#15653d]" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy error details"}
          </button>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" aria-expanded={open}>
          {open ? "Hide" : "Show"} details <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <pre className="mt-3 max-h-64 overflow-auto rounded-xl border bg-white p-3 text-left text-xs leading-relaxed whitespace-pre-wrap">{details}</pre>}
      </div>
    </main>
  );
}

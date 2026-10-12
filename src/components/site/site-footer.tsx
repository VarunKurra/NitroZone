import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { GithubIcon } from "@/components/brand/github-icon";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { HalftoneWordmark } from "./halftone-wordmark";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Open the app", href: "/app" },
      { label: "Demo field", href: "/app?demo=1" },
      { label: "Presentation mode", href: "/app?present=1" },
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
    ],
  },
  {
    title: "Science",
    links: [
      { label: "Methodology", href: "/science" },
      { label: "Formulas", href: "/science#formulas" },
      { label: "Limitations", href: "/science#limitations" },
      { label: "Sources", href: "/science#sources" },
    ],
  },
  {
    title: "Open data",
    links: [
      { label: "Copernicus Sentinel-2", href: "https://sentinels.copernicus.eu/", external: true },
      { label: "Planetary Computer", href: "https://planetarycomputer.microsoft.com/", external: true },
      { label: "USDA Cropland Data Layer", href: "https://www.nass.usda.gov/Research_and_Science/Cropland/SARS1a.php", external: true },
      { label: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t bg-white" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-5 pt-16 sm:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr_auto] lg:gap-16">
          {/* company */}
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 text-[0.95rem] leading-relaxed text-muted-foreground">
              Variable-rate nitrogen prescriptions for Missouri corn, built from free satellite imagery. Less fertilizer where it isn&apos;t needed, less nitrogen in our rivers.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">A Congressional App Challenge project · Missouri</p>
            <div className="mt-6 flex gap-2">
              <a href="https://github.com/VarunKurra/NitroZone" target="_blank" rel="noreferrer" aria-label="NitroZone on GitHub" className="grid size-10 place-items-center rounded-xl border text-foreground/70 transition hover:border-field-300 hover:bg-field-50 hover:text-foreground">
                <GithubIcon className="size-[18px]" />
              </a>
              <a href="https://github.com/VarunKurra/NitroZone/issues" target="_blank" rel="noreferrer" aria-label="Send feedback" className="grid size-10 place-items-center rounded-xl border text-foreground/70 transition hover:border-field-300 hover:bg-field-50 hover:text-foreground">
                <Mail className="size-[18px]" />
              </a>
            </div>
          </div>

          {/* link columns */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {"external" in l && l.external ? (
                        <a href={l.href} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1 text-[0.92rem] text-foreground/80 transition hover:text-primary">
                          {l.label}
                          <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-100" />
                        </a>
                      ) : (
                        <Link href={l.href} className="text-[0.92rem] text-foreground/80 transition hover:text-primary">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* stacked CTAs */}
          <div className="flex flex-col gap-2.5 sm:w-56">
            <Button asChild size="xl" className="justify-between rounded-xl">
              <Link href="/app?demo=1">
                Try the demo <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="justify-between rounded-xl">
              <Link href="/app">
                Draw my field <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="xl" variant="ghost" className="justify-between rounded-xl text-muted-foreground">
              <a href="https://github.com/VarunKurra/NitroZone" target="_blank" rel="noreferrer">
                View source <ArrowUpRight />
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 NitroZone. Estimates only; always scout and follow agronomic advice.</p>
          <p>Contains modified Copernicus Sentinel data. Basemap imagery © Esri and partners.</p>
        </div>
      </div>
      <HalftoneWordmark className="mt-10 select-none px-3 sm:px-6" />
    </footer>
  );
}

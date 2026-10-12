"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/science", label: "The science" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));
  return (
    <header className={cn("sticky top-0 z-50 transition-all duration-300", scrolled ? "glass border-b border-black/5 shadow-[0_1px_0_rgba(0,0,0,0.02)]" : "bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="NitroZone home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded-lg px-3 py-2 text-[0.9rem] font-medium text-foreground/70 transition hover:bg-black/[0.04] hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <a href="https://github.com/VarunKurra/NitroZone" target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-[0.9rem] font-medium text-foreground/70 hover:text-foreground">
            GitHub
          </a>
          <Button asChild size="lg" className="rounded-xl">
            <Link href="/app?demo=1">
              Try the demo <ArrowRight />
            </Link>
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t bg-white md:hidden" aria-label="Mobile">
            <ul className="space-y-1 px-5 py-4">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-muted">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Button asChild size="xl" className="w-full">
                  <Link href="/app?demo=1">Try the demo</Link>
                </Button>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

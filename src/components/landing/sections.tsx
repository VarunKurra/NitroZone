"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Download, MapPinned, Satellite } from "lucide-react";
import { motion } from "motion/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HeroStory } from "./hero-story";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease }} className={className}>
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-harvest-700", className)}>{children}</p>;
}

// ------------------------------------------------------------------ hero
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f7f3ea] to-background">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-[3.4rem] lg:text-[3.7rem]"
          >
            Give every part of your field <span className="text-primary">just what it needs.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease }} className="mt-6 max-w-lg text-[1.15rem] leading-relaxed text-muted-foreground">
            NitroZone uses free satellite photos to show farmers where their crops need more fertilizer and where they need less. That saves money and keeps fertilizer out of our rivers.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease }} className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl" className="rounded-xl px-6 text-base">
              <Link href="/app?demo=1" data-testid="hero-demo">
                Try it now <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="rounded-xl bg-white px-6 text-base">
              <Link href="#how">See how it works</Link>
            </Button>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.35 }} className="mt-6 text-sm text-muted-foreground">
            Free to use · No sign-up · Made in Missouri
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease }}>
          <HeroStory />
        </motion.div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- why it matters
export function WhyItMatters() {
  return (
    <section id="why" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="why-title">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="relative order-2 lg:order-1">
          <div className="relative aspect-[6/7] overflow-hidden rounded-[2rem]">
            <Image src="/images/farmer-fence-sunrise.jpg" alt="A farmer leaning on a fence at sunrise" fill sizes="(max-width: 1024px) 90vw, 540px" className="object-cover" />
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <Reveal>
            <Eyebrow>Why it matters</Eyebrow>
            <h2 id="why-title" className="mt-3 font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[2.7rem]">
              No field is the same from one end to the other.
            </h2>
            <p className="mt-5 text-[1.08rem] leading-relaxed text-muted-foreground">
              Most fields get the same amount of fertilizer everywhere. Some spots need more, and some need much less. The extra costs farmers money, and rain can wash it into creeks and rivers.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Reveal delay={0.05}>
              <Stat
                value="66%"
                tone="river"
                text="of the nitrogen reaching the Gulf of Mexico from the Mississippi River basin comes from cropland."
                source="USGS"
                href="https://water.usgs.gov/nawqa/sparrow/gulf_findings/primary_sources.html"
              />
            </Reveal>
            <Reveal delay={0.1}>
              <Stat
                value="24 lb"
                tone="field"
                text="less nitrogen per acre, on average, when Missouri farmers matched fertilizer to what each part of the field needed, with no loss in yield."
                source="University of Missouri"
                href="https://extension.missouri.edu/media/wysiwyg/Extensiondata/Pro/NutrientManagement/Docs/Crop_Sensors_to_Guide_N_Application_to_Reduce_N_Loss.pdf"
              />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, text, source, href, tone }: { value: string; text: string; source: string; href: string; tone: "river" | "field" }) {
  return (
    <div className="h-full rounded-2xl border bg-white p-6">
      <div className={cn("font-display text-[2.6rem] font-bold leading-none tracking-[-0.03em]", tone === "river" ? "text-river-600" : "text-field-700")}>{value}</div>
      <p className="mt-3 text-[0.98rem] leading-relaxed text-foreground/80">{text}</p>
      <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline">
        Source: {source} <ArrowUpRight className="size-3" />
      </a>
    </div>
  );
}

// ------------------------------------------------------------ how it works
export function HowItWorks() {
  const steps = [
    { icon: MapPinned, title: "Outline your field", text: "Find your farm on the map and click around the edges of your field." },
    { icon: Satellite, title: "We read the satellite photo", text: "NitroZone looks at how green and healthy each part of the field is." },
    { icon: Download, title: "Get your field plan", text: "See which areas need more or less, then download a map for your tractor." },
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y bg-[#f7f3ea]" aria-labelledby="how-title">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-title" className="mt-3 font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[2.7rem]">
            Three steps. About a minute.
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={0.06 * i}>
              <li className="h-full rounded-2xl bg-white p-7 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-field-50 text-field-700">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={0.1} className="mt-14">
          <figure>
            <div className="overflow-hidden rounded-[1.5rem] border bg-white shadow-[var(--shadow-card)]">
              <Image src="/images/app-preview.jpg" alt="The NitroZone results screen: a real Missouri field divided into colored zones, with a health score and fertilizer savings" width={1600} height={1000} sizes="(max-width: 1200px) 95vw, 1100px" className="h-auto w-full" />
            </div>
            <figcaption className="mt-4 text-center text-sm text-muted-foreground">A real field in Audrain County, Missouri, analyzed with NitroZone.</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- benefits
export function Benefits() {
  const items = [
    { title: "Save money on fertilizer", text: "Put fertilizer where it helps the crop, and cut back where the crop is already doing well." },
    { title: "Protect our water", text: "Less extra fertilizer on the field means less washing into the streams and rivers we all share." },
    { title: "Works with your equipment", text: "Download a standard prescription file your sprayer or spreader can use, plus a simple PDF report." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="benefits-title">
      <Reveal className="max-w-2xl">
        <Eyebrow>What farmers get</Eyebrow>
        <h2 id="benefits-title" className="mt-3 font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[2.7rem]">
          Better for the farm. Better for the river.
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={0.06 * i}>
            <div className={cn("border-t-2 pt-5", i === 0 ? "border-field-600" : i === 1 ? "border-river-500" : "border-harvest-400")}>
              <h3 className="font-display text-xl font-semibold">{it.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{it.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- mission
export function Mission() {
  return (
    <section className="px-5 pb-20 sm:px-8" aria-label="Our mission">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem]">
          <Image src="/images/farmer-in-corn.jpg" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/10" />
          <div className="relative max-w-xl px-8 py-20 text-white sm:px-14 sm:py-24">
            <h2 className="font-display text-[2rem] font-bold leading-[1.15] tracking-[-0.025em] sm:text-[2.5rem]">Built for the farmers who feed us, and the rivers we share.</h2>
            <p className="mt-4 text-lg text-white/80">Try it on a real Missouri field. It takes about a minute.</p>
            <Button asChild size="xl" variant="accent" className="mt-8 rounded-xl px-6 text-base">
              <Link href="/app?demo=1">
                Try it now <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// -------------------------------------------------------------------- FAQ
export function Faq() {
  const qs = [
    ["Does it cost anything?", "No. NitroZone is free and uses free satellite photos from the European Space Agency. You don't need an account."],
    ["Which crops does it work for?", "Crops that need nitrogen fertilizer during the season, like corn, wheat and sorghum. It was built and tested on Missouri corn. Crops like soybeans make their own nitrogen, so they usually don't need it."],
    ["Does it replace walking my fields?", "No. A satellite can see where crops look weaker, but not always why. NitroZone points you to the spots worth checking, and you can change any area before you download your plan."],
    ["Can my tractor use the file?", "NitroZone exports a standard shapefile with a fertilizer rate for every area, which many sprayers, spreaders and farm apps can import. Check your equipment's instructions before heading out."],
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-24 sm:px-8" aria-labelledby="faq-title">
      <Reveal className="text-center">
        <h2 id="faq-title" className="font-display text-[2.2rem] font-bold tracking-[-0.03em]">
          Common questions
        </h2>
      </Reveal>
      <Reveal delay={0.08}>
        <Accordion type="single" collapsible className="mt-10">
          {qs.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="py-5 text-left text-[1.05rem] font-semibold hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[1rem] leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

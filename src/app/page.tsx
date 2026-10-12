import { SiteNav } from "@/components/landing/site-nav";
import { Faq, Features, FinalCta, Hero, HowItWorks, Problem, Science, SourcesStrip } from "@/components/landing/sections";
import { SiteFooter } from "@/components/site/site-footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <SourcesStrip />
        <Problem />
        <HowItWorks />
        <Features />
        <Science />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

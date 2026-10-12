import { SiteNav } from "@/components/landing/site-nav";
import { Benefits, Faq, Hero, HowItWorks, Mission, WhyItMatters } from "@/components/landing/sections";
import { SiteFooter } from "@/components/site/site-footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <WhyItMatters />
        <HowItWorks />
        <Benefits />
        <Mission />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}

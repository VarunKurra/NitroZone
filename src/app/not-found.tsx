import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto size-10" />
        <h1 className="mt-5 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">This page doesn&apos;t exist. Let&apos;s get you back to the field.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-[#15653d] px-5 font-medium text-white hover:bg-[#105233]">
            Home
          </Link>
          <Link href="/app" className="inline-flex h-11 items-center rounded-xl border bg-white px-5 font-medium">
            Try it now
          </Link>
        </div>
      </div>
    </main>
  );
}

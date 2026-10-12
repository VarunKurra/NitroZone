import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "NitroZone: the right amount of fertilizer for every part of your field", template: "%s | NitroZone" },
  description:
    "NitroZone uses free satellite images to show farmers which parts of a field need more fertilizer and which need less, saving money and keeping our rivers cleaner.",
  applicationName: "NitroZone",
  keywords: ["variable rate nitrogen", "corn", "Missouri", "sidedress", "NDRE", "Sentinel-2", "prescription map", "precision agriculture"],
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#15653d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, page assistants) add attributes to <html>/<body>
    // before React loads. This only silences attribute differences on these two elements.
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

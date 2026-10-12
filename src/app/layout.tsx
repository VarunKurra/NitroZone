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
  title: { default: "NitroZone: variable-rate nitrogen for Missouri corn", template: "%s | NitroZone" },
  description:
    "Draw your corn field, analyze Sentinel-2 red-edge imagery, and download a variable-rate nitrogen prescription for your sidedress controller. Free, open data.",
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} h-full`}>
      <body className="min-h-full flex flex-col">
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

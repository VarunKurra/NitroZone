/**
 * Loads Geist (SIL Open Font License, bundled in /public/fonts) for the PDF report so it
 * matches the app's typography. Falls back to Helvetica if the fonts can't be fetched.
 */
import type { PdfFonts } from "./pdf";

let cache: Promise<PdfFonts> | null = null;

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function loadPdfFonts(): Promise<PdfFonts> {
  cache ??= Promise.all([toBase64("/fonts/Geist-Regular.ttf"), toBase64("/fonts/Geist-Bold.ttf")])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch(() => ({}));
  return cache;
}

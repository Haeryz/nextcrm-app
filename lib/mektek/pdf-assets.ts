import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const MEKTEK_PDF_LOGO_PATH = resolve(
  process.cwd(),
  "public/images/logo-pt-mektek-tanjung-lestari.jpg",
);

// react-pdf only resolves `Image src` file paths reliably through its own
// file-fetcher, which fails silently on Windows/standalone layouts; embedding
// the bytes as a data URI keeps the logo rendering in every runtime.
let mektekPdfLogoSource: string | null = null;

export function getMektekPdfLogoSource(): string | null {
  if (mektekPdfLogoSource === null) {
    try {
      mektekPdfLogoSource = `data:image/jpeg;base64,${readFileSync(
        MEKTEK_PDF_LOGO_PATH,
      ).toString("base64")}`;
    } catch {
      mektekPdfLogoSource = "";
    }
  }
  return mektekPdfLogoSource || null;
}

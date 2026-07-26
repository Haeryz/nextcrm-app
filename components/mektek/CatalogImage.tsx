"use client";

import Image from "next/image";
import React, { useState } from "react";

/**
 * Catalog thumbnail with a graceful "No image" fallback when the src is
 * missing or fails to load (e.g. a DB imagePath with no deployed file).
 *
 * Sizing: every caller wraps this in a box that already has a height
 * (`aspect-[4/3]`, `aspect-[16/9]`, `size-16`), so we use `fill` rather than
 * intrinsic width/height — the source files have no consistent dimensions. The
 * `relative` wrapper below is what `fill` positions against; it is `size-full`
 * so the rendered box is identical to the previous bare `<img className="size-full">`.
 *
 * `sizes` defaults to the storefront grid (1 / 2 / 3 / 4 columns). Callers that
 * render a fixed-size thumbnail should pass their own (e.g. `sizes="64px"`) so
 * the optimizer does not generate a full-width variant for a 64px box.
 */
export function CatalogImage({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw",
}: {
  src: string | null;
  alt: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        Tidak ada gambar
      </div>
    );
  }

  // Legacy rows may still hold an absolute URL (see `getExistingCatalogImagePath`).
  // next/image would throw at runtime for any host missing from
  // `next.config.js` -> `images.remotePatterns`, so those keep the plain <img>
  // path. Same-origin catalog paths get the optimizer.
  if (/^https?:\/\//i.test(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="relative size-full">
      <Image
        src={src}
        alt={alt}
        fill
        loading="lazy"
        sizes={sizes}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

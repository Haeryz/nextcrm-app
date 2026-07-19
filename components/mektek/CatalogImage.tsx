"use client";

import { useState } from "react";

/**
 * Catalog thumbnail with a graceful "No image" fallback when the src is
 * missing or fails to load (e.g. a DB imagePath with no deployed file).
 */
export function CatalogImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        Tidak ada gambar
      </div>
    );
  }

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

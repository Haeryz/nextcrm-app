import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { siteBaseUrl } from "@/lib/site-url";

// Only the public storefront is worth crawling. The staff area (`/:locale/mektek/*`)
// is auth-gated, the customer account pages are personal, and the API routes are
// machine-only, so none of those belong in a sitemap.
const PUBLIC_PATHS = ["/customer"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBaseUrl();
  const locales = routing.locales;
  const now = new Date();

  return PUBLIC_PATHS.flatMap((path) =>
    locales.map((locale) => {
      const languages: Record<string, string> = {};
      for (const alt of locales) {
        languages[alt] = `${base}/${alt}${path}`;
      }
      // Tell Google which locale is the default when none matches.
      languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;

      return {
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 1,
        alternates: { languages },
      };
    })
  );
}

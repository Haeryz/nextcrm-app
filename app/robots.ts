import type { MetadataRoute } from "next";

import { siteBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();

  return {
    rules: {
      userAgent: "*",
      // The storefront landing/catalog under `/:locale/customer` is the only
      // indexable surface. Everything else is auth-gated, personal, or
      // machine-only.
      allow: "/",
      disallow: [
        "/api/",
        "/*/mektek/",
        "/*/customer/profile",
        "/*/customer/access",
        "/*/sign-in",
        "/*/pending",
        "/*/s/",
        "/*/service-status/",
        "/*/unsubscribe",
        "/*/wa-optout",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

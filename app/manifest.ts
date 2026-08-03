import type { MetadataRoute } from "next";

// Web app manifest — lets users "Add to Home Screen" and gives Google/PWA
// crawlers structured app metadata. Brand name is a proper noun so it stays
// as-is; the description follows the Bahasa Indonesia localisation policy.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MekTek — Bengkel Resmi Denso & Dealer AC",
    short_name: "MekTek",
    description:
      "Dealer resmi pendingin udara dan bengkel resmi Denso di Tabalong. Servis AC mobil, tune-up mesin, ganti oli, aki, rem, dan suspensi.",
    start_url: "/id/customer",
    display: "standalone",
    background_color: "#10164f",
    theme_color: "#10164f",
    lang: "id",
    categories: ["auto", "business", "shopping"],
    icons: [
      {
        src: "/images/logo-pt-mektek-tanjung-lestari.jpg",
        sizes: "350x350",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

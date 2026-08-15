import "./globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ReactNode } from "react";

import { NextIntlClientProvider } from "next-intl";
import { getTranslations, getMessages } from "next-intl/server";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { siteBaseUrlAsUrl, siteBaseUrl } from "@/lib/site-url";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;

  const { locale } = params;

  const t = await getTranslations({ locale, namespace: "RootLayout" });

  return {
    metadataBase: siteBaseUrlAsUrl(),
    manifest: "/manifest.webmanifest",
    title: t("title"),
    description: t("description"),
    applicationName: "MekTek",
    keywords: [
      "bengkel Denso",
      "dealer AC",
      "servis AC mobil",
      "tune-up mesin",
      "ganti oli",
      "aki mobil",
      "rem dan suspensi",
      "Tabalong",
      "Kalimantan Selatan",
      "PT Mektek Tanjung Lestari",
      "MekTek",
    ],
    openGraph: {
      type: "website",
      siteName: "MekTek",
      images: [
        {
          url: "/images/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [
        {
          url: "/images/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
  };
}

export default async function RootLayout(props: Props) {
  const params = await props.params;

  const { locale } = params;

  const { children } = props;

  const messages = await getMessages();

  const base = siteBaseUrl();
  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: "PT Mektek Tanjung Lestari",
    alternateName: "MekTek",
    description:
      "Bengkel resmi Denso dan dealer resmi pendingin udara di Tabalong. Servis AC mobil, tune-up mesin, ganti oli, aki, rem, dan suspensi.",
    url: base,
    logo: `${base}/images/logo-pt-mektek-tanjung-lestari.jpg`,
    image: `${base}/images/opengraph-image.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Jl. Jend A Yani RT.01 Kel. Mabu'un",
      addressLocality: "Murung Pudak, Tabalong",
      addressRegion: "Kalimantan Selatan",
      postalCode: "71571",
      addressCountry: "ID",
    },
    areaServed: "Tabalong, Kalimantan Selatan",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "08:00",
        closes: "17:00",
      },
    ],
    knowsAbout: [
      "AC Mobil",
      "Tune-up Mesin",
      "Oli & Aki",
      "Rem & Suspensi",
    ],
  };

  return (
    <html lang={locale}>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen font-sans`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
        <SonnerToaster />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
        />
      </body>
    </html>
  );
}

const withNextIntl = require("next-intl/plugin")(
  "./i18n/request.ts"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },

  output: "standalone",

  // Don't advertise the framework (removes the X-Powered-By: Next.js header).
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "localhost" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "minio-cwg0o4ss0scoccgwso8sk004.coolify.cz" },
    ],
  },

  async headers() {
    return [
      // Global baseline security headers for every route. `frame-ancestors 'none'`
      // (plus X-Frame-Options) blocks clickjacking of the admin panel and customer
      // portal. We deliberately set only the frame-ancestors CSP directive here — a
      // full Content-Security-Policy would break Next's inline scripts and the
      // Midtrans Snap widget, so that is intentionally deferred.
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // The customer tracking pages embed access secrets in the URL (?token / ?code,
      // or a short /s/<code> path). Suppress the Referer header on these pages so the
      // secret can't leak to third parties via outbound links or embedded resources.
      // These come AFTER the global entry so the stricter no-referrer value wins here
      // (Next applies all matching entries; the last-set value for a header wins).
      {
        source: "/:locale/s/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/:locale/service-status/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/:locale/crm/targets/:path*",
        destination: "/:locale/campaigns/targets/:path*",
        permanent: true,
      },
      {
        source: "/:locale/crm/target-lists/:path*",
        destination: "/:locale/campaigns/target-lists/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
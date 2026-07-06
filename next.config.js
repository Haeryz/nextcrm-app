const withNextIntl = require("next-intl/plugin")(
  "./i18n/request.ts"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },

  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "localhost" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "minio-cwg0o4ss0scoccgwso8sk004.coolify.cz" },
    ],
  },

  async headers() {
    // The customer tracking pages embed access secrets in the URL (?token / ?code,
    // or a short /s/<code> path). Suppress the Referer header on these pages so the
    // secret can't leak to third parties via outbound links or embedded resources.
    return [
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
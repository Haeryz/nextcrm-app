const withNextIntl = require("next-intl/plugin")(
  "./i18n/request.ts"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },

  output: "standalone",

  // `baileys` ships a 2MB bundle with its Rust bridge inlined as base64 WASM, and
  // pulls in protobufjs (which resolves modules dynamically). Bundling either one
  // is pointless work at best and breaks the WASM/proto loading at worst, so leave
  // both to Node's own resolver.
  //
  // whatsapp-web.js drives a real Chromium via puppeteer. Keep it (and puppeteer)
  // out of the bundler so it is never traced/bundled into serverless routes — it
  // only runs on a long-lived server with Chrome, and bundling Chromium crashes
  // Vercel functions. Combined with the lazy `import()` in lib/whatsapp/*, routes
  // that merely reference the module no longer pull the browser in at cold start.
  // The rest below are server-only too (verified: no "use client" file imports any
  // of them). @react-pdf/renderer and xlsx are multi-MB with their own font and
  // codepage tables; argon2/bcrypt are native modules. Bundling them just inflates
  // the serverless functions and slows every compile.
  serverExternalPackages: [
    "baileys",
    "protobufjs",
    "whatsapp-web.js",
    "puppeteer",
    "puppeteer-core",
    "@react-pdf/renderer",
    "xlsx",
    "xlsx-js-style",
    "argon2",
    "bcrypt",
    "nodemailer",
  ],

  // Don't advertise the framework (removes the X-Powered-By: Next.js header).
  poweredByHeader: false,

  // Server Action arguments can contain passwords, OTPs, reset tokens, phone
  // numbers, or payment details. Next.js logs serialized arguments in development
  // by default, so disable that channel rather than relying on per-action redaction.
  logging: {
    serverFunctions: false,
  },

  images: {
    // Serve modern formats and keep optimized variants around for a month instead
    // of the 60s default, so repeat views don't re-run the optimizer.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: [
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

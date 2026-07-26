// Single source for the product name.
//
// `NEXT_PUBLIC_APP_NAME` is a NEXT_PUBLIC_* var, so it is inlined at BUILD time —
// changing it in the Vercel dashboard requires a redeploy to take effect.
//
// The fallback is not cosmetic. The email templates previously interpolated
// `process.env.NEXT_PUBLIC_APP_NAME` directly with no default, so an unset var
// rendered customer-facing copy as "Kode Verifikasi dari undefined". Always import
// APP_NAME rather than reading the env var inline.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "MektekCRM";

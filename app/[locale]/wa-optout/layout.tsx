import type { ReactNode } from "react";

/**
 * Mirrors app/[locale]/customer/layout.tsx: this route is public and must stay
 * OUTSIDE the (routes) group, whose layout redirects unauthenticated visitors to
 * /sign-in. The customer opening this link is logged out, on a phone, inside
 * WhatsApp's in-app browser.
 */
export default function WhatsAppOptOutLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="customer-light min-h-screen">{children}</div>;
}

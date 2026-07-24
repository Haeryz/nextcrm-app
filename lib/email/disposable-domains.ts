import "server-only";

import { prismadb } from "@/lib/prisma";
import { normalizeEmail, extractDomain } from "@/lib/email/validation";

// Disposable/temp email domain blocklist. Two layers:
//   1. The BlockedEmailDomain table — source of truth; admin overrides and
//      auto-bounce additions land here. Checked first so admin removals win.
//   2. The vendored disposable-email-domains npm package — offline fast-path
//      so the table can be empty (e.g. fresh migrations) and we still block.

// The package resolves to index.json (a CJS array of domain strings). Loaded
// once at module init into a Set for O(1) lookup.
const vendoredList: string[] = require("disposable-email-domains") as string[];
const VENDORED_DISPOSABLE = new Set(
  vendoredList.map((d) => String(d).toLowerCase().trim()),
);

export class DisposableEmailError extends Error {
  constructor() {
    super("Email dari domain ini tidak diizinkan");
    this.name = "DisposableEmailError";
  }
}

export async function isDisposableDomain(
  domain: string
): Promise<boolean> {
  const key = domain.toLowerCase().trim();
  if (!key) return false;

  // Admin-managed table wins. A row here means blocked regardless of the
  // vendored list; absence falls through to the vendored fast-path.
  const blocked = await prismadb.blockedEmailDomain.findUnique({
    where: { domain: key },
    select: { domain: true },
  });
  if (blocked) return true;

  return VENDORED_DISPOSABLE.has(key);
}

export async function assertNotDisposable(rawEmail: string): Promise<void> {
  const normalized = normalizeEmail(rawEmail);
  if (!normalized) return; // invalid emails are rejected by the caller, not here
  const domain = extractDomain(normalized);
  if (!domain) return;
  if (await isDisposableDomain(domain)) {
    throw new DisposableEmailError();
  }
}

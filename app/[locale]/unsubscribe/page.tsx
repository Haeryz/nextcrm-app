import type { ReactNode } from "react";

import { peekUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prismadb } from "@/lib/prisma";
import { UnsubscribeComponent } from "./components/UnsubscribeComponent";

// This page deliberately lives OUTSIDE the (routes) group. Its audience is an
// email recipient who is almost never signed in; inside (routes) the app-shell
// layout bounced them to /sign-in (or, for customers, to their profile), which
// made the unsubscribe link unusable for exactly the people it is for.
function UnsubscribeShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      {children}
    </main>
  );
}

// Renders the unsubscribe confirmation. The token is NOT consumed on GET so
// the link stays valid if the user navigates back — consumption only happens
// on the explicit POST confirm (RFC 8058 one-click or the in-page button).
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; channel?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token ?? "");
  const channel = String(params.channel ?? "");

  if (!token) {
    return (
      <UnsubscribeShell>
        <UnsubscribeComponent status="invalid" />
      </UnsubscribeShell>
    );
  }

  const peeked = await peekUnsubscribeToken(token);
  if (!peeked) {
    return (
      <UnsubscribeShell>
        <UnsubscribeComponent status="invalid" />
      </UnsubscribeShell>
    );
  }

  if (peeked.channel !== channel) {
    return (
      <UnsubscribeShell>
        <UnsubscribeComponent status="invalid" />
      </UnsubscribeShell>
    );
  }

  const user = await prismadb.users.findUnique({
    where: { id: peeked.userId },
    select: { name: true },
  });

  return (
    <UnsubscribeShell>
      <UnsubscribeComponent
        status="valid"
        token={token}
        channel={peeked.channel}
        username={user?.name ?? null}
      />
    </UnsubscribeShell>
  );
}

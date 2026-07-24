import { redirect } from "next/navigation";
import { peekUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prismadb } from "@/lib/prisma";
import { UnsubscribeComponent } from "./components/UnsubscribeComponent";

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
    return <UnsubscribeComponent status="invalid" />;
  }

  const peeked = await peekUnsubscribeToken(token);
  if (!peeked) {
    return <UnsubscribeComponent status="invalid" />;
  }

  if (peeked.channel !== channel) {
    return <UnsubscribeComponent status="invalid" />;
  }

  const user = await prismadb.users.findUnique({
    where: { id: peeked.userId },
    select: { name: true },
  });

  return (
    <UnsubscribeComponent
      status="valid"
      token={token}
      channel={peeked.channel}
      username={user?.name ?? null}
    />
  );
}

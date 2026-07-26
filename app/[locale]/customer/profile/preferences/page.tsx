import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { readEmailPreference } from "@/actions/email/preferences";
import { getCustomerAuthSession } from "@/lib/customer-auth";
import { prismadb } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { CustomerEmailPreferencesForm } from "./_components/CustomerEmailPreferencesForm";

// Accounts created from a phone number only carry a synthesized address that no
// inbox is ever behind, so opting in would be meaningless for them.
const PHONE_PLACEHOLDER_SUFFIX = "@phone.nextcrm.local";

interface CustomerPreferencesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CustomerPreferencesPage({
  params,
}: CustomerPreferencesPageProps) {
  const { locale } = await params;
  const session = await getCustomerAuthSession();

  if (!session?.user?.id) {
    redirect(
      `/${locale}/customer/access?next=${encodeURIComponent(
        `/${locale}/customer/profile/preferences`
      )}`
    );
  }

  const userId = session.user.id;
  const user = await prismadb.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const email = user?.email ?? "";
  const hasRealEmail =
    email.length > 0 &&
    !email.toLowerCase().endsWith(PHONE_PLACEHOLDER_SUFFIX);

  // Session already resolved above, so the internal reader is used instead of
  // paying for a second session lookup inside getEmailPreference.
  const preference = await readEmailPreference(userId);

  return (
    <main className="min-h-screen bg-muted text-[hsl(var(--brand-navy-ink))]">
      <section className="border-b border-primary/10 bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
          <Link
            href={`/${locale}/customer`}
            className="flex min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MektekBrandMark textClassName="text-secondary-foreground" />
          </Link>

          <div>
            <Badge className="bg-[hsl(var(--brand-yellow))] text-secondary-foreground hover:bg-[hsl(var(--brand-yellow))]">
              Preferensi email
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Atur email yang Anda terima
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Anda yang menentukan. Email penting seperti kode verifikasi, status
              servis, dan bukti pembayaran tetap dikirim karena bagian dari layanan
              Anda.
            </p>
          </div>

          <div>
            <Button asChild variant="outline" className="h-11">
              <Link href={`/${locale}/customer/profile`}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Kembali ke profil
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="preferences-section-heading"
        className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8 md:px-6"
      >
        {!hasRealEmail ? (
          <Card className="rounded-xl border-primary/10 bg-card shadow-sm">
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div>
                <h2
                  id="preferences-section-heading"
                  className="text-lg font-semibold"
                >
                  Belum ada alamat email pada akun ini
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Akun Anda dibuat dari nomor telepon saja, sehingga kami belum dapat
                  mengirimkan email apa pun. Hubungi tim Mektek untuk menambahkan
                  alamat email Anda, lalu preferensi ini dapat diatur di sini.
                </p>
              </div>
              <Button asChild variant="outline" className="h-11">
                <Link href={`/${locale}/customer/profile`}>Kembali ke profil</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <h2 id="preferences-section-heading" className="sr-only">
              Preferensi email
            </h2>
            <CustomerEmailPreferencesForm
              userId={userId}
              email={email}
              marketing={preference?.marketingOptedInAt !== null && preference?.marketingOptedInAt !== undefined}
              offers={preference?.offersOptedInAt !== null && preference?.offersOptedInAt !== undefined}
            />
          </>
        )}
      </section>
    </main>
  );
}

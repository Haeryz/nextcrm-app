import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Phone, UserRound } from "lucide-react";

import { getMektekCustomerProfile } from "@/actions/mektek/customer-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerServiceLiveCard } from "./_components/CustomerServiceLiveCard";
import { CustomerVoucherList } from "./_components/CustomerVoucherList";

interface CustomerProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CustomerProfilePage({
  params,
}: CustomerProfilePageProps) {
  const { locale } = await params;
  const result = await getMektekCustomerProfile(locale);

  if (result.error === "Unauthorized") {
    redirect("/sign-in");
  }

  const profile = result.data;

  if (!profile) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">
              Customer profile could not be loaded.
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="secondary">Customer profile</Badge>
              {profile.customer?.customerType === "B2B" && (
                <Badge variant="outline" className="ml-2">
                  B2B
                </Badge>
              )}
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Track your Mektek services
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Service orders linked to your phone number update here in real time as
                the admin and technician team changes progress.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href={`/${locale}/customer`}>Customer home</Link>
              </Button>
              <Button asChild>
                <Link href={`/${locale}/customer?view=sparepart`}>Open catalogue</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <UserRound className="size-5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="truncate text-sm font-semibold">
                    {profile.user.name || profile.customer?.username || "Customer"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Phone className="size-5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="truncate text-sm font-semibold">
                    {profile.user.phone || profile.customer?.phone || "Not set"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <ClipboardList className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Services</p>
                  <p className="text-sm font-semibold">{profile.services.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 md:px-6">
        {profile.needsPhoneAccount && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              This session is not linked to a phone-based customer account. Sign in
              with your phone number to see service tracking.
            </CardContent>
          </Card>
        )}

        {!profile.needsPhoneAccount && profile.vouchers.length > 0 && (
          <CustomerVoucherList vouchers={profile.vouchers} />
        )}

        {!profile.needsPhoneAccount && profile.services.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-lg font-semibold">No services linked yet</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                When an admin creates a service order using this phone number, it
                will appear here automatically.
              </p>
            </CardContent>
          </Card>
        )}

        {profile.services.map((service) => (
          <CustomerServiceLiveCard
            key={service.id}
            initialSnapshot={service.snapshot}
            streamHref={service.streamHref}
            invoiceHref={service.invoiceHref}
            receiptHref={service.receiptHref}
            publicHref={service.publicHref}
            payToken={service.token}
          />
        ))}
      </section>
    </main>
  );
}

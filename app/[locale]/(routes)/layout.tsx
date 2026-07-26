import { getServerSession } from "@/lib/session";

import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { Metadata } from "next";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { CommandPaletteLazy } from "./components/command-palette-lazy";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL! || "http://localhost:3000"
  ),
  title: "",
  description: "",
  openGraph: {
    images: [
      {
        url: "/images/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/images/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "",
      },
    ],
  },
};

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Independent — resolve concurrently. This layout runs on every authenticated
  // navigation, so the serial round-trip here was paid by every page in the app.
  const [{ locale }, session, cookieStore] = await Promise.all([
    params,
    getServerSession(authOptions),
    cookies(),
  ]);

  //console.log(session, "session");

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session?.user;

  if (user?.userStatus === "PENDING") {
    return redirect("/pending");
  }

  if (user?.userStatus === "INACTIVE") {
    return redirect("/inactive");
  }

  if (!canAccessMektekStaffArea(user)) {
    return redirect(`/${locale}/customer/profile`);
  }

  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar session={session} />
      <SidebarInset className="h-svh overflow-hidden">
        <CommandPaletteLazy user={session?.user ?? null} locale={locale} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:border focus:ring-2 focus:ring-ring"
        >
          Lompat ke konten utama
        </a>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
          <SidebarTrigger
            aria-label="Buka menu navigasi"
            className="size-9 shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {process.env.NEXT_PUBLIC_APP_NAME || "NextCRM"}
            </p>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto w-full min-w-0">
          <div className="w-full min-w-0 py-5">
            <div id="main-content" className="w-full min-w-0 px-4">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

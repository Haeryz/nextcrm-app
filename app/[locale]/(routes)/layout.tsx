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
  const { locale } = await params;
  const session = await getServerSession(authOptions);

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

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar session={session} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
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
        <div className="flex flex-col flex-grow overflow-y-auto h-full w-full min-w-0">
          <div className="flex-grow py-5 w-full min-w-0">
            <div className="w-full px-4 min-w-0">
              {children} 
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

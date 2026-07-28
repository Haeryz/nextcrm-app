"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import getMektekMenuItems from "./menu-items/Mektek";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import { APP_NAME } from "@/lib/brand";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  logisticsStaffArea?: LogisticsStaffArea | null;
  userStatus?: string;
  userLanguage?: string;
  lastLoginAt?: Date;
}

interface Session {
  user: User;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  session: Session;
}

export function AppSidebar({
  session,
  ...props
}: AppSidebarProps) {
  const { state, isMobile } = useSidebar();
  const params = useParams<{ locale?: string }>();
  const locale = params.locale || "id";
  const isExpanded = isMobile || state === "expanded";

  const navItems = canAccessMektekStaffArea(session?.user)
    ? getMektekMenuItems(session?.user)
    : [];

  // Prepare user data for NavUser component
  const userData = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.image,
  };

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className="px-3 pb-2 pt-3 group-data-[collapsible=icon]:px-2">
        <div
          className={cn(
            "flex min-h-11 items-center",
            isExpanded ? "gap-x-3" : "justify-center",
          )}
        >
          <Link
            href={`/${locale}/mektek/dashboard`}
            className="flex min-w-0 items-center gap-x-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${APP_NAME} — Dasbor`}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-sm ring-1 ring-primary-foreground/10">
              <span className="text-base font-bold leading-none">M</span>
            </div>
            <div
              className={cn(
                "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out",
                !isExpanded
                  ? "max-w-0 -translate-x-1 opacity-0"
                  : "max-w-48 translate-x-0 opacity-100",
              )}
            >
              <h1 className="truncate text-base font-semibold leading-tight">
                {APP_NAME}
              </h1>
              <p className="mt-0.5 truncate text-xs text-sidebar-foreground/60">
                Workspace staf
              </p>
            </div>
          </Link>
          <SidebarTrigger
            aria-label="Tutup menu navigasi"
            className="ml-auto size-10 shrink-0 rounded-lg md:hidden"
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator className="opacity-70" />

      <SidebarContent className="overscroll-contain">
        <NavMain items={navItems} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 px-3 py-3 group-data-[collapsible=icon]:px-2">
        <NavUser user={userData} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

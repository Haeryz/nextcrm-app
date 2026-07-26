"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
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

/**
 * AppSidebar Component - Task Groups 1.2, 2.2-2.7, 3.1, 5.3, 5.4
 *
 * Core sidebar component for MektekCRM application layout.
 * Implements shadcn/ui sidebar pattern with:
 * - Logo and "N" branding symbol with rotation animation
 * - Build version display in footer (when expanded)
 * - Navigation with Mektek workspace items
 * - Nav-user section in footer for user profile and actions
 *
 * Phase 3 Updates:
 * - Task 3.1: Added NavUser component in SidebarFooter
 * - NavUser displays user avatar, name, email
 * - NavUser provides dropdown with user actions (Profile, Settings, Logout)
 * - NavUser adapts to collapsed/expanded sidebar states
 * - Build version moved above NavUser in footer
 *
 * Phase 5 Updates (Design Consistency):
 * - Task 5.3: Removed duration-200 from app name animation (uses Tailwind default)
 * - Task 5.3: Kept duration-500 on "N" symbol for intentional brand emphasis
 * - Task 5.4: Changed build version text-gray-500 to text-muted-foreground for theme support
 *
 * @param modules - Array of enabled modules from system_Modules_Enabled table
 * @param dict - Localization dictionary for navigation labels
 * @param build - Build number for version display
 * @param session - User session data for role-based navigation and user profile
 */

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
    <Sidebar collapsible="icon" {...props}>
      {/* Header with Logo and Branding */}
      <SidebarHeader>
        <div
          className={cn(
            "flex items-center py-1",
            isExpanded ? "gap-x-4" : "justify-center",
          )}
        >
          {/* Brand mark with rotation animation. Kept in sync with the product
              name beside it — it read "N" long after the rename to MektekCRM. */}
          <div
            className={cn(
              "flex-shrink-0 border rounded-full px-4 py-2 transition-transform duration-500",
              isExpanded && "rotate-[360deg]",
            )}
            aria-hidden="true"
          >
            M
          </div>

          {/* App Name - visible when expanded, hidden when collapsed */}
          <h1
            className={cn(
              "origin-left font-medium text-xl transition-all overflow-hidden whitespace-nowrap",
              !isExpanded ? "w-0 opacity-0" : "w-auto opacity-100",
            )}
          >
            {APP_NAME}
          </h1>
          <SidebarTrigger
            aria-label="Tutup menu navigasi"
            className="ml-auto size-9 md:hidden"
          />
        </div>
      </SidebarHeader>

      {/* Main Content - Navigation */}
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>

      {/* Footer with NavUser and Build Version */}
      <SidebarFooter>
        {/* Task 3.1: NavUser component with user profile and actions */}
        <NavUser user={userData} />
      </SidebarFooter>

      {/* Rail for toggling sidebar on desktop */}
      <SidebarRail />
    </Sidebar>
  );
}

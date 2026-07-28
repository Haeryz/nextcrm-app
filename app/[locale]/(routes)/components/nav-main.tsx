"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type LucideIcon, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { isNavigationRouteActive } from "@/lib/navigation/route-matching"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * NavMain Component
 *
 * Primary navigation component for the sidebar.
 * Features:
 * - Renders navigation items with icons and labels
 * - Supports collapsible groups for module dropdowns
 * - Active state detection using usePathname()
 * - Supports nested navigation items
 * - Active accent bar on top-level items for clear orientation
 *
 * @param items - Array of navigation items (can be simple or grouped)
 * @param dict - Localization dictionary for labels
 */

export interface NavItem {
  title: string
  url?: string
  icon?: LucideIcon
  isActive?: boolean
  exact?: boolean
  items?: NavSubItem[] // For collapsible groups
}

export interface NavSubItem {
  title: string
  url?: string
  isActive?: boolean
  exact?: boolean
  items?: NavSubItem[]
}

interface NavMainProps {
  items: NavItem[]
}

/**
 * Active accent indicator — a subtle left bar that marks the active top-level
 * route. Hidden in icon-collapsed mode since the sidebar is too narrow.
 */
function ActiveAccent() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -left-1 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary group-data-[collapsible=icon]:hidden"
    />
  )
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname()
  const { isMobile, setOpen, setOpenMobile, state } = useSidebar()

  const closeMobileNavigation = () => {
    if (isMobile) setOpenMobile(false)
  }

  const isRouteActive = (url: string, exact?: boolean): boolean => {
    return isNavigationRouteActive(pathname, url, exact)
  }

  const hasActiveChild = (subItems?: NavSubItem[]): boolean => {
    if (!subItems) return false
    return subItems.some(
      (item) =>
        item.isActive ||
        (item.url ? isRouteActive(item.url, item.exact) : false) ||
        hasActiveChild(item.items),
    )
  }

  const expandCollapsedNavigation = () => {
    if (!isMobile && state === "collapsed") {
      setOpen(true)
    }
  }

  const renderSubItem = (subItem: NavSubItem, depth = 0): React.ReactNode => {
    if (subItem.items && subItem.items.length > 0) {
      const hasActive = subItem.isActive || hasActiveChild(subItem.items)
      return (
        <Collapsible
          key={`${subItem.title}-${hasActive}`}
          asChild
          defaultOpen={hasActive}
          className="group/nested-collapsible"
        >
          <SidebarMenuSubItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuSubButton
                asChild
                isActive={hasActive}
                className="min-h-9 rounded-lg px-3"
              >
                <button type="button" className="w-full">
                  <span>{subItem.title}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="ml-auto transition-transform group-data-[state=open]/nested-collapsible:rotate-90"
                  />
                </button>
              </SidebarMenuSubButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className={cn(depth > 0 && "mr-0 pr-0")}>
                {subItem.items.map((child) =>
                  renderSubItem(child, depth + 1),
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuSubItem>
        </Collapsible>
      )
    }

    if (!subItem.url) return null
    const isActive =
      subItem.isActive || isRouteActive(subItem.url, subItem.exact)
    return (
      <SidebarMenuSubItem key={subItem.title}>
        <SidebarMenuSubButton
          asChild
          isActive={isActive}
          className="min-h-9 rounded-lg px-3 data-[active=true]:font-medium data-[active=true]:text-primary"
        >
          <Link
            href={subItem.url}
            onClick={closeMobileNavigation}
            aria-current={isActive ? "page" : undefined}
          >
            <span>{subItem.title}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarGroup className="px-3 py-3 group-data-[collapsible=icon]:px-2">
      <SidebarGroupLabel className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em]">
        Menu utama
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1.5">
        {items.map((item) => {
          if (item.items && item.items.length > 0) {
            const hasActive = item.isActive || hasActiveChild(item.items)

            return (
              <Collapsible
                key={`${item.title}-${hasActive}`}
                asChild
                defaultOpen={hasActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  {hasActive && <ActiveAccent />}
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={hasActive}
                      onClick={expandCollapsedNavigation}
                      className="min-h-10 rounded-lg px-3 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                    >
                      {item.icon && <item.icon />}
                      <span className="font-medium">{item.title}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => renderSubItem(subItem))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          }

          if (!item.url) return null
          const isActive =
            item.isActive || isRouteActive(item.url, item.exact)
          return (
            <SidebarMenuItem key={item.title}>
              {isActive && <ActiveAccent />}
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive}
                className="min-h-10 rounded-lg px-3 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
              >
                <Link
                  href={item.url}
                  onClick={closeMobileNavigation}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.icon && <item.icon />}
                  <span className="font-medium">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

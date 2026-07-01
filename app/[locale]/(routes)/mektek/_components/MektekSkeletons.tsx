import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading skeletons for the MekTek routes.
 *
 * These are rendered by the per-route `loading.tsx` files so that navigating
 * between sidebar sections swaps to a skeleton instantly instead of blocking
 * on the server component's data fetch.
 */

function FilterBarSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

/** List/table style pages: Orders, Items, Customers. */
export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <FilterBarSkeleton />
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
      <PaginationSkeleton />
    </div>
  );
}

/** Card grid style page: catalogue Items. */
export function CardGridSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <FilterBarSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <PaginationSkeleton />
    </div>
  );
}

/** Operational dashboard: stat cards + recent orders. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** WhatsApp config: session card + templates card. */
export function WhatsAppSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Skeleton className="h-48 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, CalendarClock, Car, Clock3, UserRound, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getStatusMeta } from "../_lib/constants";

type MektekOrder = {
  id: string;
  title: string | null;
  content?: string | null;
  taskStatus: string | null;
  dueDateAt: Date | null;
  updatedAt: Date | null;
  createdAt?: Date | null;
  tags: unknown;
  assigned_user?: {
    id: string;
    name: string | null;
    email?: string | null;
  } | null;
};

type TimelineItem = {
  completed: boolean;
};

type MektekOrderListProps = {
  orders: MektekOrder[];
  emptyMessage: string;
  density?: "comfortable" | "compact";
  locale?: string;
};

const formatDate = (date: Date | null | undefined) =>
  date ? date.toLocaleDateString("id-ID") : "Not set";

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

const getText = (
  tags: Record<string, unknown>,
  key: string,
  fallback: string
) => {
  const value = tags[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
};

const getTimeline = (tags: Record<string, unknown>): TimelineItem[] => {
  const timeline = tags.timeline;
  if (!Array.isArray(timeline)) return [];

  return timeline
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      return {
        completed: typeof row.completed === "boolean" ? row.completed : true,
      };
    })
    .filter((item): item is TimelineItem => item !== null);
};

export default function MektekOrderList({
  orders,
  emptyMessage,
  density = "comfortable",
  locale = "en",
}: MektekOrderListProps) {
  if (orders.length === 0) {
    return (
      <Card className="border">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
      data-testid="mektek-order-list"
    >
      <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)_minmax(150px,0.8fr)_120px_36px] gap-4 border-b bg-muted/35 px-4 py-3 text-xs font-medium uppercase text-muted-foreground lg:grid">
        <span>Customer / vehicle</span>
        <span>Status</span>
        <span>Technician</span>
        <span>Schedule</span>
        <span>Current state</span>
        <span className="sr-only">Open</span>
      </div>
      <div className="divide-y">
        {orders.map((order) => {
          const tags = parseTags(order.tags);
          const customerName = getText(tags, "customerName", "Unknown customer");
          const vehicle = getText(tags, "vehicle", order.title ?? "Unknown vehicle");
          const timeline = getTimeline(tags);
          const status = getStatusMeta(order.taskStatus);
          const timelineCount = timeline.length || 1;
          const technicianName = order.assigned_user?.name || order.assigned_user?.email || "Unassigned";

          return (
            <Link
              key={order.id}
              href={`/${locale}/mektek/${order.id}`}
              data-testid="mektek-order-row"
              className={cn(
                "grid gap-3 px-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)_minmax(150px,0.8fr)_120px_36px] lg:items-center lg:gap-4",
                density === "compact" ? "py-3" : "py-4"
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-semibold">{customerName}</p>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <Car className="h-4 w-4 shrink-0" />
                  <p className="truncate">{vehicle}</p>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  ID {order.id.slice(0, 8)}
                </p>
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground lg:hidden">
                  <Wrench className="h-4 w-4 shrink-0" />
                  <p className="truncate">{technicianName}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2 lg:block lg:space-y-2">
                <Badge variant={status.badgeVariant} className="max-w-full whitespace-normal">
                  {status.label}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {timelineCount} step{timelineCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
                <Wrench className="h-4 w-4 shrink-0" />
                <span className="truncate">{technicianName}</span>
              </div>

              <div className="grid min-w-0 gap-1 text-sm text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  Due {formatDate(order.dueDateAt)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  Updated {formatDate(order.updatedAt)}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Current state</p>
                <Badge
                  variant={status.badgeVariant}
                  className="max-w-full whitespace-normal px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                >
                  {status.label}
                </Badge>
              </div>

              <ArrowRight className="hidden h-4 w-4 justify-self-end text-muted-foreground lg:block" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prismadb } from "@/lib/prisma";

const ONLINE_THRESHOLD_MS = 10 * 60_000;
const onlineCutoff = () => new Date(Date.now() - ONLINE_THRESHOLD_MS);

const initialsOf = (name: string | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

async function OnlineStaffList() {
  const onlineStaff = await prismadb.users.findMany({
    where: {
      lastLoginAt: { gte: onlineCutoff() },
      userStatus: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      is_admin: true,
      mektekRole: true,
      staffDivision: true,
      lastLoginAt: true,
    },
    orderBy: { lastLoginAt: "desc" },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        <CardTitle className="text-base font-medium">Staf online</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {onlineStaff.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {onlineStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada staf online saat ini.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {onlineStaff.map((member) => (
              <li
                key={member.id}
                title={member.email}
                className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-3 text-sm"
              >
                <Avatar className="size-7 text-xs">
                  <AvatarFallback className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {initialsOf(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  {member.name ?? member.email}
                </span>
                {member.is_admin && (
                  <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                    Main admin
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OnlineStaffPanel() {
  return (
    <OnlineStaffList />
  );
}

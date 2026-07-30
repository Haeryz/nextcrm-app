"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type StaffMemberCardProps = {
  name: string;
  email: string;
  initials: string;
  divisionText: string | null;
  isOnline: boolean;
  children: ReactNode;
};

export default function StaffMemberCard({
  name,
  email,
  initials,
  divisionText,
  isOnline,
  children,
}: StaffMemberCardProps) {
  const [open, setOpen] = useState(false);
  const displayName = name || email;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Tampilkan detail ${displayName}`}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Avatar className="size-10 shrink-0 ring-1 ring-border">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{displayName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {isOnline && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                )}
                {divisionText && (
                  <Badge variant="outline" className="text-xs">
                    {divisionText}
                  </Badge>
                )}
              </div>
            </div>
            <ChevronDown
              data-state={open ? "open" : "closed"}
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import getMektekMenuItems from "./menu-items/Mektek";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";

type CommandEntry = {
  title: string;
  url: string;
  group: string;
};

type CommandPaletteUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  logisticsStaffArea?: LogisticsStaffArea | null;
  userStatus?: string | null;
};

export type CommandPaletteProps = {
  user: CommandPaletteUser | null;
  locale: string;
};

function flattenItems(
  items: ReturnType<typeof getMektekMenuItems>,
): CommandEntry[] {
  const entries: CommandEntry[] = [];
  for (const item of items) {
    if (item.url) {
      entries.push({ title: item.title, url: item.url, group: "Navigasi" });
    }
    if (item.items) {
      for (const sub of item.items) {
        const group = `${item.title}`;
        if (sub.url) {
          entries.push({ title: sub.title, url: sub.url, group });
        }
        if (sub.items) {
          for (const child of sub.items) {
            if (child.url) {
              entries.push({
                title: `${sub.title} · ${child.title}`,
                url: child.url,
                group,
              });
            }
            if (child.items) {
              for (const leaf of child.items) {
                if (leaf.url) {
                  entries.push({
                    title: `${child.title} · ${leaf.title}`,
                    url: leaf.url,
                    group: `${group} / ${sub.title}`,
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  return entries;
}

export function CommandPalette({ user, locale }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const entries = React.useMemo(() => {
    if (!user || !canAccessMektekStaffArea(user)) return [];
    return flattenItems(getMektekMenuItems(user));
  }, [user]);

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) =>
      `${entry.title} ${entry.group}`.toLowerCase().includes(normalized),
    );
  }, [entries, query]);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navigate = React.useCallback(
    (url: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/${locale}${url}`);
    },
    [router, locale],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current === 0 ? filtered.length - 1 : current - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = filtered[activeIndex];
      if (entry) navigate(entry.url);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
        setActiveIndex(0);
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Cari halaman atau aksi dengan cepat menggunakan keyboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Cari halaman atau aksi..."
            className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Cari perintah"
          />
          <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Tidak ada perintah yang cocok dengan &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul role="listbox" aria-label="Hasil pencarian perintah">
              {filtered.map((entry, index) => (
                <li
                  key={`${entry.url}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    onClick={() => navigate(entry.url)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-start justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {entry.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.group}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ↵
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

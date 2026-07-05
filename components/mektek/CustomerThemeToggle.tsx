"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomerThemeToggleProps = {
  className?: string;
};

export function CustomerThemeToggle({ className }: CustomerThemeToggleProps) {
  const { setTheme } = useTheme();

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "border-[#151a63]/20 bg-white/85 text-[#10164f] shadow-sm hover:border-[#fff200] hover:bg-[#fff200] hover:text-[#10164f]",
        "dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-[#fff200] dark:hover:bg-[#fff200] dark:hover:text-[#10164f]",
        className
      )}
      onClick={toggleTheme}
      aria-label="Toggle light and dark theme"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
      <span className="dark:hidden">Dark</span>
      <span className="hidden dark:inline">Light</span>
    </Button>
  );
}

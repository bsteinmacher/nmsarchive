"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted hover:text-foreground"
      aria-label="Theme"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
      <span className="group-data-[collapsible=icon]:hidden">Theme</span>
    </button>
  );
}

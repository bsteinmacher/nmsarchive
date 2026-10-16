import type { ReactNode } from "react";
import {
  ActivityRail,
  ActivityRailTrigger,
} from "@/components/layout/activity-rail";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring/50"
      >
        Ir ao conteúdo
      </a>
      <AppSidebar />
      <SidebarInset className="h-svh max-h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">
            Personal Archive
          </span>
          <div className="ml-auto md:hidden">
            <ActivityRailTrigger />
          </div>
        </header>
        <main
          id="conteudo"
          className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6"
        >
          {children}
        </main>
      </SidebarInset>
      <ActivityRail />
    </>
  );
}

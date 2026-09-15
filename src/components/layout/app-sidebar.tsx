"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dog,
  LayoutDashboard,
  Landmark,
  LayoutGrid,
  Package,
  Rocket,
  Settings,
  Shirt,
  Sparkles,
  Swords,
  Telescope,
  Truck,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { archiveHref, CATEGORIES, CATEGORY_META, type Category } from "@/types/nms";
import { useSaveSession } from "@/stores/save-session";

const CATEGORY_ICONS: Record<Category, ComponentType<{ className?: string }>> = {
  ship: Rocket,
  multitool: Swords,
  freighter: Truck,
  frigate: Telescope,
  companion: Dog,
  wonder: Sparkles,
  exosuit: Shirt,
  base: Landmark,
};

export function AppSidebar() {
  const pathname = usePathname();
  const saveReady = useSaveSession((s) => s.status === "ready");
  const active = (href: string) => pathname === href;
  const archiveHome = pathname === "/" || pathname === "/archive";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 overflow-hidden px-2 group-data-[collapsible=icon]:justify-center">
          <Package className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-heading font-medium group-data-[collapsible=icon]:hidden">
            NMS Archive
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Arquivo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={archiveHome}
                  render={<Link href="/" />}
                >
                  <LayoutGrid />
                  <span>Todas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {CATEGORIES.map((category) => {
                const meta = CATEGORY_META[category];
                const Icon = CATEGORY_ICONS[category];
                const href = archiveHref(category);
                return (
                  <SidebarMenuItem key={`archive-${category}`}>
                    <SidebarMenuButton
                      isActive={active(href)}
                      render={<Link href={href} />}
                    >
                      <Icon />
                      <span>{meta.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Save aberto</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={active("/save")}
                  render={<Link href="/save" />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {saveReady
                ? CATEGORIES.map((category) => {
                    const meta = CATEGORY_META[category];
                    const Icon = CATEGORY_ICONS[category];
                    return (
                      <SidebarMenuItem key={`save-${category}`}>
                        <SidebarMenuButton
                          isActive={active(meta.href)}
                          render={<Link href={meta.href} />}
                        >
                          <Icon />
                          <span>{meta.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>App</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={active("/settings")}
                  render={<Link href="/settings" />}
                >
                  <Settings />
                  <span>Configurações</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <p className="px-2 pb-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          Fase 4 · o save é a ponte
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

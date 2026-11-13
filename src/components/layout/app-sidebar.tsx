"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dog,
  LayoutDashboard,
  Landmark,
  LayoutGrid,
  Orbit,
  Package,
  Rocket,
  Satellite,
  Settings,
  Shirt,
  Sparkles,
  Swords,
  Telescope,
  Truck,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useCategoryCopy } from "@/i18n/format";
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
import {
  archiveHref,
  SIDEBAR_CATEGORIES,
  saveHref,
  type Category,
} from "@/types/nms";
import { useSaveSession } from "@/stores/save-session";

const CATEGORY_ICONS: Record<Category, ComponentType<{ className?: string }>> = {
  ship: Rocket,
  multitool: Swords,
  freighter: Truck,
  frigate: Telescope,
  squadron: Users,
  companion: Dog,
  wonder: Sparkles,
  exosuit: Shirt,
  base: Landmark,
  deepspace: Orbit,
  spacestation: Satellite,
};

export function AppSidebar() {
  const nav = useTranslations("nav");
  const common = useTranslations("common");
  const categories = useCategoryCopy();
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
          <SidebarGroupLabel>{nav("archiveGroup")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={archiveHome}
                  render={<Link href="/" />}
                >
                  <LayoutGrid />
                  <span>{common("all")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {SIDEBAR_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category];
                const href = archiveHref(category);
                return (
                  <SidebarMenuItem key={`archive-${category}`}>
                    <SidebarMenuButton
                      isActive={active(href)}
                      render={<Link href={href} />}
                    >
                      <Icon />
                      <span>{categories.label(category)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>{nav("openSaveGroup")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={active("/save")}
                  render={<Link href="/save" />}
                >
                  <LayoutDashboard />
                  <span>{nav("dashboard")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {saveReady
                ? SIDEBAR_CATEGORIES.map((category) => {
                    const Icon = CATEGORY_ICONS[category];
                    const href = saveHref(category);
                    return (
                      <SidebarMenuItem key={`save-${category}`}>
                        <SidebarMenuButton
                          isActive={active(href)}
                          render={<Link href={href} />}
                        >
                          <Icon />
                          <span>{categories.label(category)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={active("/settings")}
              render={<Link href="/settings" />}
            >
              <Settings />
              <span>{nav("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <ThemeToggle />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

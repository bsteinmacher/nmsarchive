"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Dog,
  LayoutDashboard,
  Landmark,
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
import { CATEGORIES, CATEGORY_META, type Category } from "@/types/nms";

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = (href: string) => mounted && pathname === href;

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
          <SidebarGroupLabel>Arquivo pessoal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={active("/archive")}
                  render={<Link href="/archive" />}
                >
                  <Archive />
                  <span>Descobertas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
                  isActive={active("/")}
                  render={<Link href="/" />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {CATEGORIES.map((category) => {
                const meta = CATEGORY_META[category];
                const Icon = CATEGORY_ICONS[category];
                return (
                  <SidebarMenuItem key={category}>
                    <SidebarMenuButton
                      isActive={active(meta.href)}
                      render={<Link href={meta.href} />}
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
          Fase 1b · o save é a ponte
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Dog,
  Home,
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              isActive={active("/")}
              render={<Link href="/" />}
            >
              <Home />
              <span className="font-heading font-medium">NMS Archive</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
          Fase 1 · o arquivo é o produto; o save é a ponte
        </p>
        <Package className="mx-auto mb-2 hidden size-4 text-muted-foreground group-data-[collapsible=icon]:block" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

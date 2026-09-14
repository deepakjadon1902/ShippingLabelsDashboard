import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  CalendarCheck,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  PlusCircle,
  Printer,
  Settings,
} from "lucide-react";

import { AppLogo } from "@/components/app-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const operationsItems = [
  { title: "Dashboard", tab: "overview", icon: LayoutDashboard },
  { title: "Shipments & Tracking", tab: "shipments", icon: Truck },
  { title: "Today's Deliveries", tab: "today", icon: CalendarCheck },
  { title: "Delayed Shipments", tab: "delayed", icon: AlertTriangle },
  { title: "RTO Management", tab: "rto", icon: RotateCcw },
  { title: "Reports & Analytics", tab: "reports", icon: BarChart3 },
];

const labelItems: Array<{
  title: string;
  url: "/create" | "/print" | "/settings";
  icon: typeof PlusCircle;
}> = [
  { title: "Create Label", url: "/create", icon: PlusCircle },
  { title: "Print Labels", url: "/print", icon: Printer },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { pathname, search } = useRouterState({
    select: (r) => ({
      pathname: r.location.pathname,
      search: r.location.search as Record<string, string> | undefined,
    }),
  });

  const activeTab = pathname === "/" ? search?.tab || "overview" : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <AppLogo />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">Delivery Operations</span>
            <span className="text-[11px] text-muted-foreground">Shipment & Label Hub</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Delivery Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => {
                const active = activeTab === item.tab;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to="/" search={{ tab: item.tab }} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Label Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {labelItems.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

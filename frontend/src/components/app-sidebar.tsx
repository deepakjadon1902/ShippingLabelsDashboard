import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  Sun,
  Moon,
  Laptop,
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  listLabels,
  isLabelDelayed,
  isLabelRtoReturned,
  getLocalDateKey,
} from "@/lib/labels";
import { useTheme } from "@/lib/theme";

const operationsItems: Array<{
  title: string;
  tab: "overview" | "shipments" | "today" | "delayed" | "rto" | "reports";
  icon: typeof LayoutDashboard;
  countKey?: "total" | "today" | "delayed" | "rto";
  badgeVariant?: "default" | "amber" | "rose";
}> = [
  { title: "Dashboard", tab: "overview", icon: LayoutDashboard },
  { title: "Shipments & Tracking", tab: "shipments", icon: Truck, countKey: "total" },
  { title: "Today's Deliveries", tab: "today", icon: CalendarCheck, countKey: "today" },
  { title: "Delayed Shipments", tab: "delayed", icon: AlertTriangle, countKey: "delayed", badgeVariant: "amber" },
  { title: "RTO Management", tab: "rto", icon: RotateCcw, countKey: "rto", badgeVariant: "rose" },
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

  const { theme, toggleTheme } = useTheme();

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: listLabels,
    staleTime: 60000,
  });

  const counts = useMemo(() => {
    const todayStr = getLocalDateKey(new Date());
    let today = 0;
    let delayed = 0;
    let rto = 0;

    for (const l of labels) {
      if (isLabelDelayed(l)) delayed++;
      if (l.status === "RTO" || isLabelRtoReturned(l)) rto++;

      const isCreatedToday = l.created_at && getLocalDateKey(l.created_at) === todayStr;
      const isDeliveredToday = l.delivered_at && getLocalDateKey(l.delivered_at) === todayStr;
      if (isCreatedToday || isDeliveredToday) today++;
    }

    return {
      total: labels.length,
      today,
      delayed,
      rto,
    };
  }, [labels]);

  const activeTab = pathname === "/" ? search?.tab || "overview" : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2.5 py-3.5">
          <AppLogo className="h-7 w-7 shrink-0 text-primary" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-foreground leading-tight">
              BrajMart Logistics
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">Operations Platform</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Delivery Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => {
                const active = activeTab === item.tab;
                const count = item.countKey ? counts[item.countKey] : undefined;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        to="/"
                        search={{ tab: item.tab }}
                        className="flex items-center justify-between gap-2 w-full text-xs font-medium"
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                          <span>{item.title}</span>
                        </div>
                        {count !== undefined && count > 0 && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full font-tabular group-data-[collapsible=icon]:hidden ${
                              item.badgeVariant === "amber"
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                : item.badgeVariant === "rose"
                                  ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Label Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {labelItems.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2.5 text-xs font-medium">
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
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

      <SidebarFooter className="border-t border-border/50 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={`Switch theme (current: ${theme})`}
              className="text-xs text-muted-foreground hover:text-foreground justify-between"
            >
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 text-primary" />
                ) : theme === "light" ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : (
                  <Laptop className="h-4 w-4" />
                )}
                <span className="capitalize group-data-[collapsible=icon]:hidden">
                  Theme: {theme}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

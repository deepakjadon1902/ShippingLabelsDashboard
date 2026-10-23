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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border/80">
        <div className="flex items-center gap-2.5 px-3 py-3.5">
          <div className="h-8 w-8 rounded-lg bg-orange-600/90 text-white flex items-center justify-center font-black shadow-xs shrink-0 text-sm">
            BM
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-white leading-tight">
              BrajMart Logistics
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              Control Tower
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3">
            Operations Telemetry
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => {
                const active = activeTab === item.tab;
                const count = item.countKey ? counts[item.countKey] : undefined;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={`text-xs transition-colors ${
                        active
                          ? "bg-white/10 text-white font-semibold border-l-2 border-orange-500"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Link
                        to="/"
                        search={{ tab: item.tab }}
                        className="flex items-center justify-between gap-2 w-full text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-orange-400" : "text-slate-400"}`} />
                          <span>{item.title}</span>
                        </div>
                        {count !== undefined && count > 0 && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full font-tabular group-data-[collapsible=icon]:hidden ${
                              item.badgeVariant === "amber"
                                ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                                : item.badgeVariant === "rose"
                                  ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                                  : "bg-white/10 text-slate-300 border border-white/10"
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
          <SidebarGroupLabel className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3">
            Consignment Hub
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {labelItems.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={`text-xs transition-colors ${
                        active
                          ? "bg-white/10 text-white font-semibold border-l-2 border-orange-500"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Link to={item.url} className="flex items-center gap-2.5 text-xs">
                        <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-orange-400" : "text-slate-400"}`} />
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

      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={`Switch theme (current: ${theme})`}
              className="text-xs text-slate-300 hover:text-white hover:bg-white/5 justify-between"
            >
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 text-orange-400" />
                ) : theme === "light" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Laptop className="h-4 w-4 text-slate-400" />
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

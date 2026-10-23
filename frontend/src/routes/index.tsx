import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  Search,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  CalendarCheck,
  BarChart3,
  Timer,
  Clock,
  Printer,
  CalendarDays,
  Filter,
  CheckCheck,
  ShieldCheck,
  Activity,
  ArrowRight,
  Radio,
  Layers,
  MapPin,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { ShipmentTable } from "@/components/dashboard/shipment-table";
import { ShipmentJourneyDialog } from "@/components/dashboard/shipment-journey-dialog";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { DailyReportTable } from "@/components/dashboard/daily-report-table";

import {
  listLabels,
  deleteLabel,
  updateLabel,
  refreshLabelTracking,
  refreshAllTracking,
  STATUSES,
  isLabelOutOfDelivery,
  isLabelDelayed,
  isLabelRtoReturned,
  getOperationalStage,
  formatDuration,
  formatCompactDuration,
  getLocalDateKey,
  type Label,
  type LabelStatus,
  type OperationalStage,
} from "@/lib/labels";

export type DashboardTab = "overview" | "shipments" | "today" | "delayed" | "rto" | "reports";
export type DateRange = "all" | "today" | "yesterday" | "last7" | "last30" | "custom";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): {
    tab?: DashboardTab;
    range?: DateRange;
    start?: string;
    end?: string;
  } => {
    return {
      tab: (search.tab as DashboardTab) || "overview",
      range: (search.range as DateRange) || "all",
      start: (search.start as string) || undefined,
      end: (search.end as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Delivery Operations Dashboard — ShippingLabelsDashboard" },
      {
        name: "description",
        content: "Enterprise shipping label creation, turnaround time analytics, and multi-courier tracking hub.",
      },
      { property: "og:title", content: "Delivery Operations Dashboard" },
      { property: "og:description", content: "Real-time courier performance, shipment tracking, and logistics analytics." },
    ],
  }),
  component: Dashboard,
});

function isDateInRange(
  dateStr: string | null | undefined,
  range: DateRange,
  customStart?: string,
  customEnd?: string,
): boolean {
  if (range === "all") return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000 - 1;

  if (range === "today") {
    return d.getTime() >= todayStart && d.getTime() <= todayEnd;
  }
  if (range === "yesterday") {
    const yStart = todayStart - 86400000;
    const yEnd = todayStart - 1;
    return d.getTime() >= yStart && d.getTime() <= yEnd;
  }
  if (range === "last7") {
    return d.getTime() >= todayStart - 6 * 86400000;
  }
  if (range === "last30") {
    return d.getTime() >= todayStart - 29 * 86400000;
  }
  if (range === "custom" && customStart && customEnd) {
    const s = new Date(customStart).getTime();
    const e = new Date(customEnd).getTime() + 86400000 - 1;
    return d.getTime() >= s && d.getTime() <= e;
  }
  return true;
}

function Dashboard() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const qc = useQueryClient();

  const activeTab: DashboardTab = searchParams.tab || "overview";
  const dateRange: DateRange = searchParams.range || "all";
  const customStart = searchParams.start;
  const customEnd = searchParams.end;

  const [search, setSearch] = useState("");
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [journeyLabelId, setJourneyLabelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmBulkSync, setConfirmBulkSync] = useState(false);
  const [confirmRefreshLabel, setConfirmRefreshLabel] = useState<Label | null>(null);

  const { data: labels = [], isLoading, isFetching } = useQuery({
    queryKey: ["labels"],
    queryFn: listLabels,
  });

  const activeJourneyLabel = useMemo(
    () => (journeyLabelId ? labels.find((l) => l.id === journeyLabelId) || null : null),
    [journeyLabelId, labels],
  );

  const couriers = useMemo(
    () => Array.from(new Set(labels.map((l) => l.courier_name).filter(Boolean))),
    [labels],
  );

  const setTab = (tab: DashboardTab) => {
    navigate({ search: (prev) => ({ ...prev, tab }) });
  };

  const setRange = (range: DateRange) => {
    navigate({ search: (prev) => ({ ...prev, range }) });
  };

  // 1. Core KPIs
  const kpis = useMemo(() => {
    const todayStr = getLocalDateKey(new Date());

    let total = 0;
    let delivered = 0;
    let shipped = 0;
    let pending = 0;
    let rto = 0;
    let rtoInitiated = 0;
    let rtoReturned = 0;
    let outForDelivery = 0;
    let failedAttempts = 0;
    let delayed = 0;

    let createdToday = 0;
    let deliveredToday = 0;
    let ofdToday = 0;

    const allTatMs: number[] = [];

    for (const l of labels) {
      const isCreatedToday = l.created_at && getLocalDateKey(l.created_at) === todayStr;
      const isDeliveredToday = l.delivered_at && getLocalDateKey(l.delivered_at) === todayStr;

      if (isCreatedToday) createdToday++;
      if (isDeliveredToday) deliveredToday++;
      if (isLabelOutOfDelivery(l) && (isCreatedToday || isDeliveredToday)) ofdToday++;

      const inRange = isDateInRange(l.created_at, dateRange, customStart, customEnd);
      if (!inRange) continue;

      total++;
      const stage = getOperationalStage(l);

      if (l.status === "Delivered") {
        delivered++;
        const pickupMs = l.pickup_at ? new Date(l.pickup_at).getTime() : null;
        const createdMs = l.created_at ? new Date(l.created_at).getTime() : null;
        const deliveredMs = l.delivered_at ? new Date(l.delivered_at).getTime() : null;
        const start = pickupMs || createdMs;
        if (start && deliveredMs && deliveredMs >= start) {
          allTatMs.push(deliveredMs - start);
        }
      } else if (l.status === "RTO" || isLabelRtoReturned(l)) {
        rto++;
        if (isLabelRtoReturned(l)) rtoReturned++;
        else rtoInitiated++;
      } else if (stage === "Out for Delivery") {
        outForDelivery++;
        shipped++;
      } else if (stage === "Delivery Attempted" || stage === "Failed / NDR") {
        failedAttempts++;
        shipped++;
      } else if (l.status === "Shipped" || stage === "In Transit") {
        shipped++;
      } else {
        pending++;
      }

      if (isLabelDelayed(l)) delayed++;
    }

    const avgTatMs = allTatMs.length > 0 ? Math.round(allTatMs.reduce((a, b) => a + b, 0) / allTatMs.length) : null;
    const completionRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

    return {
      total,
      delivered,
      shipped,
      pending,
      rto,
      rtoInitiated,
      rtoReturned,
      outForDelivery,
      failedAttempts,
      delayed,
      createdToday,
      deliveredToday,
      ofdToday,
      completionRate,
      avgTatDisplay: formatCompactDuration(avgTatMs) || "—",
      sampleSize: allTatMs.length,
    };
  }, [labels, dateRange, customStart, customEnd]);

  // 2. Filtered Shipments for Main Table
  const filteredShipments = useMemo(() => {
    const s = search.trim().toLowerCase();
    return labels.filter((l) => {
      if (s) {
        const stage = getOperationalStage(l);
        const matchesSearch =
          l.tracking_id.toLowerCase().includes(s) ||
          l.receiver_name.toLowerCase().includes(s) ||
          l.receiver_mobile_1.toLowerCase().includes(s) ||
          (l.receiver_mobile_2 && l.receiver_mobile_2.toLowerCase().includes(s)) ||
          l.receiver_city.toLowerCase().includes(s) ||
          l.receiver_state.toLowerCase().includes(s) ||
          l.receiver_pincode.toLowerCase().includes(s) ||
          l.courier_name.toLowerCase().includes(s) ||
          stage.toLowerCase().includes(s) ||
          (l.order_reference && l.order_reference.toLowerCase().includes(s));
        if (!matchesSearch) return false;
      }

      if (courierFilter !== "all" && l.courier_name !== courierFilter) {
        return false;
      }

      if (statusFilter !== "all") {
        const stage = getOperationalStage(l);
        if (statusFilter === "OFD" && stage !== "Out for Delivery") return false;
        if (statusFilter === "Attempted" && stage !== "Delivery Attempted") return false;
        if (statusFilter === "Failed" && stage !== "Failed / NDR") return false;
        if (statusFilter === "RTO_Initiated" && stage !== "RTO Initiated") return false;
        if (statusFilter === "RTO_Returned" && stage !== "RTO Returned") return false;
        if (statusFilter === "RTO" && l.status !== "RTO" && !stage.startsWith("RTO")) return false;
        if (statusFilter === "Delayed" && !isLabelDelayed(l)) return false;
        if (
          ["Pending", "Shipped", "Delivered"].includes(statusFilter) &&
          l.status !== statusFilter &&
          stage !== statusFilter
        ) {
          return false;
        }
      }

      return isDateInRange(l.created_at, dateRange, customStart, customEnd);
    });
  }, [labels, search, courierFilter, statusFilter, dateRange, customStart, customEnd]);

  // 3. Tab Specific Lists
  const todayLabels = useMemo(() => {
    const todayStr = getLocalDateKey(new Date());
    return labels.filter((l) => {
      const isCreatedToday = l.created_at && getLocalDateKey(l.created_at) === todayStr;
      const isDeliveredToday = l.delivered_at && getLocalDateKey(l.delivered_at) === todayStr;
      const isOfdToday = isLabelOutOfDelivery(l);
      return isCreatedToday || isDeliveredToday || isOfdToday;
    });
  }, [labels]);

  const delayedLabels = useMemo(() => labels.filter(isLabelDelayed), [labels]);
  const rtoLabels = useMemo(() => labels.filter((l) => l.status === "RTO" || isLabelRtoReturned(l)), [labels]);

  // 4. Mutations
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LabelStatus }) => updateLabel(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Shipment status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLabel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Shipping label deleted");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshOneMutation = useMutation({
    mutationFn: (id: string) => refreshLabelTracking(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      setConfirmRefreshLabel(null);
      if (data.skipped) {
        toast.info(data.reason || "Courier tracking was skipped");
      } else if (data.error) {
        toast.warning(data.error);
      } else {
        toast.success(`Tracking synced (${data.updatedStatus || "Updated"})`);
      }
    },
    onError: (e: Error) => {
      setConfirmRefreshLabel(null);
      toast.error(e.message);
    },
  });

  const refreshAllMutation = useMutation({
    mutationFn: refreshAllTracking,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      setConfirmBulkSync(false);
      toast.success(`Bulk sync complete: ${data.updated} updated, ${data.failed} failed of ${data.total} total.`);
    },
    onError: (e: Error) => {
      setConfirmBulkSync(false);
      toast.error(e.message);
    },
  });

  const isFiltered = search.length > 0 || courierFilter !== "all" || statusFilter !== "all" || dateRange !== "all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Compact Control Tower Page Header & Consolidated Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Logistics Control Tower
            </h1>
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-muted/60 text-muted-foreground border-border/80">
              Live Operations
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap font-medium">
            <span>{labels.length} active consignments</span>
            <span>•</span>
            <span>Filter window: <strong className="text-foreground uppercase">{dateRange}</strong></span>
            {refreshAllMutation.isPending && (
              <span className="inline-flex items-center gap-1 text-primary animate-pulse font-semibold">
                <RefreshCw className="h-3 w-3 animate-spin" /> Live syncing eligible carriers...
              </span>
            )}
          </p>
        </div>

        {/* Consolidated Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <Select value={dateRange} onValueChange={(val) => setRange(val as DateRange)}>
            <SelectTrigger className="w-[130px] text-xs h-9 bg-card border-border/80 shadow-xs font-medium">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="all">All-Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last7">Last 7 Days</SelectItem>
              <SelectItem value="last30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          {/* Manual Courier Sync */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmBulkSync(true)}
            className="text-xs h-9 gap-1.5 bg-card border-border/80 shadow-xs hover:bg-muted"
            disabled={refreshAllMutation.isPending}
            title="Query real-time tracking for in-transit parcels respecting quota budgets"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshAllMutation.isPending ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span className="hidden sm:inline">Sync Eligible</span>
          </Button>

          {/* Print Labels Button */}
          <Button asChild variant="outline" size="sm" className="text-xs h-9 gap-1.5 bg-card border-border/80 shadow-xs hover:bg-muted">
            <Link to="/print">
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Print Grid</span>
            </Link>
          </Button>

          {/* Primary Create Label Button with Restrained Orange */}
          <Button asChild size="sm" className="text-xs h-9 gap-1.5 font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs">
            <Link to="/create">
              <PlusCircle className="h-3.5 w-3.5" />
              New Consignment
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Simplified Secondary View Switcher (Clean, Single Strip) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/60">
        <Button
          variant={activeTab === "overview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("overview")}
          className={`h-8 px-3 text-xs font-semibold ${activeTab === "overview" ? "bg-card shadow-xs text-foreground border border-border/70" : "text-muted-foreground"}`}
        >
          Overview & Telemetry
        </Button>
        <Button
          variant={activeTab === "shipments" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("shipments")}
          className={`h-8 px-3 text-xs font-semibold gap-1.5 ${activeTab === "shipments" ? "bg-card shadow-xs text-foreground border border-border/70" : "text-muted-foreground"}`}
        >
          Shipments Table
          <span className="text-[10px] font-bold font-tabular px-1.5 py-0.2 rounded-full bg-muted">
            {labels.length}
          </span>
        </Button>
        <Button
          variant={activeTab === "today" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("today")}
          className={`h-8 px-3 text-xs font-semibold gap-1.5 ${activeTab === "today" ? "bg-card shadow-xs text-foreground border border-border/70" : "text-muted-foreground"}`}
        >
          Today's Activity
          {kpis.createdToday + kpis.deliveredToday > 0 && (
            <span className="text-[10px] font-bold font-tabular px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {kpis.createdToday + kpis.deliveredToday}
            </span>
          )}
        </Button>
        {kpis.delayed > 0 && (
          <Button
            variant={activeTab === "delayed" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("delayed")}
            className={`h-8 px-2.5 text-xs font-semibold gap-1.5 ${
              activeTab === "delayed"
                ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-300"
                : "text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Delayed SLA ({kpis.delayed})
          </Button>
        )}
        {kpis.rto > 0 && (
          <Button
            variant={activeTab === "rto" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab("rto")}
            className={`h-8 px-2.5 text-xs font-semibold gap-1.5 ${
              activeTab === "rto"
                ? "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-300"
                : "text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
            RTO Exceptions ({kpis.rto})
          </Button>
        )}
        <Button
          variant={activeTab === "reports" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("reports")}
          className={`h-8 px-3 text-xs font-semibold ${activeTab === "reports" ? "bg-card shadow-xs text-foreground border border-border/70" : "text-muted-foreground"}`}
        >
          Daily Audit & Reports
        </Button>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setTab(val as DashboardTab)} className="space-y-6">
        {/* -------------------- TAB 1: OVERVIEW -------------------- */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards Grid — 5 Compact, Balanced Columns with Semantic Border Accents */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <KpiCard
              title="Total Consignments"
              value={kpis.total}
              sub={`${kpis.createdToday} dispatched today`}
              icon={Package}
              badge={dateRange !== "all" ? dateRange : "All-time"}
              badgeVariant="slate"
              accentColor="slate"
              onClick={() => setTab("shipments")}
            />
            <KpiCard
              title="Delivered Successfully"
              value={kpis.delivered}
              sub={`${kpis.completionRate}% completion rate`}
              icon={CheckCircle2}
              badge={kpis.deliveredToday > 0 ? `+${kpis.deliveredToday} today` : `${kpis.completionRate}% rate`}
              badgeVariant="emerald"
              accentColor="emerald"
              iconColor="text-emerald-600 dark:text-emerald-400"
              iconBg="bg-emerald-500/10"
              onClick={() => {
                setStatusFilter("Delivered");
                setTab("shipments");
              }}
            />
            <KpiCard
              title="In Active Transit"
              value={kpis.shipped}
              sub={`${kpis.outForDelivery} final mile (OFD)`}
              icon={Truck}
              badge={kpis.outForDelivery > 0 ? `${kpis.outForDelivery} OFD` : "Moving"}
              badgeVariant="blue"
              accentColor="blue"
              iconColor="text-sky-600 dark:text-sky-400"
              iconBg="bg-sky-500/10"
              onClick={() => {
                setStatusFilter("Shipped");
                setTab("shipments");
              }}
            />
            <KpiCard
              title="Delayed Past SLA"
              value={kpis.delayed}
              sub="Carrier SLA missed"
              icon={AlertTriangle}
              badge={kpis.delayed > 0 ? "Action Required" : "On Schedule"}
              badgeVariant={kpis.delayed > 0 ? "amber" : "emerald"}
              accentColor="amber"
              iconColor={kpis.delayed > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}
              iconBg={kpis.delayed > 0 ? "bg-amber-500/10" : "bg-muted"}
              onClick={() => setTab("delayed")}
            />
            <KpiCard
              title="Average Turnaround"
              value={kpis.avgTatDisplay}
              sub="Dispatch to Delivery"
              icon={Timer}
              badge={`${kpis.sampleSize} parcels`}
              badgeVariant="orange"
              accentColor="orange"
              iconColor="text-orange-600 dark:text-orange-400"
              iconBg="bg-orange-500/10"
            />
          </div>

          {/* Operational Pulse Secondary Metric Strip */}
          <div className="flex items-center gap-2 overflow-x-auto p-2.5 rounded-lg bg-card border border-border/80 shadow-2xs text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-1.5 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Operational Pulse:
            </span>
            <div className="flex items-center gap-4 text-xs shrink-0">
              <span className="text-muted-foreground">
                Today Dispatched: <strong className="text-foreground font-tabular">{kpis.createdToday}</strong>
              </span>
              <span className="text-muted-foreground">
                Today Delivered: <strong className="text-emerald-700 dark:text-emerald-400 font-tabular">{kpis.deliveredToday}</strong>
              </span>
              <span className="text-muted-foreground">
                Final Mile (OFD): <strong className="text-indigo-600 dark:text-indigo-400 font-tabular">{kpis.outForDelivery}</strong>
              </span>
              <span className="text-muted-foreground">
                Attempted / NDR: <strong className="text-amber-600 dark:text-amber-400 font-tabular">{kpis.failedAttempts}</strong>
              </span>
              <span className="text-muted-foreground">
                RTO Returned: <strong className="text-rose-600 dark:text-rose-400 font-tabular">{kpis.rtoReturned}</strong>
              </span>
            </div>
          </div>

          {/* Actionable Exception Prioritization Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Panel 1: Delayed SLA Breaches */}
            <Card className="border-border/80 shadow-xs bg-card border-l-4 border-l-amber-500 flex flex-col justify-between">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">Delayed Shipments</CardTitle>
                      <CardDescription className="text-[11px]">SLA breaches requiring carrier escalation</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs font-bold font-tabular ${delayedLabels.length > 0 ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-300" : "bg-muted"}`}>
                    {delayedLabels.length} Breached
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-1">
                {delayedLabels.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 py-3 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    All active consignments are moving within SLA delivery windows.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {delayedLabels.slice(0, 3).map((l) => (
                      <div key={l.id} className="p-2 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-foreground truncate">{l.tracking_id}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{l.courier_name} • {l.receiver_city}, {l.receiver_state}</div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded font-tabular">
                            +{l.delayed_days || 1}d SLA
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="p-3 pt-0 border-t border-border/40 mt-auto">
                <Button variant="ghost" size="sm" onClick={() => setTab("delayed")} className="w-full text-xs h-7 text-amber-800 dark:text-amber-300 hover:text-amber-900 justify-between font-semibold">
                  <span>View all {delayedLabels.length} delayed shipments</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>

            {/* Panel 2: Tracking Telemetry & Error Gateway */}
            <Card className="border-border/80 shadow-xs bg-card border-l-4 border-l-sky-500 flex flex-col justify-between">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <Radio className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">Tracking Telemetry</CardTitle>
                      <CardDescription className="text-[11px]">Carrier gateway status & quotas</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Direct Carrier Integrations</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Delhivery, Ekart, Maruti, Shadowfax
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">TrackCourier Cascade</span>
                  <span className="font-semibold text-foreground">3 Accounts Armed (Failover Ready)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">DTDC Upstream API</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                    Direct 401 ➔ Failover to Acc 2/3
                  </span>
                </div>
              </CardContent>
              <div className="p-3 pt-0 border-t border-border/40 mt-auto">
                <Button variant="ghost" size="sm" onClick={() => setConfirmBulkSync(true)} className="w-full text-xs h-7 text-sky-800 dark:text-sky-300 hover:text-sky-900 justify-between font-semibold">
                  <span>Sync eligible in-transit tracking</span>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </Card>

            {/* Panel 3: RTO & Return Actions */}
            <Card className="border-border/80 shadow-xs bg-card border-l-4 border-l-rose-500 flex flex-col justify-between">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      <RotateCcw className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">RTO Exception Hub</CardTitle>
                      <CardDescription className="text-[11px]">Returns in transit and warehouse restocks</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs font-bold font-tabular ${rtoLabels.length > 0 ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950 dark:text-rose-300" : "bg-muted"}`}>
                    {rtoLabels.length} In Return
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-1">
                {rtoLabels.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Zero undelivered or return-initiated consignments.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rtoLabels.slice(0, 3).map((l) => (
                      <div key={l.id} className="p-2 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-foreground truncate">{l.tracking_id}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{l.courier_name} • {l.receiver_city}</div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded">
                            {l.rto_status === "RTO Delivered / Returned" ? "Restocked" : "In Return"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="p-3 pt-0 border-t border-border/40 mt-auto">
                <Button variant="ghost" size="sm" onClick={() => setTab("rto")} className="w-full text-xs h-7 text-rose-800 dark:text-rose-300 hover:text-rose-900 justify-between font-semibold">
                  <span>View full RTO management pipeline</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Analytics Summary */}
          <AnalyticsCharts labels={labels} />

          {/* Recent Shipments Table Card */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Active Consignment Operations
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Recently created parcels with live courier tracking status.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="text-xs h-8">
                  <Link to="/" search={{ tab: "shipments" }}>
                    View all {labels.length} shipments
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ShipmentTable
                labels={filteredShipments}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => {
                  const target = labels.find((l) => l.id === id);
                  if (target) setConfirmRefreshLabel(target);
                  else refreshOneMutation.mutate(id);
                }}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null}
                onClearFilters={() => {
                  setSearch("");
                  setCourierFilter("all");
                  setStatusFilter("all");
                  setRange("all");
                }}
                isFiltered={isFiltered}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB 2: SHIPMENTS & TRACKING -------------------- */}
        <TabsContent value="shipments" className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[260px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 text-xs h-9 bg-card"
                    placeholder="Search AWB, customer, phone, city, order ref..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Filter Dropdowns */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={courierFilter} onValueChange={setCourierFilter}>
                    <SelectTrigger className="w-[160px] text-xs h-9 bg-card">
                      <SelectValue placeholder="All Couriers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Couriers</SelectItem>
                      {couriers.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[170px] text-xs h-9 bg-card">
                      <SelectValue placeholder="All Operational Stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Operational Stages</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Shipped">In Transit</SelectItem>
                      <SelectItem value="OFD">Out for Delivery</SelectItem>
                      <SelectItem value="Attempted">Delivery Attempted</SelectItem>
                      <SelectItem value="Failed">Failed / NDR</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="RTO">RTO (All)</SelectItem>
                      <SelectItem value="RTO_Initiated">RTO Initiated</SelectItem>
                      <SelectItem value="RTO_Returned">RTO Returned</SelectItem>
                      <SelectItem value="Delayed">Delayed Past SLA</SelectItem>
                    </SelectContent>
                  </Select>

                  {isFiltered && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => {
                        setSearch("");
                        setCourierFilter("all");
                        setStatusFilter("all");
                        setRange("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ShipmentTable
                labels={filteredShipments}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => {
                  const target = labels.find((l) => l.id === id);
                  if (target) setConfirmRefreshLabel(target);
                  else refreshOneMutation.mutate(id);
                }}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null}
                onClearFilters={() => {
                  setSearch("");
                  setCourierFilter("all");
                  setStatusFilter("all");
                  setRange("all");
                }}
                isFiltered={isFiltered}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB 3: TODAY'S DELIVERIES -------------------- */}
        <TabsContent value="today" className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <CalendarCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Today's Deliveries & Out for Delivery Actions
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Consignments created today, delivered today, or currently out for delivery.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs px-2.5 py-1 font-semibold">
                  {todayLabels.length} parcels active today
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ShipmentTable
                labels={todayLabels}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB 4: DELAYED -------------------- */}
        <TabsContent value="delayed" className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Delayed Shipments (SLA Exception Watch)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Shipments that have exceeded their target courier SLA delivery window.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs px-2.5 py-1 bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                  {delayedLabels.length} SLA Breaches
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ShipmentTable
                labels={delayedLabels}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB 5: RTO -------------------- */}
        <TabsContent value="rto" className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    Return to Origin (RTO) Consignment Hub
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Parcels in return transit or safely returned to origin warehouse facility.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs px-2.5 py-1 bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300 font-semibold">
                  {rtoLabels.length} RTO Shipments
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ShipmentTable
                labels={rtoLabels}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB 6: REPORTS & ANALYTICS -------------------- */}
        <TabsContent value="reports" className="space-y-6">
          <DailyReportTable labels={labels} />
          <AnalyticsCharts labels={labels} />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <ShipmentJourneyDialog
        label={activeJourneyLabel}
        open={Boolean(journeyLabelId)}
        onOpenChange={(open) => {
          if (!open) setJourneyLabelId(null);
        }}
        onRefresh={(id) => refreshOneMutation.mutate(id)}
        refreshing={refreshOneMutation.isPending}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shipping Label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this consignment record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Sync Confirmation Alert Dialog */}
      <AlertDialog open={confirmBulkSync} onOpenChange={setConfirmBulkSync}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Confirm Bulk Tracking Sync
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will query courier APIs for all pending and in-transit parcels that are eligible for updates according to per-courier rate limits and quota budgets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => refreshAllMutation.mutate()}>
              Proceed with Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Refresh Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(confirmRefreshLabel)} onOpenChange={(open) => !open && setConfirmRefreshLabel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Refresh Real-Time Courier Tracking
            </AlertDialogTitle>
            <AlertDialogDescription>
              Request live tracking status for AWB{" "}
              <strong className="text-foreground font-mono">{confirmRefreshLabel?.tracking_id}</strong> via{" "}
              <strong>{confirmRefreshLabel?.courier_name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRefreshLabel) refreshOneMutation.mutate(confirmRefreshLabel.id);
              }}
            >
              Refresh Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

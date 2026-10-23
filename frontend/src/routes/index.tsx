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
    const [sY, sM, sD] = customStart.split("-").map(Number);
    const [eY, eM, eD] = customEnd.split("-").map(Number);
    if (sY && sM && sD && eY && eM && eD) {
      const s = new Date(sY, sM - 1, sD, 0, 0, 0, 0).getTime();
      const e = new Date(eY, eM - 1, eD, 23, 59, 59, 999).getTime();
      return d.getTime() >= s && d.getTime() <= e;
    }
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

  const setCustomStart = (start: string) => {
    navigate({ search: (prev) => ({ ...prev, start }) });
  };

  const setCustomEnd = (end: string) => {
    navigate({ search: (prev) => ({ ...prev, end }) });
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
      const isOfdToday = isLabelOutOfDelivery(l);

      if (isCreatedToday) createdToday++;
      if (isDeliveredToday) deliveredToday++;
      // Live OFD counts all active parcels out for delivery today, including those dispatched earlier
      if (isOfdToday) ofdToday++;

      // When filtering by "Today", include shipments created today, delivered today, or currently out for delivery
      const inRange =
        dateRange === "today"
          ? isCreatedToday || isDeliveredToday || isOfdToday
          : isDateInRange(l.created_at, dateRange, customStart, customEnd);
      if (!inRange) continue;

      total++;
      const stage = getOperationalStage(l);

      if (l.status === "Delivered") {
        delivered++;
        const pickupMs = l.pickup_at ? new Date(l.pickup_at).getTime() : null;
        const deliveredMs = l.delivered_at ? new Date(l.delivered_at).getTime() : null;
        if (pickupMs && deliveredMs && deliveredMs >= pickupMs) {
          allTatMs.push(deliveredMs - pickupMs);
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
      } else if (
        l.status === "Shipped / Picked Up" ||
        l.status === "Shipped" ||
        stage === "In Transit"
      ) {
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
      readyToPick: pending,
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
    const todayStr = getLocalDateKey(new Date());
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
        if (statusFilter === "Ready to Pick" || statusFilter === "Pending") {
          if (
            l.status !== "Ready to Pick" &&
            l.status !== "Pending" &&
            stage !== "Ready to Pick"
          ) {
            return false;
          }
        } else if (statusFilter === "Shipped" || statusFilter === "Shipped / Picked Up") {
          if (
            l.status !== "Shipped" &&
            l.status !== "Shipped / Picked Up" &&
            stage !== "In Transit"
          ) {
            return false;
          }
        } else if (
          ["Delivered"].includes(statusFilter) &&
          l.status !== statusFilter &&
          stage !== statusFilter
        ) {
          return false;
        }
      }

      if (dateRange === "today") {
        const isCreatedToday = l.created_at && getLocalDateKey(l.created_at) === todayStr;
        const isDeliveredToday = l.delivered_at && getLocalDateKey(l.delivered_at) === todayStr;
        const isOfdToday = isLabelOutOfDelivery(l);
        if (!(isCreatedToday || isDeliveredToday || isOfdToday)) return false;
      } else if (!isDateInRange(l.created_at, dateRange, customStart, customEnd)) {
        return false;
      }
      return true;
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
      {/* Header & Date Range / Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Delivery Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-courier tracking, route progression, delay detection, and delivery metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range filter selector */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
            {(
              [
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "7 Days", value: "last7" },
                { label: "30 Days", value: "last30" },
                { label: "All Time", value: "all" },
                { label: "Custom", value: "custom" },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={dateRange === opt.value ? "secondary" : "ghost"}
                className={`h-7 px-2.5 text-xs font-medium ${
                  dateRange === opt.value ? "bg-background shadow-xs font-semibold" : ""
                }`}
                onClick={() => setRange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {dateRange === "custom" && (
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border text-xs">
              <span className="text-muted-foreground text-[11px] pl-1">From:</span>
              <Input
                type="date"
                value={customStart || ""}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[125px] h-7 text-xs px-2 py-0 bg-background"
              />
              <span className="text-muted-foreground text-[11px]">To:</span>
              <Input
                type="date"
                value={customEnd || ""}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[125px] h-7 text-xs px-2 py-0 bg-background"
              />
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmBulkSync(true)}
            disabled={refreshAllMutation.isPending}
            title="Synchronize real-time tracking for all active parcels"
            className="h-8 text-xs font-medium"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${refreshAllMutation.isPending ? "animate-spin text-primary" : ""}`}
            />
            Sync All Couriers
          </Button>

          <Button asChild size="sm" variant="outline" className="h-8 text-xs font-medium">
            <Link to="/print">
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print Labels
            </Link>
          </Button>

          <Button asChild size="sm" className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/create">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
              Create Label
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid — 12 Proportional Cards (2 Rows of 6), Fixed Height, No Truncation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <KpiCard
          label="Total Shipments"
          value={kpis.total}
          icon={<Package className="h-4 w-4 text-primary" />}
          active={activeTab === "shipments" && statusFilter === "all"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("all");
          }}
          badgeText="Total"
        />

        <KpiCard
          label="Today's Shipments"
          value={kpis.createdToday}
          icon={<CalendarDays className="h-4 w-4 text-sky-600" />}
          accentColor="text-sky-700 bg-sky-50 border-sky-200"
          active={activeTab === "today"}
          onClick={() => setTab("today")}
          badgeText="Created"
        />

        <KpiCard
          label="Delivered Today"
          value={kpis.deliveredToday}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          accentColor="text-emerald-700 bg-emerald-50 border-emerald-200"
          active={activeTab === "today"}
          onClick={() => setTab("today")}
          badgeText="Live Today"
        />

        <KpiCard
          label="Delivered (Total)"
          value={kpis.delivered}
          icon={<CheckCheck className="h-4 w-4 text-emerald-600" />}
          active={activeTab === "shipments" && statusFilter === "Delivered"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("Delivered");
          }}
          badgeText={`${kpis.completionRate}%`}
        />

        <KpiCard
          label="In Transit"
          value={kpis.shipped}
          icon={<Truck className="h-4 w-4 text-blue-600" />}
          active={activeTab === "shipments" && statusFilter === "Shipped"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("Shipped");
          }}
        />

        <KpiCard
          label="Out for Delivery"
          value={kpis.outForDelivery}
          icon={<Truck className="h-4 w-4 text-purple-600" />}
          accentColor="text-purple-700 bg-purple-50 border-purple-200"
          active={statusFilter === "OFD"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("OFD");
          }}
          badgeText="OFD"
        />

        <KpiCard
          label="Ready to Pick"
          value={kpis.readyToPick}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          active={
            activeTab === "shipments" &&
            (statusFilter === "Ready to Pick" || statusFilter === "Pending")
          }
          onClick={() => {
            setTab("shipments");
            setStatusFilter("Ready to Pick");
          }}
        />

        <KpiCard
          label="Delayed"
          value={kpis.delayed}
          icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
          accentColor="text-orange-700 bg-orange-50 border-orange-200"
          active={activeTab === "delayed"}
          onClick={() => setTab("delayed")}
          badgeText="Attention"
        />

        <KpiCard
          label="Failed / NDR"
          value={kpis.failedAttempts}
          icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
          accentColor="text-rose-700 bg-rose-50 border-rose-200"
          active={statusFilter === "Failed"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("Failed");
          }}
          badgeText="Attempted"
        />

        <KpiCard
          label="RTO Initiated"
          value={kpis.rtoInitiated}
          icon={<RotateCcw className="h-4 w-4 text-amber-600" />}
          active={activeTab === "rto" && statusFilter === "RTO_Initiated"}
          onClick={() => {
            setTab("rto");
            setStatusFilter("RTO_Initiated");
          }}
        />

        <KpiCard
          label="RTO Returned"
          value={kpis.rtoReturned}
          icon={<RotateCcw className="h-4 w-4 text-rose-600" />}
          accentColor="text-rose-700 bg-rose-50 border-rose-200"
          active={activeTab === "rto"}
          onClick={() => setTab("rto")}
          badgeText="Restocked"
        />

        <KpiCard
          label="Average TAT"
          value={kpis.avgTatDisplay}
          icon={<Timer className="h-4 w-4 text-primary" />}
          badgeText="Pickup ➔ Deliv"
        />
      </div>

      {/* Main Operations Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setTab(val as DashboardTab)} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex flex-wrap gap-1 border">
          <TabsTrigger value="overview" className="text-xs py-2 px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs">
            Overview & Matrix
          </TabsTrigger>
          <TabsTrigger value="shipments" className="text-xs py-2 px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5">
            All Shipments
            <span className="text-[10px] font-semibold font-tabular px-1.5 py-0.2 rounded-full bg-muted">
              {labels.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="today" className="text-xs py-2 px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5">
            Today's Deliveries
            {todayLabels.length > 0 && (
              <span className="text-[10px] font-semibold font-tabular px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                {todayLabels.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="delayed" className="text-xs py-2 px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5">
            Delayed Parcels
            {kpis.delayed > 0 && (
              <span className="text-[10px] font-semibold font-tabular px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                {kpis.delayed}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rto" className="text-xs py-2 px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5">
            RTO Hub
            {kpis.rto > 0 && (
              <span className="text-[10px] font-semibold font-tabular px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300">
                {kpis.rto}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs py-2 px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs">
            Daily Reports
          </TabsTrigger>
        </TabsList>

        {/* -------------------- TAB 1: OVERVIEW -------------------- */}
        <TabsContent value="overview" className="space-y-6">

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
                      <SelectItem value="Ready to Pick">Ready to Pick</SelectItem>
                      <SelectItem value="Shipped">In Transit / Shipped</SelectItem>
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

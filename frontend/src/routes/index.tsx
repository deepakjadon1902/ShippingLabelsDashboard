import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle2,
  CheckCheck,
  RotateCcw,
  Search,
  Pencil,
  Trash2,
  Printer,
  PlusCircle,
  RefreshCw,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  Eye,
  Download,
  Filter,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  XCircle,
  Archive,
  ArrowRight,
  ShieldCheck,
  Building2,
  Phone,
  HelpCircle,
  Timer,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  listLabels,
  deleteLabel,
  updateLabel,
  refreshLabelTracking,
  refreshAllTracking,
  getTrackingUrl,
  STATUSES,
  isLabelOutOfDelivery,
  isLabelDelayed,
  isLabelRtoReturned,
  getOperationalStage,
  formatDateTime,
  formatDuration,
  getDetailedTatMetrics,
  type Label,
  type LabelStatus,
  type OperationalStage,
} from "@/lib/labels";

function getProviderDisplay(label: Label): string {
  if (label.tracking_provider) {
    return label.tracking_provider;
  }
  if (label.tracking_source === "direct") {
    if (label.courier_name?.toLowerCase().includes("maruti")) return "Shree Maruti Direct";
    if (label.courier_name?.toLowerCase().includes("dtdc")) return "DTDC Direct";
    if (label.courier_name?.toLowerCase().includes("delhivery")) return "Delhivery Direct";
    if (label.courier_name?.toLowerCase().includes("ekart")) return "Ekart Direct";
    return "Direct";
  }
  if (label.tracking_source === "trackcourier") {
    return "TrackCourier.io";
  }
  return label.tracking_source || "";
}

export type DashboardTab = "overview" | "shipments" | "today" | "delayed" | "rto" | "reports";

export type DateRange = "today" | "yesterday" | "last7" | "last30" | "all" | "custom";

interface DashboardSearch {
  tab?: DashboardTab;
  range?: DateRange;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    return {
      tab: (search.tab as DashboardTab) || "overview",
      range: (search.range as DateRange) || "all",
    };
  },
  head: () => ({
    meta: [
      { title: "Delivery & Shipment Management — ShippingLabelsDashboard" },
      {
        name: "description",
        content:
          "End-to-end delivery management, real-time courier tracking, route history, and shipment analytics.",
      },
      { property: "og:title", content: "Delivery & Shipment Management" },
      {
        property: "og:description",
        content:
          "Track shipments, inspect route progressions, detect delays, and manage deliveries.",
      },
    ],
  }),
  component: Dashboard,
});

const statusBadgeClasses: Record<LabelStatus, string> = {
  Pending: "bg-amber-100 text-amber-900 border-amber-300",
  Shipped: "bg-blue-100 text-blue-900 border-blue-300",
  Delivered: "bg-emerald-100 text-emerald-900 border-emerald-300",
  RTO: "bg-rose-100 text-rose-900 border-rose-300",
};

const operationalStageBadgeClasses: Record<OperationalStage, string> = {
  Delivered: "bg-emerald-100 text-emerald-950 border-emerald-300 font-semibold",
  "Out for Delivery": "bg-purple-100 text-purple-950 border-purple-400 font-bold",
  "Delivery Attempted": "bg-amber-100 text-amber-950 border-amber-400 font-semibold",
  "Failed / NDR": "bg-rose-100 text-rose-950 border-rose-300 font-semibold",
  "RTO Returned": "bg-rose-100 text-rose-950 border-rose-300 font-semibold",
  "RTO Initiated": "bg-amber-100 text-amber-900 border-amber-300 font-semibold",
  RTO: "bg-rose-100 text-rose-900 border-rose-300 font-semibold",
  "In Transit": "bg-blue-100 text-blue-950 border-blue-300 font-medium",
  Pending: "bg-slate-100 text-slate-800 border-slate-300 font-medium",
};

function isDateInRange(
  dateStr: string | null | undefined,
  range: DateRange,
  customStart?: string,
  customEnd?: string,
): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000 - 1;

  if (range === "all") return true;
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

function isSameCalendarDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Never";
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "Never";
  }
}

function Dashboard() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const qc = useQueryClient();

  const activeTab = searchParams.tab || "overview";
  const dateRange = searchParams.range || "all";

  const [search, setSearch] = useState("");
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [journeyLabelId, setJourneyLabelId] = useState<string | null>(null);

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["labels"],
    queryFn: listLabels,
  });

  const activeJourneyLabel = useMemo(
    () => labels.find((l) => l.id === journeyLabelId) || null,
    [labels, journeyLabelId],
  );

  const couriers = useMemo(
    () =>
      Array.from(new Set(labels.map((l) => l.courier_name)))
        .filter(Boolean)
        .sort(),
    [labels],
  );

  const setTab = (tab: DashboardTab) => {
    navigate({ search: (prev) => ({ ...prev, tab }) });
  };

  const setRange = (range: DateRange) => {
    navigate({ search: (prev) => ({ ...prev, range }) });
  };

  // KPI calculations based on date filtering
  const kpis = useMemo(() => {
    const today = new Date();

    let total = 0;
    let todayShipments = 0;
    let deliveredToday = 0;
    let deliveredTotal = 0;
    let inTransit = 0;
    let outForDelivery = 0;
    let pending = 0;
    let delayed = 0;
    let deliveryFailed = 0;
    let rtoInitiated = 0;
    let rtoReturned = 0;

    for (const l of labels) {
      const createdDate = new Date(l.created_at);
      const isCreatedToday = !isNaN(createdDate.getTime()) && isSameCalendarDay(createdDate, today);
      if (isCreatedToday) {
        todayShipments++;
      }

      // Check if parcel was actually delivered today based on delivered_at timestamp or event
      const deliveredTimestamp = l.delivered_at
        ? new Date(l.delivered_at)
        : l.status === "Delivered" && l.last_tracking_update
          ? new Date(l.last_tracking_update)
          : null;
      if (
        deliveredTimestamp &&
        !isNaN(deliveredTimestamp.getTime()) &&
        isSameCalendarDay(deliveredTimestamp, today)
      ) {
        deliveredToday++;
      }

      // Filter for the selected date range
      const inRange = isDateInRange(l.created_at, dateRange, customStart, customEnd);
      if (!inRange) continue;

      total++;

      const stage = getOperationalStage(l);

      if (stage === "Delivered") {
        deliveredTotal++;
      } else if (stage === "Pending") {
        pending++;
      } else if (stage === "RTO Returned") {
        rtoReturned++;
      } else if (stage === "RTO Initiated" || stage === "RTO") {
        rtoInitiated++;
      } else if (stage === "Out for Delivery") {
        outForDelivery++;
      } else if (stage === "In Transit") {
        inTransit++;
      }

      if (isLabelDelayed(l)) {
        delayed++;
      }

      if (stage === "Delivery Attempted" || stage === "Failed / NDR" || l.is_delivery_failed) {
        deliveryFailed++;
      }
    }

    return {
      total,
      todayShipments,
      deliveredToday,
      deliveredTotal,
      inTransit,
      outForDelivery,
      pending,
      delayed,
      deliveryFailed,
      rtoInitiated,
      rtoReturned,
    };
  }, [labels, dateRange, customStart, customEnd]);

  // Operational shipments table filter
  const filteredShipments = useMemo(() => {
    const s = search.trim().toLowerCase();
    return labels.filter((l) => {
      if (courierFilter !== "all" && l.courier_name !== courierFilter) return false;

      if (statusFilter !== "all") {
        const stage = getOperationalStage(l);
        if (statusFilter === "OFD") {
          if (stage !== "Out for Delivery") return false;
        } else if (statusFilter === "Delayed") {
          if (!isLabelDelayed(l)) return false;
        } else if (statusFilter === "Attempted") {
          if (stage !== "Delivery Attempted") return false;
        } else if (statusFilter === "Failed") {
          if (stage !== "Failed / NDR" && stage !== "Delivery Attempted" && !l.is_delivery_failed)
            return false;
        } else if (statusFilter === "RTO_Initiated") {
          if (stage !== "RTO Initiated" && l.status !== "RTO") return false;
        } else if (statusFilter === "RTO_Returned") {
          if (stage !== "RTO Returned") return false;
        } else if (statusFilter === "RTO") {
          if (l.status !== "RTO" && !stage.includes("RTO")) return false;
        } else if (statusFilter === "Shipped") {
          if (stage !== "In Transit" && l.status !== "Shipped") return false;
        } else if (statusFilter === "Pending") {
          if (stage !== "Pending" && l.status !== "Pending") return false;
        } else if (statusFilter === "Delivered") {
          if (stage !== "Delivered" && l.status !== "Delivered") return false;
        } else if (l.status !== statusFilter) {
          return false;
        }
      }

      if (activeTab === "today") {
        const today = new Date();
        const createdDate = new Date(l.created_at);
        const deliveredDate = l.delivered_at ? new Date(l.delivered_at) : null;
        const isCreatedToday =
          !isNaN(createdDate.getTime()) && isSameCalendarDay(createdDate, today);
        const isDeliveredToday =
          deliveredDate &&
          !isNaN(deliveredDate.getTime()) &&
          isSameCalendarDay(deliveredDate, today);
        const isOfdToday = isLabelOutOfDelivery(l);
        if (!isCreatedToday && !isDeliveredToday && !isOfdToday) return false;
      } else if (activeTab === "delayed") {
        if (!isLabelDelayed(l)) return false;
      } else if (activeTab === "rto") {
        if (l.status !== "RTO" && !l.rto_status) return false;
      }

      if (!s) return true;
      return (
        l.receiver_name.toLowerCase().includes(s) ||
        l.tracking_id.toLowerCase().includes(s) ||
        (l.receiver_mobile_1 ?? "").toLowerCase().includes(s) ||
        (l.receiver_city ?? "").toLowerCase().includes(s) ||
        (l.receiver_pincode ?? "").toLowerCase().includes(s) ||
        (l.order_reference ?? "").toLowerCase().includes(s)
      );
    });
  }, [labels, search, courierFilter, statusFilter, activeTab]);

  // Filtered labels for courierMatrix and TAT analytics based on active date range
  const dateFilteredLabels = useMemo(() => {
    if (dateRange === "all") return labels;
    return labels.filter((l) => {
      const createdInRange = isDateInRange(l.created_at, dateRange, customStart, customEnd);
      const deliveredInRange = l.delivered_at
        ? isDateInRange(l.delivered_at, dateRange, customStart, customEnd)
        : false;
      return createdInRange || deliveredInRange;
    });
  }, [labels, dateRange, customStart, customEnd]);

  // Comprehensive Courier Performance & TAT Matrix
  const courierMatrix = useMemo(() => {
    const map: Record<
      string,
      {
        courier: string;
        volume: number;
        delivered: number;
        inTransit: number;
        ofd: number;
        delayed: number;
        failed: number;
        rto: number;
        tatList: number[];
        pickupToOfdList: number[];
        ofdToDeliveredList: number[];
        onTimeCount: number;
      }
    > = {};

    for (const l of dateFilteredLabels) {
      const c = l.courier_name || "Unknown";
      if (!map[c]) {
        map[c] = {
          courier: c,
          volume: 0,
          delivered: 0,
          inTransit: 0,
          ofd: 0,
          delayed: 0,
          failed: 0,
          rto: 0,
          tatList: [],
          pickupToOfdList: [],
          ofdToDeliveredList: [],
          onTimeCount: 0,
        };
      }
      const item = map[c];
      item.volume++;

      const isDelivered = l.status === "Delivered";
      const isRto = l.status === "RTO" || isLabelRtoReturned(l);
      const isDelayed = isLabelDelayed(l);

      if (isDelivered) {
        item.delivered++;
        if (!isDelayed) {
          item.onTimeCount++;
        }

        // Calculate accurate TAT ms strictly from courier timestamps
        const pickupMs = l.pickup_at ? new Date(l.pickup_at).getTime() : null;
        const delivMs = l.delivered_at ? new Date(l.delivered_at).getTime() : null;
        let tatMs: number | null = null;
        if (pickupMs && delivMs && delivMs >= pickupMs) {
          tatMs = delivMs - pickupMs;
        } else if (l.tat_hours && l.tat_hours > 0) {
          tatMs = l.tat_hours * 3600000;
        }

        if (tatMs && tatMs > 0) {
          item.tatList.push(tatMs);
        }

        // Detailed TAT metrics for OFD breakdown
        const detailed = getDetailedTatMetrics(l);
        if (pickupMs && detailed.outForDeliveryAt) {
          const ofdMs = new Date(detailed.outForDeliveryAt).getTime();
          if (ofdMs >= pickupMs) {
            item.pickupToOfdList.push(ofdMs - pickupMs);
          }
          if (delivMs && delivMs >= ofdMs) {
            item.ofdToDeliveredList.push(delivMs - ofdMs);
          }
        }
      } else if (isRto) {
        item.rto++;
      } else if (isLabelOutOfDelivery(l)) {
        item.ofd++;
      } else if (l.status === "Shipped") {
        item.inTransit++;
      }

      if (isDelayed) {
        item.delayed++;
      }
      if (l.is_delivery_failed) {
        item.failed++;
      }
    }

    return Object.values(map).map((m) => {
      const sampleSize = m.tatList.length;
      const avgTatMs =
        sampleSize > 0 ? Math.round(m.tatList.reduce((a, b) => a + b, 0) / sampleSize) : null;

      // Calculate Median TAT
      let medianTatMs: number | null = null;
      if (sampleSize > 0) {
        const sorted = [...m.tatList].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianTatMs =
          sorted.length % 2 !== 0
            ? sorted[mid]
            : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      }

      const fastestMs = sampleSize > 0 ? Math.min(...m.tatList) : null;
      const slowestMs = sampleSize > 0 ? Math.max(...m.tatList) : null;

      const avgPickupToOfdMs =
        m.pickupToOfdList.length > 0
          ? Math.round(m.pickupToOfdList.reduce((a, b) => a + b, 0) / m.pickupToOfdList.length)
          : null;
      const avgOfdToDeliveredMs =
        m.ofdToDeliveredList.length > 0
          ? Math.round(m.ofdToDeliveredList.reduce((a, b) => a + b, 0) / m.ofdToDeliveredList.length)
          : null;

      const onTimeRate = m.delivered > 0 ? Math.round((m.onTimeCount / m.delivered) * 100) : 100;
      const rtoRate = m.volume > 0 ? Math.round((m.rto / m.volume) * 100) : 0;
      const failedRate = m.volume > 0 ? Math.round((m.failed / m.volume) * 100) : 0;
      const resolved = m.delivered + m.rto + m.failed;
      const successRate = resolved > 0 ? Math.round((m.delivered / resolved) * 100) : 0;

      return {
        ...m,
        sampleSize,
        avgTatDisplay: formatDuration(avgTatMs) || "Not available from courier",
        medianTatDisplay: formatDuration(medianTatMs) || "Not available from courier",
        fastestTatDisplay: formatDuration(fastestMs) || "Not available from courier",
        slowestTatDisplay: formatDuration(slowestMs) || "Not available from courier",
        avgPickupToOfdDisplay: formatDuration(avgPickupToOfdMs) || "Not available from courier",
        avgOfdToDeliveredDisplay:
          formatDuration(avgOfdToDeliveredMs) || "Not available from courier",
        onTimeRate,
        rtoRate,
        failedRate,
        successRate,
        avgTatHours: avgTatMs ? Math.round(avgTatMs / 3600000) : null,
      };
    });
  }, [dateFilteredLabels]);

  // Overall TAT Statistics across all couriers for the active date range
  const overallTatStats = useMemo(() => {
    const allTatMs: number[] = [];
    const allPickupToOfdMs: number[] = [];
    const allOfdToDeliveredMs: number[] = [];
    let totalDelivered = 0;
    let totalOnTime = 0;
    let totalDelayed = 0;
    let totalRto = 0;
    const totalVolume = dateFilteredLabels.length;

    for (const c of courierMatrix) {
      allTatMs.push(...c.tatList);
      allPickupToOfdMs.push(...c.pickupToOfdList);
      allOfdToDeliveredMs.push(...c.ofdToDeliveredList);
      totalDelivered += c.delivered;
      totalOnTime += c.onTimeCount;
      totalDelayed += c.delayed;
      totalRto += c.rto;
    }

    const sampleSize = allTatMs.length;
    const avgTatMs =
      sampleSize > 0 ? Math.round(allTatMs.reduce((a, b) => a + b, 0) / sampleSize) : null;
    const avgPickupToOfdMs =
      allPickupToOfdMs.length > 0
        ? Math.round(allPickupToOfdMs.reduce((a, b) => a + b, 0) / allPickupToOfdMs.length)
        : null;
    const avgOfdToDeliveredMs =
      allOfdToDeliveredMs.length > 0
        ? Math.round(allOfdToDeliveredMs.reduce((a, b) => a + b, 0) / allOfdToDeliveredMs.length)
        : null;

    return {
      sampleSize,
      avgTatDisplay: formatDuration(avgTatMs) || "N/A",
      onTimeRate: totalDelivered > 0 ? Math.round((totalOnTime / totalDelivered) * 100) : 100,
      totalDelayed,
      avgPickupToOfdDisplay: formatDuration(avgPickupToOfdMs) || "N/A",
      avgOfdToDeliveredDisplay: formatDuration(avgOfdToDeliveredMs) || "N/A",
      rtoRate: totalVolume > 0 ? Math.round((totalRto / totalVolume) * 100) : 0,
    };
  }, [courierMatrix, dateFilteredLabels.length]);

  // Delivery trend chart data (last 14 days)
  const trendData = useMemo(() => {
    const daysMap: Record<string, { date: string; created: number; delivered: number }> = {};
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      daysMap[key] = {
        date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        created: 0,
        delivered: 0,
      };
    }

    for (const l of labels) {
      if (l.created_at) {
        const cKey = l.created_at.slice(0, 10);
        if (daysMap[cKey]) {
          daysMap[cKey].created++;
        }
      }
      const dDate = l.delivered_at || (l.status === "Delivered" ? l.last_tracking_update : null);
      if (dDate) {
        const dKey = dDate.slice(0, 10);
        if (daysMap[dKey]) {
          daysMap[dKey].delivered++;
        }
      }
    }

    return Object.values(daysMap);
  }, [labels]);

  // Daily Report calculations for selected reportDate
  const dailyReportData = useMemo(() => {
    const filtered = labels.filter((l) => {
      const cDate = l.created_at ? l.created_at.slice(0, 10) : "";
      const dDate = l.delivered_at
        ? l.delivered_at.slice(0, 10)
        : l.status === "Delivered" && l.last_tracking_update
          ? l.last_tracking_update.slice(0, 10)
          : "";
      const eDate = l.tracking_event_date ? l.tracking_event_date.slice(0, 10) : "";
      return cDate === reportDate || dDate === reportDate || eDate === reportDate;
    });

    const courierBreakdown: Record<
      string,
      {
        courier: string;
        active: number;
        delivered: number;
        ofd: number;
        failed: number;
        rto: number;
      }
    > = {};

    let totalActive = 0;
    let totalDelivered = 0;
    let totalOfd = 0;
    let totalFailed = 0;
    let totalRto = 0;

    for (const l of filtered) {
      totalActive++;
      const c = l.courier_name || "Unknown";
      if (!courierBreakdown[c]) {
        courierBreakdown[c] = {
          courier: c,
          active: 0,
          delivered: 0,
          ofd: 0,
          failed: 0,
          rto: 0,
        };
      }
      const cb = courierBreakdown[c];
      cb.active++;

      const isDeliveredOnDate =
        l.delivered_at?.slice(0, 10) === reportDate ||
        (l.status === "Delivered" && l.last_tracking_update?.slice(0, 10) === reportDate);
      if (isDeliveredOnDate) {
        totalDelivered++;
        cb.delivered++;
      }

      if (isLabelOutOfDelivery(l)) {
        totalOfd++;
        cb.ofd++;
      }
      if (l.is_delivery_failed) {
        totalFailed++;
        cb.failed++;
      }
      if (l.status === "RTO") {
        totalRto++;
        cb.rto++;
      }
    }

    return {
      date: reportDate,
      totalActive,
      totalDelivered,
      totalOfd,
      totalFailed,
      totalRto,
      labels: filtered,
      breakdown: Object.values(courierBreakdown),
    };
  }, [labels, reportDate]);

  // Mutations
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LabelStatus }) =>
      updateLabel(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Shipment status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Shipment record deleted");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshOneMutation = useMutation({
    mutationFn: (id: string) => refreshLabelTracking(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      if (r.skipped && r.error) {
        toast.warning(r.error);
      } else if (r.skipped) {
        toast.info(r.reason ?? "Sync skipped");
      } else if (r.error) {
        if (r.error.includes("rate-limited") || r.error.includes("429")) {
          toast.warning(r.error);
        } else {
          toast.warning(`Tracking check warning: ${r.error}`);
        }
      } else {
        toast.success(`Synced: ${r.rawStatus ?? r.updatedStatus ?? "up to date"}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshAllMutation = useMutation({
    mutationFn: refreshAllTracking,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success(
        `Synchronized ${r.processed} shipments (${r.updated} updated, ${r.failed} failed, ${r.skipped} skipped)`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExportCsv = () => {
    const headers = [
      "Report Date",
      "Tracking ID / AWB",
      "Courier Name",
      "Customer Name",
      "Customer Mobile",
      "City",
      "State",
      "Pincode",
      "Order Reference",
      "Shipment Status",
      "Current Location",
      "Latest Checkpoint Description",
      "Latest Checkpoint Time",
      "Pickup Timestamp",
      "Delivered Timestamp",
      "TAT (Hours)",
      "TAT Display",
      "Delayed",
      "Delayed Days",
      "Delivery Failed",
      "Failure Reason",
      "RTO Status",
      "Origin Location",
      "Destination Location",
    ];

    const rows = dailyReportData.labels.map((l) => [
      reportDate,
      `"${l.tracking_id}"`,
      `"${l.courier_name}"`,
      `"${l.receiver_name}"`,
      `"${l.receiver_mobile_1}"`,
      `"${l.receiver_city}"`,
      `"${l.receiver_state}"`,
      `"${l.receiver_pincode}"`,
      `"${l.order_reference || ""}"`,
      `"${l.status}"`,
      `"${(l.tracking_location || "").replace(/"/g, '""')}"`,
      `"${(l.tracking_event_description || l.raw_courier_status || "").replace(/"/g, '""')}"`,
      `"${l.tracking_event_date || ""}"`,
      `"${l.pickup_at || ""}"`,
      `"${l.delivered_at || ""}"`,
      l.tat_hours ?? "",
      `"${l.tat_display || ""}"`,
      l.is_delayed ? "Yes" : "No",
      l.delayed_days ?? 0,
      l.is_delivery_failed ? "Yes" : "No",
      `"${(l.delivery_failure_reason || "").replace(/"/g, '""')}"`,
      `"${l.rto_status || ""}"`,
      `"${(l.origin_location || "").replace(/"/g, '""')}"`,
      `"${(l.destination_location || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `delivery-report-${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported daily report for ${reportDate}`);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header & Global Sync Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Delivery Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-courier tracking, route progression, delay detection, and delivery
            metrics.
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
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[125px] h-7 text-xs px-2 py-0 bg-background"
              />
              <span className="text-muted-foreground text-[11px]">To:</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[125px] h-7 text-xs px-2 py-0 bg-background"
              />
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending}
            title="Synchronize real-time tracking for all active parcels"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${refreshAllMutation.isPending ? "animate-spin" : ""}`}
            />
            {refreshAllMutation.isPending ? "Syncing..." : "Sync All Couriers"}
          </Button>

          <Button asChild size="sm">
            <Link to="/create">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Create Label
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link to="/print">
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Labels
            </Link>
          </Button>
        </div>
      </div>

      {/* 11 Live KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2.5">
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
          value={kpis.todayShipments}
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
          value={kpis.deliveredTotal}
          icon={<CheckCheck className="h-4 w-4 text-emerald-600" />}
          active={activeTab === "shipments" && statusFilter === "Delivered"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("Delivered");
          }}
        />

        <KpiCard
          label="In Transit"
          value={kpis.inTransit}
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
          label="Pending Pickup"
          value={kpis.pending}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          active={activeTab === "shipments" && statusFilter === "Pending"}
          onClick={() => {
            setTab("shipments");
            setStatusFilter("Pending");
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
          value={kpis.deliveryFailed}
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
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
          icon={<Archive className="h-4 w-4 text-rose-600" />}
          accentColor="text-rose-700 bg-rose-50 border-rose-200"
          active={activeTab === "rto"}
          onClick={() => setTab("rto")}
          badgeText="Restocked"
        />
      </div>

      {/* Main Operations Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setTab(v as DashboardTab)}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList className="bg-muted/70 p-1">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Overview & Matrix
            </TabsTrigger>
            <TabsTrigger value="shipments" className="flex items-center gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5" /> All Shipments
            </TabsTrigger>
            <TabsTrigger value="today" className="flex items-center gap-1.5 text-xs">
              <CalendarCheck className="h-3.5 w-3.5" /> Today's Deliveries
            </TabsTrigger>
            <TabsTrigger value="delayed" className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" /> Delayed Parcels
            </TabsTrigger>
            <TabsTrigger value="rto" className="flex items-center gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> RTO Hub
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Daily Reports
            </TabsTrigger>
          </TabsList>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>
              Showing {filteredShipments.length} of {labels.length} total shipments
            </span>
          </div>
        </div>

        {/* Tab 1: Overview & Matrix */}
        <TabsContent value="overview" className="space-y-6">
          {/* TAT & Delivery Performance KPI Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <Card className="bg-card shadow-xs">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Avg Delivery TAT</span>
                  <Timer className="h-4 w-4 text-primary" />
                </div>
                <div
                  className="text-base font-bold text-foreground mt-1 truncate"
                  title={overallTatStats.avgTatDisplay}
                >
                  {overallTatStats.avgTatDisplay}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  n = {overallTatStats.sampleSize} with courier timestamps
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-xs lg:col-span-2">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Avg TAT by Courier</span>
                  <Truck className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {courierMatrix.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No courier data</span>
                  ) : (
                    courierMatrix.map((c) => (
                      <Badge
                        key={c.courier}
                        variant="secondary"
                        className="text-[11px] font-medium px-2 py-0.5 flex items-center gap-1"
                        title={`Sample size: ${c.sampleSize} shipments`}
                      >
                        <span className="font-semibold">{c.courier}:</span>
                        <span>
                          {c.avgTatDisplay !== "Not available from courier" ? c.avgTatDisplay : "N/A"}
                        </span>
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-xs">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">On-Time Delivery</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-base font-bold text-emerald-700 mt-1">
                  {overallTatStats.onTimeRate}%
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Based on courier SLA
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-xs">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Delayed Parcels</span>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-base font-bold text-orange-700 mt-1">
                  {overallTatStats.totalDelayed}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Breached SLA or Est. Date
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-xs">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Avg Pickup → OFD</span>
                  <Clock className="h-4 w-4 text-purple-600" />
                </div>
                <div
                  className="text-xs font-bold text-foreground mt-1 truncate"
                  title={overallTatStats.avgPickupToOfdDisplay}
                >
                  {overallTatStats.avgPickupToOfdDisplay}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Hub transit turnaround
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-xs">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Avg OFD → Delivered</span>
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
                <div
                  className="text-xs font-bold text-foreground mt-1 truncate"
                  title={overallTatStats.avgOfdToDeliveredDisplay}
                >
                  {overallTatStats.avgOfdToDeliveredDisplay}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Last-mile drop duration
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 14-Day Delivery Trend Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Shipment Creation & Delivery Trend (Past 14 Days)</span>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    Live Data
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparison between parcels created vs parcels successfully delivered by courier.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[240px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trendData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "none",
                          borderRadius: "6px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Area
                        type="monotone"
                        dataKey="created"
                        name="Created"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorCreated)"
                      />
                      <Area
                        type="monotone"
                        dataKey="delivered"
                        name="Delivered"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorDelivered)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Courier Volume Breakdown Chart */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Courier Volume Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Delivered vs In Transit parcels by courier
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[240px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={courierMatrix}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis
                        dataKey="courier"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        tickFormatter={(v) => (v.length > 8 ? `${v.slice(0, 8)}…` : v)}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "none",
                          borderRadius: "6px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar
                        dataKey="delivered"
                        name="Delivered"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="inTransit"
                        name="In Transit"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar dataKey="rto" name="RTO" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Courier Performance Matrix Table */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Courier Performance & TAT Analytics Matrix
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Benchmark delivery turnaround time (TAT), on-time SLA compliance, and RTO risk
                    per courier partner.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-muted/40 font-normal">
                  Calculated strictly from completed courier timestamps
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead className="font-semibold min-w-[140px]">Courier Partner</TableHead>
                      <TableHead className="text-center font-semibold min-w-[90px]">Total Vol</TableHead>
                      <TableHead className="text-center font-semibold min-w-[110px]">
                        Delivered (Sample)
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[130px]">
                        Avg Delivery TAT
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[120px]">
                        Median TAT
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[110px]">
                        Fastest TAT
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[110px]">
                        Slowest TAT
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[90px]">On-Time %</TableHead>
                      <TableHead className="text-center font-semibold min-w-[80px]">Delayed</TableHead>
                      <TableHead className="text-center font-semibold min-w-[120px]">
                        Avg Pickup → OFD
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[120px]">
                        Avg OFD → Deliv
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[80px]">RTO %</TableHead>
                      <TableHead className="text-right font-semibold min-w-[90px]">NDR Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courierMatrix.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={13}
                          className="text-center py-6 text-muted-foreground text-xs"
                        >
                          No courier shipments recorded for the selected date range.
                        </TableCell>
                      </TableRow>
                    ) : (
                      courierMatrix.map((c) => (
                        <TableRow key={c.courier} className="text-xs hover:bg-muted/30">
                          {/* Courier Partner */}
                          <TableCell className="font-medium flex items-center gap-2">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold">{c.courier}</span>
                          </TableCell>

                          {/* Total Volume */}
                          <TableCell className="text-center font-semibold">{c.volume}</TableCell>

                          {/* Delivered (Sample Size) */}
                          <TableCell className="text-center">
                            <div className="font-semibold text-emerald-700">{c.delivered}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {c.sampleSize > 0 ? `n = ${c.sampleSize}` : "No TAT timestamps"}
                            </div>
                          </TableCell>

                          {/* Avg Delivery TAT */}
                          <TableCell className="text-center font-semibold">
                            {c.avgTatDisplay !== "Not available from courier" ? (
                              <Badge variant="outline" className="bg-muted/50 font-semibold text-xs">
                                {c.avgTatDisplay}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">
                                Not available from courier
                              </span>
                            )}
                          </TableCell>

                          {/* Median TAT */}
                          <TableCell className="text-center">
                            {c.medianTatDisplay !== "Not available from courier" ? (
                              <span className="font-medium text-foreground">{c.medianTatDisplay}</span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">--</span>
                            )}
                          </TableCell>

                          {/* Fastest TAT */}
                          <TableCell className="text-center">
                            {c.fastestTatDisplay !== "Not available from courier" ? (
                              <span className="text-emerald-700 font-medium">
                                {c.fastestTatDisplay}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">--</span>
                            )}
                          </TableCell>

                          {/* Slowest TAT */}
                          <TableCell className="text-center">
                            {c.slowestTatDisplay !== "Not available from courier" ? (
                              <span className="text-orange-700 font-medium">
                                {c.slowestTatDisplay}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">--</span>
                            )}
                          </TableCell>

                          {/* On-Time % */}
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold ${
                                c.onTimeRate >= 85
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : c.onTimeRate >= 65
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-rose-50 text-rose-800 border-rose-200"
                              }`}
                            >
                              {c.onTimeRate}%
                            </Badge>
                          </TableCell>

                          {/* Delayed Count */}
                          <TableCell className="text-center">
                            {c.delayed > 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-800 border-orange-200 text-[11px]"
                              >
                                {c.delayed}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>

                          {/* Avg Pickup -> OFD */}
                          <TableCell className="text-center text-[11px] text-muted-foreground">
                            {c.avgPickupToOfdDisplay !== "Not available from courier" ? (
                              c.avgPickupToOfdDisplay
                            ) : (
                              <span>--</span>
                            )}
                          </TableCell>

                          {/* Avg OFD -> Delivered */}
                          <TableCell className="text-center text-[11px] text-muted-foreground">
                            {c.avgOfdToDeliveredDisplay !== "Not available from courier" ? (
                              c.avgOfdToDeliveredDisplay
                            ) : (
                              <span>--</span>
                            )}
                          </TableCell>

                          {/* RTO % */}
                          <TableCell className="text-center">
                            <span
                              className={`font-semibold ${
                                c.rtoRate > 15 ? "text-rose-600" : "text-muted-foreground"
                              }`}
                            >
                              {c.rtoRate}%
                            </span>
                          </TableCell>

                          {/* NDR / Failed Rate */}
                          <TableCell className="text-right">
                            <span
                              className={`font-medium ${
                                c.failedRate > 10 ? "text-rose-600" : "text-muted-foreground"
                              }`}
                            >
                              {c.failedRate}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Shipments Preview with button to full table */}
          <Card>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Shipments</CardTitle>
                <CardDescription className="text-xs">
                  Latest parcels recorded across all courier integrations
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setTab("shipments")}
              >
                View all in Shipments table <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ShipmentTable
                labels={filteredShipments.slice(0, 10)}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={
                  refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Full Shipments Management */}
        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 text-xs"
                    placeholder="Search AWB, customer name, phone, city, order ref..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={courierFilter} onValueChange={setCourierFilter}>
                    <SelectTrigger className="w-[160px] text-xs h-9">
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
                    <SelectTrigger className="w-[170px] text-xs h-9">
                      <SelectValue placeholder="All Statuses" />
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
                      <SelectItem value="Delayed">Delayed Shipments</SelectItem>
                    </SelectContent>
                  </Select>

                  {(search || courierFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => {
                        setSearch("");
                        setCourierFilter("all");
                        setStatusFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ShipmentTable
                labels={filteredShipments}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={
                  refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Today's Deliveries */}
        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-600" />
                    Today's Deliveries & Dispatches
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Parcels scheduled Out for Delivery today, delivered today, or dispatched today.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200"
                  >
                    Delivered Today: {kpis.deliveredToday}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-purple-50 text-purple-800 border-purple-200"
                  >
                    Out for Delivery: {kpis.outForDelivery}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ShipmentTable
                labels={filteredShipments}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={
                  refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Delayed Parcels */}
        <TabsContent value="delayed" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Delayed Shipments & SLA Breaches
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Parcels that have breached estimated courier delivery dates or exceeded standard
                    transit SLAs.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                  {kpis.delayed} Delayed Parcels Requiring Follow-up
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ShipmentTable
                labels={filteredShipments}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={
                  refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: RTO Hub */}
        <TabsContent value="rto" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-800">
                    <RotateCcw className="h-4 w-4 text-rose-600" />
                    Return to Origin (RTO) Management Hub
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Track returned shipments across all lifecycle stages: RTO Initiated ➔ In Transit
                    ➔ Origin Hub Reached ➔ Restocked.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                    RTO in Transit: {kpis.rtoInitiated}
                  </Badge>
                  <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-200">
                    RTO Restocked: {kpis.rtoReturned}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ShipmentTable
                labels={filteredShipments}
                isLoading={isLoading}
                onOpenJourney={(id) => setJourneyLabelId(id)}
                onRefresh={(id) => refreshOneMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onDelete={(id) => setDeleteId(id)}
                refreshingId={
                  refreshOneMutation.isPending ? (refreshOneMutation.variables as string) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Daily Delivery Reports */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    Daily Delivery Operational Report & Audit
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate, inspect, and export comprehensive daily delivery and dispatch audit
                    reports.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Select Date:</span>
                    <Input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-[150px] text-xs h-8"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={handleExportCsv}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Daily Report KPI summary strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-muted/40 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground">Active / Logged:</span>
                  <div className="text-lg font-bold mt-0.5">{dailyReportData.totalActive}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-emerald-800">Delivered on Date:</span>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    {dailyReportData.totalDelivered}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-purple-800">Out for Delivery:</span>
                  <div className="text-lg font-bold text-purple-700 mt-0.5">
                    {dailyReportData.totalOfd}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-rose-800">Delivery Failed:</span>
                  <div className="text-lg font-bold text-rose-700 mt-0.5">
                    {dailyReportData.totalFailed}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-rose-800">RTO Count:</span>
                  <div className="text-lg font-bold text-rose-700 mt-0.5">
                    {dailyReportData.totalRto}
                  </div>
                </div>
              </div>

              {/* Courier Breakdown on selected day */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Courier Breakdown for {reportDate}
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs">
                        <TableHead>Courier</TableHead>
                        <TableHead className="text-center">Active on Date</TableHead>
                        <TableHead className="text-center">Delivered</TableHead>
                        <TableHead className="text-center">Out for Delivery</TableHead>
                        <TableHead className="text-center">Failed</TableHead>
                        <TableHead className="text-center">RTO</TableHead>
                        <TableHead className="text-right">Daily Success %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReportData.breakdown.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-6 text-muted-foreground text-xs"
                          >
                            No shipments recorded on {reportDate}.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dailyReportData.breakdown.map((b) => {
                          const res = b.delivered + b.failed + b.rto;
                          const sRate = res > 0 ? Math.round((b.delivered / res) * 100) : 0;
                          return (
                            <TableRow key={b.courier} className="text-xs">
                              <TableCell className="font-medium">{b.courier}</TableCell>
                              <TableCell className="text-center">{b.active}</TableCell>
                              <TableCell className="text-center text-emerald-700 font-semibold">
                                {b.delivered}
                              </TableCell>
                              <TableCell className="text-center text-purple-700">{b.ofd}</TableCell>
                              <TableCell className="text-center text-rose-700">
                                {b.failed}
                              </TableCell>
                              <TableCell className="text-center">{b.rto}</TableCell>
                              <TableCell className="text-right font-semibold">
                                <Badge
                                  variant="outline"
                                  className={
                                    sRate >= 80
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : "bg-muted text-muted-foreground"
                                  }
                                >
                                  {sRate}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shipment Journey & Road View Detail Dialog */}
      <ShipmentJourneyDialog
        label={activeJourneyLabel}
        open={!!journeyLabelId}
        onOpenChange={(o) => !o && setJourneyLabelId(null)}
        onRefresh={(id) => refreshOneMutation.mutate(id)}
        refreshing={
          refreshOneMutation.isPending && refreshOneMutation.variables === activeJourneyLabel?.id
        }
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shipment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the shipment and its tracking history. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Shipment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card Sub-Component
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon,
  accentColor,
  active,
  onClick,
  badgeText,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentColor?: string;
  active?: boolean;
  onClick?: () => void;
  badgeText?: string;
}) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition hover:shadow-sm border ${
        active ? "ring-2 ring-primary border-primary bg-primary/5" : ""
      } ${accentColor || "bg-card"}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-1">
          <div className="text-[11px] font-medium text-muted-foreground truncate" title={label}>
            {label}
          </div>
          <div className="shrink-0">{icon}</div>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xl font-bold tracking-tight">{value}</span>
          {badgeText && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold">
              {badgeText}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Operational Shipment Table Sub-Component
// ---------------------------------------------------------------------------

function ShipmentTable({
  labels,
  isLoading,
  onOpenJourney,
  onRefresh,
  onStatusChange,
  onDelete,
  refreshingId,
}: {
  labels: Label[];
  isLoading: boolean;
  onOpenJourney: (id: string) => void;
  onRefresh: (id: string) => void;
  onStatusChange: (id: string, status: LabelStatus) => void;
  onDelete: (id: string) => void;
  refreshingId: string | null;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Loading shipments and live courier tracking...
      </div>
    );
  }

  if (labels.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No shipments matching current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 text-xs">
            <TableHead className="min-w-[180px]">Customer & Destination</TableHead>
            <TableHead className="min-w-[150px]">AWB & Courier</TableHead>
            <TableHead className="min-w-[130px]">Status & Flags</TableHead>
            <TableHead className="min-w-[160px]">Current Location</TableHead>
            <TableHead className="min-w-[180px]">Latest Checkpoint & Time</TableHead>
            <TableHead className="min-w-[130px]">Delivery Timelines</TableHead>
            <TableHead className="min-w-[90px]">TAT</TableHead>
            <TableHead className="min-w-[110px]">Last Sync</TableHead>
            <TableHead className="text-right min-w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labels.map((label) => {
            const stage = getOperationalStage(label);
            const delayed = isLabelDelayed(label);
            const trackingUrl = getTrackingUrl(label.courier_name, label.tracking_id);
            const isRefreshing = refreshingId === label.id;

            return (
              <TableRow key={label.id} className="text-xs hover:bg-muted/30">
                {/* 1. Customer & Destination */}
                <TableCell>
                  <div className="font-semibold text-foreground text-xs">{label.receiver_name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-2.5 w-2.5 inline" /> {label.receiver_mobile_1}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                    {label.receiver_city}, {label.receiver_state} • {label.receiver_pincode}
                  </div>
                  {label.order_reference && (
                    <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                      Ref: {label.order_reference}
                    </div>
                  )}
                </TableCell>

                {/* 2. AWB & Courier */}
                <TableCell>
                  <div className="flex items-center gap-1 font-mono font-semibold text-xs text-foreground">
                    <span>{label.tracking_id}</span>
                    {trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary/80"
                        title="Open on official courier portal"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Truck className="h-3 w-3 inline text-muted-foreground" />
                    <span>{label.courier_name}</span>
                  </div>
                  {getProviderDisplay(label) && (
                    <div className="text-[9px] text-muted-foreground uppercase mt-0.5 font-medium">
                      via {getProviderDisplay(label)}
                    </div>
                  )}
                </TableCell>

                {/* 3. Status & Flags */}
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpenJourney(label.id)}
                    className="text-left flex flex-col items-start gap-1 group focus:outline-none"
                    title="Click to view full route progression and timeline"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`${operationalStageBadgeClasses[stage]} cursor-pointer transition group-hover:ring-1 group-hover:ring-primary/40 text-[11px] px-2 py-0.5`}
                      >
                        {stage}
                      </Badge>

                      {delayed && (
                        <Badge
                          variant="outline"
                          className="bg-orange-100 text-orange-900 border-orange-300 text-[10px] px-1.5 py-0"
                        >
                          Delayed
                        </Badge>
                      )}
                    </div>
                    {stage !== label.status && (
                      <span className="text-[10px] text-muted-foreground">
                        Core: {label.status}
                      </span>
                    )}
                  </button>
                </TableCell>

                {/* 4. Current Location */}
                <TableCell>
                  {label.tracking_location ? (
                    <div className="flex items-start gap-1 text-foreground">
                      <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      <span className="font-medium line-clamp-2 max-w-[170px]">
                        {label.tracking_location}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[11px] italic">
                      Not available from courier
                    </span>
                  )}
                </TableCell>

                {/* 5. Latest Checkpoint & Time */}
                <TableCell>
                  <div
                    className="font-medium text-foreground text-xs truncate max-w-[200px]"
                    title={label.tracking_event_description || label.raw_courier_status || ""}
                  >
                    {label.tracking_event_description ||
                      label.raw_courier_status ||
                      "Awaiting courier update"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 inline" />
                    <span>{formatDateTime(label.tracking_event_date)}</span>
                  </div>
                </TableCell>

                {/* 6. Delivery Timelines (Expected vs Actual) */}
                <TableCell>
                  {label.delivered_at ? (
                    <div>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Delivered
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDateTime(label.delivered_at)}
                      </div>
                    </div>
                  ) : label.tracking_estimated_delivery ? (
                    <div>
                      <span className="text-muted-foreground">Est:</span>{" "}
                      <span className="font-medium text-foreground">
                        {label.tracking_estimated_delivery}
                      </span>
                      {delayed && label.delayed_days ? (
                        <div className="text-[10px] text-orange-600 font-semibold mt-0.5">
                          +{label.delayed_days}d past SLA
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">Not specified</span>
                  )}
                </TableCell>

                {/* 7. Turnaround Time (TAT) */}
                <TableCell>
                  {label.tat_display ? (
                    <span className="font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                      {label.tat_display}
                    </span>
                  ) : label.pickup_at && label.status !== "Delivered" ? (
                    <span className="text-[11px] text-blue-600 font-medium">In Transit</span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">--</span>
                  )}
                </TableCell>

                {/* 8. Last Sync Timestamp & Status */}
                <TableCell>
                  <div>
                    <span className="text-muted-foreground text-[11px]">
                      {formatRelativeTime(label.last_tracking_update)}
                    </span>
                    {label.api_status_conflict && (
                      <div
                        className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5 mt-0.5"
                        title={label.api_status_conflict}
                      >
                        <ShieldCheck className="h-2.5 w-2.5" /> Conflict safe
                      </div>
                    )}
                    {label.last_tracking_error &&
                      !label.api_status_conflict &&
                      label.status !== "Delivered" &&
                      (label.last_sync_attempt &&
                      label.last_successful_sync &&
                      new Date(label.last_sync_attempt).getTime() >
                        new Date(label.last_successful_sync).getTime() ? (
                        <div
                          className="text-[9px] text-rose-600 truncate max-w-[110px] mt-0.5"
                          title={label.last_tracking_error}
                        >
                          {label.last_tracking_error.includes("429")
                            ? "Rate limited"
                            : "Sync notice"}
                        </div>
                      ) : (
                        label.last_tracking_error &&
                        !label.last_successful_sync && (
                          <div
                            className="text-[9px] text-rose-600 truncate max-w-[110px] mt-0.5"
                            title={label.last_tracking_error}
                          >
                            Sync notice
                          </div>
                        )
                      ))}
                  </div>
                </TableCell>

                {/* 9. Actions */}
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Inspect full road journey and checkpoints"
                      onClick={() => onOpenJourney(label.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Refresh real-time tracking"
                      onClick={() => onRefresh(label.id)}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {STATUSES.map((s) => (
                          <DropdownMenuItem key={s} onClick={() => onStatusChange(label.id, s)}>
                            Mark as {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Edit">
                      <Link to="/edit/$id" params={{ id: label.id }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Print label"
                    >
                      <Link to="/print" search={{ ids: label.id }}>
                        <Printer className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title="Delete"
                      onClick={() => onDelete(label.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shipment Journey & Road View Detail Dialog Sub-Component
// ---------------------------------------------------------------------------

function ShipmentJourneyDialog({
  label,
  open,
  onOpenChange,
  onRefresh,
  refreshing,
}: {
  label: Label | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: (id: string) => void;
  refreshing: boolean;
}) {
  if (!label) return null;

  const trackingUrl = getTrackingUrl(label.courier_name, label.tracking_id);
  const outForDelivery = isLabelOutOfDelivery(label);
  const delayed = isLabelDelayed(label);
  const rtoReturned = isLabelRtoReturned(label);
  const tatMetrics = getDetailedTatMetrics(label);

  // Extract intermediate checkpoint locations for Road View progression
  const checkpoints = label.tracking_history || [];
  const intermediateLocations = Array.from(
    new Set(
      checkpoints
        .map((c) => c.location)
        .filter((loc): loc is string => Boolean(loc && loc.trim().length > 0)),
    ),
  );

  // Sort checkpoints chronologically (oldest to newest)
  const chronologicalCheckpoints = [...checkpoints].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return ta - tb;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0">
        {/* Dialog Header */}
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg font-bold">
                  Shipment Journey & TAT Analysis
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={`${operationalStageBadgeClasses[getOperationalStage(label)]} text-xs px-2.5 py-0.5`}
                >
                  {getOperationalStage(label)}
                </Badge>
                {getOperationalStage(label) !== label.status && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    (Core: {label.status})
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 font-semibold ${
                    tatMetrics.isDelayed
                      ? "bg-orange-100 text-orange-950 border-orange-300"
                      : label.status === "Delivered"
                        ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                        : "bg-blue-100 text-blue-950 border-blue-300"
                  }`}
                >
                  {tatMetrics.performanceLabel}
                </Badge>
              </div>
              <DialogDescription className="mt-1 text-xs">
                AWB:{" "}
                <span className="font-mono font-bold text-foreground">{label.tracking_id}</span> •
                Partner: <span className="font-medium text-foreground">{label.courier_name}</span>
                {getProviderDisplay(label) && (
                  <span className="text-muted-foreground"> (via {getProviderDisplay(label)})</span>
                )}
              </DialogDescription>
            </div>

            {(tatMetrics.pickupToDeliveredDisplay || label.tat_display) && (
              <Badge variant="secondary" className="text-xs px-2.5 py-1 font-bold">
                <Timer className="h-3 w-3 mr-1 inline text-primary" />
                TAT: {tatMetrics.pickupToDeliveredDisplay || label.tat_display}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status conflict or alert banner */}
          {label.api_status_conflict ? (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Delivery Protection Active: </span>
                <span>
                  Courier API returned status conflict, but verified Delivered status is safely
                  preserved.
                </span>
              </div>
            </div>
          ) : label.last_tracking_error ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Courier Sync Notice: </span>
                <span>{label.last_tracking_error}</span>
              </div>
            </div>
          ) : null}

          {/* 1. TOP SUMMARY CARD */}
          <div className="bg-muted/40 rounded-xl p-4 border space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-primary" /> Delivery Time & Turnaround (TAT)
                Summary
              </div>
              <span className="text-[11px] font-medium text-foreground">
                {label.status === "Delivered"
                  ? "Delivered to Consignee"
                  : label.status === "RTO"
                    ? "RTO Processed"
                    : "In Active Transit"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Metric 1: Delivery TAT (Pickup -> Delivered) */}
              <div className="p-2.5 bg-background rounded-lg border">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Delivery TAT (Pickup → Deliv)
                </span>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {tatMetrics.pickupToDeliveredDisplay ||
                    (label.status === "Delivered"
                      ? label.tat_display || "Not available from courier"
                      : label.status === "RTO"
                        ? tatMetrics.pickupToRtoReturnedDisplay
                          ? `${tatMetrics.pickupToRtoReturnedDisplay} (RTO)`
                          : "Not available from courier"
                        : "In Progress")}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {label.pickup_at && (label.delivered_at || label.rto_returned_at)
                    ? "Direct courier timestamps"
                    : "Pickup to Delivered duration"}
                </div>
              </div>

              {/* Metric 2: Dispatched Date / Time */}
              <div className="p-2.5 bg-background rounded-lg border">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Dispatched Date & Time
                </span>
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  {formatDateTime(label.created_at)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Manifest & Label Created
                </div>
              </div>

              {/* Metric 3: Delivered Date / Time */}
              <div className="p-2.5 bg-background rounded-lg border">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  {label.status === "RTO" ? "RTO Returned Date" : "Delivered Date & Time"}
                </span>
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  {label.status === "Delivered"
                    ? formatDateTime(label.delivered_at)
                    : label.status === "RTO"
                      ? formatDateTime(label.rto_returned_at)
                      : "Pending Delivery"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {label.status === "Delivered"
                    ? label.delivered_at
                      ? "Confirmed by courier"
                      : "Not available from courier"
                    : label.status === "RTO"
                      ? "Returned to origin"
                      : "Awaiting final delivery"}
                </div>
              </div>

              {/* Metric 4: Expected Delivery */}
              <div className="p-2.5 bg-background rounded-lg border">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Expected Delivery
                </span>
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  {label.tracking_estimated_delivery
                    ? formatDateTime(label.tracking_estimated_delivery)
                    : "Not available from courier"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {tatMetrics.isDelayed && tatMetrics.delayedDays ? (
                    <span className="text-orange-600 font-semibold">
                      +{tatMetrics.delayedDays} days past target
                    </span>
                  ) : (
                    "Courier SLA Target"
                  )}
                </div>
              </div>
            </div>

            {/* Sub-row: Dispatched -> Delivered, Location, Status, Sync */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Customer Delivery Time:
                </span>
                <div className="font-semibold text-foreground mt-0.5">
                  {tatMetrics.dispatchedToDeliveredDisplay ||
                    (label.status === "Delivered" ? "Completed" : "In Progress")}
                </div>
                <div className="text-[10px] text-muted-foreground">Dispatched ➔ Delivered</div>
              </div>

              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Current Location:
                </span>
                <div
                  className="font-semibold text-foreground mt-0.5 truncate"
                  title={label.tracking_location || "Not available from courier"}
                >
                  {label.tracking_location || "Not available from courier"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Dest: {label.receiver_city}, {label.receiver_pincode}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Current Status:
                </span>
                <div className="font-semibold text-foreground mt-0.5">
                  {getOperationalStage(label)}
                </div>
                {label.raw_courier_status && (
                  <div
                    className="text-[10px] text-muted-foreground truncate"
                    title={label.raw_courier_status}
                  >
                    Raw: {label.raw_courier_status}
                  </div>
                )}
              </div>

              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Last Tracking Sync:
                </span>
                <div className="font-semibold text-foreground mt-0.5">
                  {formatRelativeTime(label.last_tracking_update)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {label.tracking_provider || getProviderDisplay(label)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. ROAD PROGRESSION VIEW: Origin -> Hubs -> Dest -> Deliv */}
          <div className="bg-muted/40 rounded-xl p-4 border">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
              <span>Road & Route Progression</span>
              <span className="text-foreground font-medium lowercase">
                {label.status === "Delivered"
                  ? "Journey Completed"
                  : label.status === "RTO"
                    ? "RTO Processed"
                    : "In Motion"}
              </span>
            </div>

            <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
              {/* Origin / Pickup */}
              <div className="flex-1 min-w-[120px] p-2.5 rounded-lg bg-background border">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary" /> Origin / Pickup
                </div>
                <div className="font-semibold text-foreground mt-1">
                  {label.origin_location || label.sender_address || "Origin Facility"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {label.pickup_at
                    ? formatDateTime(label.pickup_at)
                    : "Not available from courier"}
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center pt-4 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>

              {/* Transit Hubs */}
              <div className="flex-1 min-w-[140px] p-2.5 rounded-lg bg-background border">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3 text-blue-600" /> Transit Hubs
                </div>
                <div className="font-semibold text-foreground mt-1">
                  {intermediateLocations.length > 0 ? (
                    <div className="space-y-0.5">
                      {intermediateLocations.slice(0, 2).map((loc, idx) => (
                        <div key={idx} className="truncate" title={loc}>
                          • {loc}
                        </div>
                      ))}
                      {intermediateLocations.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{intermediateLocations.length - 2} more hubs
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground font-normal italic">
                      {label.status === "Pending"
                        ? "Not in transit yet"
                        : "Hub details not provided by courier"}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center pt-4 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>

              {/* Destination Hub */}
              <div className="flex-1 min-w-[130px] p-2.5 rounded-lg bg-background border">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-purple-600" /> Destination Hub
                </div>
                <div className="font-semibold text-foreground mt-1 truncate">
                  {label.destination_location || `${label.receiver_city}, ${label.receiver_state}`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Pincode: {label.receiver_pincode}
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center pt-4 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>

              {/* Delivery / RTO Final Outcome */}
              <div
                className={`flex-1 min-w-[130px] p-2.5 rounded-lg border ${
                  label.status === "Delivered"
                    ? "bg-emerald-50/70 border-emerald-200"
                    : label.status === "RTO"
                      ? "bg-rose-50/70 border-rose-200"
                      : "bg-background"
                }`}
              >
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  {label.status === "Delivered" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  ) : label.status === "RTO" ? (
                    <RotateCcw className="h-3 w-3 text-rose-600" />
                  ) : (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {label.status === "RTO" ? "RTO Result" : "Delivery"}
                </div>
                <div
                  className={`font-semibold mt-1 ${
                    label.status === "Delivered"
                      ? "text-emerald-900"
                      : label.status === "RTO"
                        ? "text-rose-900"
                        : "text-foreground"
                  }`}
                >
                  {label.status === "Delivered"
                    ? "Delivered Successfully"
                    : label.status === "RTO"
                      ? "Returned to Origin"
                      : outForDelivery
                        ? "Out for Delivery"
                        : "In Progress"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {label.delivered_at
                    ? formatDateTime(label.delivered_at)
                    : label.rto_returned_at
                      ? formatDateTime(label.rto_returned_at)
                      : label.tracking_estimated_delivery
                        ? `Est: ${label.tracking_estimated_delivery}`
                        : "Pending delivery event"}
                </div>
              </div>
            </div>
          </div>

          {/* 3. VERTICAL SHIPMENT JOURNEY TIMELINE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Full Vertical Shipment Journey
              </div>
              <span className="text-[11px] text-muted-foreground">
                {chronologicalCheckpoints.length} courier checkpoint events recorded
              </span>
            </div>

            <div className="relative border-l-2 border-border ml-3 pl-5 space-y-6">
              {/* Step 1: Dispatched / Created */}
              <div className="relative group">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-blue-600 border-2 border-background flex items-center justify-center text-white" />
                <div className="bg-background p-3 rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-blue-600" />
                      Shipment Created & Dispatched
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-800">
                      Dispatched
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Manifest created and shipping label generated.
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatDateTime(label.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {label.origin_location || label.sender_address || "Dispatch Origin Facility"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2: Courier Pickup */}
              <div className="relative group">
                <div
                  className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                    label.pickup_at ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                />
                <div className="bg-background p-3 rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      Courier Pickup
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        label.pickup_at
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {label.pickup_at ? "Picked Up" : "Awaiting Pickup Scan"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {label.pickup_at
                      ? "Parcel received and processed at courier origin facility."
                      : "Awaiting physical pickup confirmation scan from courier."}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {label.pickup_at
                        ? formatDateTime(label.pickup_at)
                        : "Not available from courier"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {label.origin_location || "Origin Facility"}
                    </span>
                    {label.raw_courier_status && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Raw: {label.raw_courier_status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3+: Chronological Courier Checkpoints */}
              {chronologicalCheckpoints.length > 0 &&
                chronologicalCheckpoints.map((cp, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 border-2 border-background" />
                    <div className="p-2.5 rounded-lg bg-background/80 border hover:bg-muted/20 transition">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="font-semibold text-foreground text-xs">
                          {cp.description || cp.status || "Checkpoint reached"}
                        </div>
                        {cp.raw_status && (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {cp.raw_status}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDateTime(cp.date)}
                        </span>
                        {cp.location && (
                          <span className="flex items-center gap-1 font-medium text-foreground/80">
                            • <MapPin className="h-2.5 w-2.5 inline" /> {cp.location}
                          </span>
                        )}
                        {cp.source && (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            [{cp.source}]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

              {/* Step 4: Out for Delivery (OFD) Milestone */}
              {(tatMetrics.outForDeliveryAt || outForDelivery) && (
                <div className="relative group">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-purple-600 border-2 border-background" />
                  <div className="bg-purple-50/50 border border-purple-200 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-purple-700" />
                        Out for Delivery (OFD)
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-purple-100 text-purple-900 border-purple-300"
                      >
                        Last Mile Dispatched
                      </Badge>
                    </div>
                    <div className="text-[11px] text-purple-900 mt-1">
                      Shipment is with the courier executive for physical delivery to consignee.
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-purple-900/80 mt-1.5 pt-1.5 border-t border-purple-200">
                      <span className="flex items-center gap-1 font-medium text-purple-950">
                        <Clock className="h-3 w-3 text-purple-700" />
                        {tatMetrics.outForDeliveryAt
                          ? formatDateTime(tatMetrics.outForDeliveryAt)
                          : outForDelivery && label.tracking_event_date
                            ? formatDateTime(label.tracking_event_date)
                            : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-purple-700" />
                        {label.destination_location ||
                          `${label.receiver_city}, ${label.receiver_state}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Delivery Attempted / NDR (if applicable) */}
              {(tatMetrics.firstAttemptAt ||
                label.is_delivery_failed ||
                getOperationalStage(label) === "Delivery Attempted") && (
                <div className="relative group">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-amber-600 border-2 border-background" />
                  <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                        Delivery Attempted / NDR Notice
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-100 text-amber-900 border-amber-300"
                      >
                        Attempt Logged
                      </Badge>
                    </div>
                    <div className="text-[11px] text-amber-900 mt-1">
                      {label.failure_reason ||
                        label.raw_courier_status ||
                        "Courier reported delivery attempt unfulfilled. Consignee unavailable or reschedule requested."}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-amber-900/80 mt-1.5 pt-1.5 border-t border-amber-200">
                      <span className="flex items-center gap-1 font-medium text-amber-950">
                        <Clock className="h-3 w-3 text-amber-700" />
                        {tatMetrics.firstAttemptAt
                          ? formatDateTime(tatMetrics.firstAttemptAt)
                          : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-amber-700" />
                        {label.destination_location ||
                          `${label.receiver_city}, ${label.receiver_state}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Final Outcome (Delivered OR RTO) */}
              {label.status === "Delivered" ? (
                <div className="relative group">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-600 border-2 border-background" />
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Delivered Successfully
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300"
                      >
                        Delivered
                      </Badge>
                    </div>
                    <div className="text-[11px] text-emerald-900 mt-1">
                      Package was verified and delivered to recipient.
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-900/80 mt-1.5 pt-1.5 border-t border-emerald-200">
                      <span className="flex items-center gap-1 font-medium text-emerald-950">
                        <Clock className="h-3 w-3 text-emerald-700" />
                        {label.delivered_at
                          ? formatDateTime(label.delivered_at)
                          : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-700" />
                        {label.destination_location ||
                          `${label.receiver_city}, ${label.receiver_state}`}
                      </span>
                      {tatMetrics.pickupToDeliveredDisplay && (
                        <span className="font-semibold text-emerald-950">
                          TAT: {tatMetrics.pickupToDeliveredDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : label.status === "RTO" || rtoReturned ? (
                <div className="relative group">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-rose-600 border-2 border-background" />
                  <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                        <RotateCcw className="h-4 w-4 text-rose-600" />
                        {rtoReturned ? "RTO Returned to Origin" : "RTO Initiated / In Motion"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-rose-100 text-rose-900 border-rose-300"
                      >
                        RTO
                      </Badge>
                    </div>
                    <div className="text-[11px] text-rose-900 mt-1">
                      {label.rto_reason
                        ? `RTO Reason: ${label.rto_reason}`
                        : "Parcel marked return to origin and processed back towards sender facility."}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-rose-900/80 mt-1.5 pt-1.5 border-t border-rose-200">
                      <span className="flex items-center gap-1 font-medium text-rose-950">
                        <Clock className="h-3 w-3 text-rose-700" />
                        {label.rto_returned_at
                          ? formatDateTime(label.rto_returned_at)
                          : label.rto_initiated_at
                            ? formatDateTime(label.rto_initiated_at)
                            : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-rose-700" />
                        {label.origin_location || "Origin Facility"}
                      </span>
                      {tatMetrics.pickupToRtoReturnedDisplay && (
                        <span className="font-semibold text-rose-950">
                          RTO TAT: {tatMetrics.pickupToRtoReturnedDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 border-2 border-background" />
                  <div className="p-3 rounded-lg bg-muted/20 border">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Delivery Pending
                      </span>
                      <span className="text-[10px] text-muted-foreground">In Transit</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {label.tracking_estimated_delivery
                        ? `Target Delivery Date: ${formatDateTime(label.tracking_estimated_delivery)}`
                        : "Estimated delivery date not provided by courier partner."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Specifications Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/20 rounded-lg border">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                Receiver:
              </span>
              <div className="font-semibold text-foreground mt-0.5">{label.receiver_name}</div>
              <div className="text-[11px] text-muted-foreground">{label.receiver_mobile_1}</div>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                Destination:
              </span>
              <div className="font-medium text-foreground mt-0.5">
                {label.receiver_city}, {label.receiver_state}
              </div>
              <div className="text-[11px] text-muted-foreground">{label.receiver_pincode}</div>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                Current Location:
              </span>
              <div className="font-medium text-foreground mt-0.5">
                {label.tracking_location || "Not available from courier"}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                Delivery TAT:
              </span>
              <div className="font-semibold text-foreground mt-0.5">
                {tatMetrics.pickupToDeliveredDisplay || label.tat_display || "Calculating..."}
              </div>
              {label.is_delayed && label.delayed_days ? (
                <div className="text-[10px] text-orange-600 font-semibold">
                  +{label.delayed_days} days delayed
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            Last synced: {formatRelativeTime(label.last_tracking_update)}
          </div>

          <div className="flex items-center gap-2">
            {trackingUrl && (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <a href={trackingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Courier Portal
                </a>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              className="text-xs"
              onClick={() => onRefresh(label.id)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing..." : "Refresh Tracking"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

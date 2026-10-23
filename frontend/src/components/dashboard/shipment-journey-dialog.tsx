import {
  ExternalLink,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Building2,
  AlertCircle,
  Timer,
  Activity,
  Package,
  Copy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getTrackingUrl,
  getOperationalStage,
  isLabelDelayed,
  isLabelOutOfDelivery,
  isLabelRtoReturned,
  getDetailedTatMetrics,
  formatDateTime,
  type Label,
} from "@/lib/labels";
import { operationalStageBadgeClasses } from "./shipment-table";

export interface ShipmentJourneyDialogProps {
  label: Label | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: (id: string) => void;
  refreshing: boolean;
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

function getProviderDisplay(label: Label): string {
  if (label.tracking_provider) return label.tracking_provider;
  if (label.tracking_source === "direct") return `${label.courier_name} Direct`;
  if (label.tracking_source?.startsWith("trackcourier")) return "TrackCourier.io";
  return "";
}

export function ShipmentJourneyDialog({
  label,
  open,
  onOpenChange,
  onRefresh,
  refreshing,
}: ShipmentJourneyDialogProps) {
  if (!label) return null;

  const trackingUrl = getTrackingUrl(label.courier_name, label.tracking_id);
  const stage = getOperationalStage(label);
  const outForDelivery = isLabelOutOfDelivery(label);
  const rtoReturned = isLabelRtoReturned(label);
  const tatMetrics = getDetailedTatMetrics(label);

  const checkpoints = label.tracking_history || [];
  const intermediateLocations = Array.from(
    new Set(
      checkpoints
        .map((c) => c.location)
        .filter((loc): loc is string => Boolean(loc && loc.trim().length > 0)),
    ),
  );

  // Sort checkpoints chronologically ascending (oldest to newest)
  const chronologicalCheckpoints = [...checkpoints].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return ta - tb;
  });

  const copyToClipboard = (text: string, title = "AWB") => {
    navigator.clipboard.writeText(text);
    toast.success(`${title} copied to clipboard`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border">
        {/* Dialog Header */}
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg font-bold text-foreground">
                  Shipment Journey & TAT Analysis
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={`${operationalStageBadgeClasses[stage]} text-xs px-2.5 py-0.5 font-medium`}
                >
                  {stage}
                </Badge>
                {stage !== label.status && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    (Core: {label.status})
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 font-semibold ${
                    tatMetrics.isDelayed
                      ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700"
                      : label.status === "Delivered"
                        ? "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700"
                        : "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700"
                  }`}
                >
                  {tatMetrics.performanceLabel}
                </Badge>
              </div>
              <DialogDescription className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>AWB:</span>
                <span className="font-mono font-bold text-foreground">{label.tracking_id}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(label.tracking_id, "AWB")}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  title="Copy AWB"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <span>• Partner:</span>
                <span className="font-medium text-foreground">{label.courier_name}</span>
                {getProviderDisplay(label) && (
                  <span className="text-muted-foreground"> (via {getProviderDisplay(label)})</span>
                )}
              </DialogDescription>
            </div>

            {(tatMetrics.pickupToDeliveredDisplay || (label.pickup_at ? label.tat_display : null)) && (
              <Badge variant="secondary" className="text-xs px-2.5 py-1 font-bold gap-1">
                <Timer className="h-3.5 w-3.5 text-primary shrink-0" />
                TAT: {tatMetrics.pickupToDeliveredDisplay || (label.pickup_at ? label.tat_display : null)}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status conflict or alert notice banner */}
          {label.api_status_conflict ? (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Delivery Protection Active: </span>
                <span>
                  Courier API returned status conflict, but verified Delivered status is safely
                  preserved.
                </span>
              </div>
            </div>
          ) : label.last_tracking_error ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Courier Sync Notice: </span>
                <span>{label.last_tracking_error}</span>
              </div>
            </div>
          ) : null}

          {/* 1. TOP SUMMARY CARD */}
          <div className="bg-muted/40 rounded-xl p-4 border border-border/70 space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-primary" /> Delivery Time & Turnaround (TAT) Summary
              </div>
              <span className="text-[11px] font-medium text-foreground">
                {label.status === "Delivered"
                  ? "Delivered to Consignee"
                  : label.status === "RTO"
                    ? "RTO Processed"
                    : "In Active Transit"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Metric 1: Delivery TAT */}
              <div className="p-3 bg-card rounded-lg border border-border/60">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                  Delivery TAT (Pickup → Deliv)
                </span>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {tatMetrics.pickupToDeliveredDisplay ||
                    (label.status === "Delivered"
                      ? (label.pickup_at ? label.tat_display : null) || "Not available from courier"
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
              <div className="p-3 bg-card rounded-lg border border-border/60">
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
              <div className="p-3 bg-card rounded-lg border border-border/60">
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
              <div className="p-3 bg-card rounded-lg border border-border/60">
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
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      +{tatMetrics.delayedDays} days past target
                    </span>
                  ) : (
                    "Courier SLA Target"
                  )}
                </div>
              </div>
            </div>

            {/* Sub-row: Dispatched -> Delivered, Location, Status, Sync */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-border/50">
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
                <div className="font-semibold text-foreground mt-0.5">{stage}</div>
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

          {/* 2. ROAD PROGRESSION VIEW */}
          <div className="bg-muted/40 rounded-xl p-4 border border-border/70">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Origin / Pickup */}
              <div className="p-3 rounded-lg bg-card border border-border/60">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Origin / Pickup
                </div>
                <div className="font-semibold text-foreground mt-1.5 truncate">
                  {label.origin_location || label.sender_address || "Origin Facility"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {label.pickup_at ? formatDateTime(label.pickup_at) : "Awaiting pickup scan"}
                </div>
              </div>

              {/* Transit Hubs */}
              <div className="p-3 rounded-lg bg-card border border-border/60">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Transit Hubs
                </div>
                <div className="font-semibold text-foreground mt-1.5">
                  {intermediateLocations.length > 0 ? (
                    <div className="space-y-0.5">
                      {intermediateLocations.slice(0, 2).map((loc, idx) => (
                        <div key={idx} className="truncate text-[11px]" title={loc}>
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
                    <span className="text-muted-foreground font-normal italic text-[11px]">
                      {label.status === "Pending"
                        ? "Not in transit yet"
                        : "Hub details not provided by courier"}
                    </span>
                  )}
                </div>
              </div>

              {/* Destination Hub */}
              <div className="p-3 rounded-lg bg-card border border-border/60">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /> Destination Hub
                </div>
                <div className="font-semibold text-foreground mt-1.5 truncate">
                  {label.destination_location || `${label.receiver_city}, ${label.receiver_state}`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Pincode: {label.receiver_pincode}
                </div>
              </div>

              {/* Outcome */}
              <div
                className={`p-3 rounded-lg border ${
                  label.status === "Delivered"
                    ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                    : label.status === "RTO"
                      ? "bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                      : "bg-card border-border/60"
                }`}
              >
                <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                  {label.status === "Delivered" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : label.status === "RTO" ? (
                    <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {label.status === "RTO" ? "RTO Result" : "Delivery Outcome"}
                </div>
                <div
                  className={`font-semibold mt-1.5 ${
                    label.status === "Delivered"
                      ? "text-emerald-900 dark:text-emerald-300"
                      : label.status === "RTO"
                        ? "text-rose-900 dark:text-rose-300"
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

          {/* 3. VERTICAL TIMELINE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Full Vertical Shipment Journey
              </div>
              <span className="text-[11px] text-muted-foreground">
                {chronologicalCheckpoints.length} courier checkpoint events recorded
              </span>
            </div>

            <div className="relative border-l-2 border-border ml-3 pl-5 space-y-5">
              {/* Step 1: Dispatched */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-blue-600 border-2 border-background flex items-center justify-center" />
                <div className="bg-card p-3 rounded-lg border border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Shipment Created & Dispatched
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Dispatched
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Manifest created and shipping label generated.
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      {formatDateTime(label.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground/70" />
                      {label.origin_location || label.sender_address || "Dispatch Origin Facility"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2: Courier Pickup */}
              <div className="relative">
                <div
                  className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                    label.pickup_at ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                />
                <div className="bg-card p-3 rounded-lg border border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      Courier Pickup
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        label.pickup_at
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
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
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      {label.pickup_at ? formatDateTime(label.pickup_at) : "Not available from courier"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground/70" />
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

              {/* Step 3: Chronological Checkpoints */}
              {chronologicalCheckpoints.length > 0 &&
                chronologicalCheckpoints.map((cp, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 border-2 border-background" />
                    <div className="p-2.5 rounded-lg bg-card border border-border/70 hover:bg-muted/20 transition">
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
                          <Clock className="h-2.5 w-2.5 text-muted-foreground/70" />
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

              {/* Step 4: Out for Delivery */}
              {(tatMetrics.outForDeliveryAt || outForDelivery) && (
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-purple-600 border-2 border-background" />
                  <div className="bg-purple-50/50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-purple-950 dark:text-purple-300 flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-purple-700 dark:text-purple-400" />
                        Out for Delivery (OFD)
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                      >
                        Last Mile Dispatched
                      </Badge>
                    </div>
                    <div className="text-[11px] text-purple-900 dark:text-purple-300 mt-1">
                      Shipment is with courier delivery personnel for physical delivery.
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-purple-900/80 dark:text-purple-400 mt-1.5 pt-1.5 border-t border-purple-200 dark:border-purple-800">
                      <span className="flex items-center gap-1 font-medium text-purple-950 dark:text-purple-200">
                        <Clock className="h-3 w-3 text-purple-700 dark:text-purple-400" />
                        {tatMetrics.outForDeliveryAt
                          ? formatDateTime(tatMetrics.outForDeliveryAt)
                          : outForDelivery && label.tracking_event_date
                            ? formatDateTime(label.tracking_event_date)
                            : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-purple-700 dark:text-purple-400" />
                        {label.destination_location ||
                          `${label.receiver_city}, ${label.receiver_state}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Delivery Attempted / NDR */}
              {(tatMetrics.firstAttemptAt ||
                label.is_delivery_failed ||
                stage === "Delivery Attempted") && (
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-amber-600 border-2 border-background" />
                  <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                        Delivery Attempted / NDR Notice
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                      >
                        Attempt Logged
                      </Badge>
                    </div>
                    <div className="text-[11px] text-amber-900 dark:text-amber-300 mt-1">
                      {label.failure_reason ||
                        label.raw_courier_status ||
                        "Delivery attempt unfulfilled. Consignee unavailable or reschedule requested."}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-amber-900/80 dark:text-amber-400 mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-800">
                      <span className="flex items-center gap-1 font-medium text-amber-950 dark:text-amber-200">
                        <Clock className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                        {tatMetrics.firstAttemptAt
                          ? formatDateTime(tatMetrics.firstAttemptAt)
                          : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                        {label.destination_location ||
                          `${label.receiver_city}, ${label.receiver_state}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Outcome */}
              {label.status === "Delivered" ? (
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-600 border-2 border-background" />
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Delivered Successfully
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        Delivered
                      </Badge>
                    </div>
                    <div className="text-[11px] text-emerald-900 dark:text-emerald-300 mt-1">
                      Package was verified and delivered to recipient.
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-900/80 dark:text-emerald-400 mt-1.5 pt-1.5 border-t border-emerald-200 dark:border-emerald-800">
                      <span className="flex items-center gap-1 font-medium text-emerald-950 dark:text-emerald-200">
                        <Clock className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                        {label.delivered_at
                          ? formatDateTime(label.delivered_at)
                          : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                        {label.destination_location ||
                          `${label.receiver_city}, ${label.receiver_state}`}
                      </span>
                      {tatMetrics.pickupToDeliveredDisplay && (
                        <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                          TAT: {tatMetrics.pickupToDeliveredDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : label.status === "RTO" || rtoReturned ? (
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-rose-600 border-2 border-background" />
                  <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-xs text-rose-950 dark:text-rose-300 flex items-center gap-1.5">
                        <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        {rtoReturned ? "RTO Returned to Origin" : "RTO Initiated / In Motion"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                      >
                        RTO
                      </Badge>
                    </div>
                    <div className="text-[11px] text-rose-900 dark:text-rose-300 mt-1">
                      {label.rto_reason
                        ? `RTO Reason: ${label.rto_reason}`
                        : "Parcel marked return to origin and processed back towards sender facility."}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-rose-900/80 dark:text-rose-400 mt-1.5 pt-1.5 border-t border-rose-200 dark:border-rose-800">
                      <span className="flex items-center gap-1 font-medium text-rose-950 dark:text-rose-200">
                        <Clock className="h-3 w-3 text-rose-700 dark:text-rose-400" />
                        {label.rto_returned_at
                          ? formatDateTime(label.rto_returned_at)
                          : label.rto_initiated_at
                            ? formatDateTime(label.rto_initiated_at)
                            : "Not available from courier"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-rose-700 dark:text-rose-400" />
                        {label.origin_location || "Origin Facility"}
                      </span>
                      {tatMetrics.pickupToRtoReturnedDisplay && (
                        <span className="font-semibold text-rose-950 dark:text-rose-200">
                          RTO TAT: {tatMetrics.pickupToRtoReturnedDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60 border-2 border-background" />
                  <div className="p-3 rounded-lg bg-card border border-border/70">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Delivery Pending
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">In Transit</span>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/20 rounded-lg border border-border/60">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">Receiver:</span>
              <div className="font-semibold text-foreground mt-0.5">{label.receiver_name}</div>
              <div className="text-[11px] text-muted-foreground">{label.receiver_mobile_1}</div>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">Destination:</span>
              <div className="font-medium text-foreground mt-0.5">
                {label.receiver_city}, {label.receiver_state}
              </div>
              <div className="text-[11px] text-muted-foreground">{label.receiver_pincode}</div>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">Current Location:</span>
              <div className="font-medium text-foreground mt-0.5 truncate" title={label.tracking_location || "Not available from courier"}>
                {label.tracking_location || "Not available from courier"}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">Delivery TAT:</span>
              <div className="font-semibold text-foreground mt-0.5">
                {tatMetrics.pickupToDeliveredDisplay || label.tat_display || "Calculating..."}
              </div>
              {label.is_delayed && label.delayed_days ? (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  +{label.delayed_days} days delayed
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2">
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
              className="text-xs gap-1.5"
              onClick={() => onRefresh(label.id)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing..." : "Refresh Tracking"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

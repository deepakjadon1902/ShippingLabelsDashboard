import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Eye,
  RefreshCw,
  Pencil,
  Printer,
  Trash2,
  Phone,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "./table-skeleton";
import { TableEmptyState } from "./table-empty-state";
import {
  getTrackingUrl,
  getOperationalStage,
  isLabelDelayed,
  formatDateTime,
  formatCompactDuration,
  STATUSES,
  type Label,
  type LabelStatus,
  type OperationalStage,
} from "@/lib/labels";

export interface ShipmentTableProps {
  labels: Label[];
  isLoading: boolean;
  onOpenJourney: (id: string) => void;
  onRefresh: (id: string) => void;
  onStatusChange: (id: string, status: LabelStatus) => void;
  onDelete: (id: string) => void;
  refreshingId: string | null;
  onClearFilters?: () => void;
  isFiltered?: boolean;
}

export const operationalStageBadgeClasses: Record<OperationalStage, string> = {
  Delivered:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  "Out for Delivery":
    "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  "Delivery Attempted":
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "Failed / NDR":
    "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  "RTO Returned":
    "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700 font-semibold",
  "RTO Initiated":
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700",
  RTO: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  "In Transit":
    "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  Pending:
    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
};

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

export function ShipmentTable({
  labels,
  isLoading,
  onOpenJourney,
  onRefresh,
  onStatusChange,
  onDelete,
  refreshingId,
  onClearFilters,
  isFiltered,
}: ShipmentTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(labels.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedLabels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return labels.slice(start, start + pageSize);
  }, [labels, currentPage, pageSize]);

  const copyToClipboard = (text: string, labelText = "AWB") => {
    navigator.clipboard.writeText(text);
    toast.success(`${labelText} copied to clipboard`);
  };

  if (isLoading) {
    return <TableSkeleton rowCount={6} />;
  }

  if (labels.length === 0) {
    return <TableEmptyState isFiltered={isFiltered} onClearFilters={onClearFilters} />;
  }

  return (
    <div className="space-y-3">
      {/* Table Container */}
      <div
        className="table-wrapper rounded-lg border border-border/70 bg-card overflow-hidden"
        tabIndex={0}
        role="region"
        aria-label="Shipments management table"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
              <TableHead className="min-w-[190px] py-3">Customer & Destination</TableHead>
              <TableHead className="min-w-[160px] py-3">AWB & Courier</TableHead>
              <TableHead className="min-w-[140px] py-3">Status & Flags</TableHead>
              <TableHead className="min-w-[160px] py-3">Current Location</TableHead>
              <TableHead className="min-w-[190px] py-3">Latest Activity</TableHead>
              <TableHead className="min-w-[140px] py-3">Delivery Timeline</TableHead>
              <TableHead className="min-w-[90px] py-3">TAT</TableHead>
              <TableHead className="min-w-[110px] py-3">Last Sync</TableHead>
              <TableHead className="text-right min-w-[150px] py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLabels.map((label) => {
              const stage = getOperationalStage(label);
              const delayed = isLabelDelayed(label);
              const trackingUrl = getTrackingUrl(label.courier_name, label.tracking_id);
              const isRefreshing = refreshingId === label.id;

              return (
                <TableRow
                  key={label.id}
                  className="text-xs hover:bg-muted/30 transition-colors border-b border-border/40"
                >
                  {/* 1. Customer & Destination */}
                  <TableCell className="py-3">
                    <div className="font-semibold text-foreground text-xs">{label.receiver_name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                      <span>{label.receiver_mobile_1}</span>
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
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5 font-mono font-semibold text-xs text-foreground">
                      <span className="tracking-tight">{label.tracking_id}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(label.tracking_id, "AWB")}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        title="Copy AWB number"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {trackingUrl && (
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors p-0.5"
                          title="Open official courier tracking"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Truck className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                      <span className="font-medium">{label.courier_name}</span>
                    </div>
                    {getProviderDisplay(label) && (
                      <div className="text-[9px] text-muted-foreground uppercase mt-0.5 font-medium tracking-wider">
                        via {getProviderDisplay(label)}
                      </div>
                    )}
                  </TableCell>

                  {/* 3. Status & Flags */}
                  <TableCell className="py-3">
                    <button
                      type="button"
                      onClick={() => onOpenJourney(label.id)}
                      className="text-left flex flex-col items-start gap-1 group focus:outline-none"
                      title="Inspect full timeline & road progression"
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant="outline"
                          className={`${operationalStageBadgeClasses[stage]} cursor-pointer transition group-hover:ring-1 group-hover:ring-primary/40 text-[11px] px-2 py-0.5 font-medium`}
                        >
                          {stage}
                        </Badge>

                        {delayed && (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700 text-[10px] px-1.5 py-0 font-medium"
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
                  <TableCell className="py-3">
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
                  <TableCell className="py-3">
                    <div
                      className="font-medium text-foreground text-xs truncate max-w-[200px]"
                      title={label.tracking_event_description || label.raw_courier_status || ""}
                    >
                      {label.tracking_event_description ||
                        label.raw_courier_status ||
                        "Awaiting courier update"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/70" />
                      <span>{formatDateTime(label.tracking_event_date)}</span>
                    </div>
                  </TableCell>

                  {/* 6. Delivery Timeline */}
                  <TableCell className="py-3">
                    {label.delivered_at ? (
                      <div>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" /> Delivered
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
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                            +{label.delayed_days}d past SLA
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Not specified</span>
                    )}
                  </TableCell>

                  {/* 7. TAT */}
                  <TableCell className="py-2.5 px-3">
                    {label.tat_hours != null && !isNaN(label.tat_hours) ? (
                      <span className="font-mono font-bold text-foreground bg-muted/80 px-1.5 py-0.5 rounded text-[11px]">
                        {formatCompactDuration(label.tat_hours * 3600 * 1000)}
                      </span>
                    ) : label.tat_display ? (
                      <span className="font-medium text-foreground bg-muted/80 px-1.5 py-0.5 rounded text-[11px]">
                        {label.tat_display}
                      </span>
                    ) : label.pickup_at && label.status !== "Delivered" ? (
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                        In Transit
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* 8. Last Sync */}
                  <TableCell className="py-2.5 px-3">
                    <div>
                      <span className="text-muted-foreground text-[11px] font-medium font-tabular">
                        {formatRelativeTime(label.last_tracking_update)}
                      </span>
                      {label.api_status_conflict && (
                        <div
                          className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5 mt-0.5"
                          title={label.api_status_conflict}
                        >
                          <ShieldCheck className="h-2.5 w-2.5" /> Conflict safe
                        </div>
                      )}
                      {label.last_tracking_error &&
                        !label.api_status_conflict &&
                        label.status !== "Delivered" && (
                          <div
                            className="text-[9px] text-rose-600 dark:text-rose-400 truncate max-w-[110px] mt-0.5"
                            title={label.last_tracking_error}
                          >
                            {label.last_tracking_error.includes("429")
                              ? "Rate limited"
                              : "Sync notice"}
                          </div>
                        )}
                    </div>
                  </TableCell>

                  {/* 9. Actions */}
                  <TableCell className="text-right py-2.5 px-3">
                    <div className="flex justify-end items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Inspect full road journey and checkpoints"
                        onClick={() => onOpenJourney(label.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Refresh real-time tracking"
                        onClick={() => onRefresh(label.id)}
                        disabled={isRefreshing}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
                        />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
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

                      <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit">
                        <Link to="/edit/$id" params={{ id: label.id }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Print label"
                      >
                        <Link to="/print" search={{ ids: label.id }}>
                          <Printer className="h-3.5 w-3.5" />
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
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

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2 text-xs text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-semibold text-foreground font-tabular">
            {(currentPage - 1) * pageSize + 1}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-foreground font-tabular">
            {Math.min(currentPage * pageSize, labels.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground font-tabular">{labels.length}</span> shipments
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              title="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium font-tabular text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

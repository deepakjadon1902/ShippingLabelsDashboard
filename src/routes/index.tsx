import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  Search,
  Pencil,
  Trash2,
  Printer,
  PlusCircle,
  RefreshCw,
} from "lucide-react";

import { refreshLabelTracking, refreshAllTracking } from "@/lib/tracking.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  listLabels,
  deleteLabel,
  updateLabel,
  STATUSES,
  type Label,
  type LabelStatus,
} from "@/lib/labels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Shipping Labels" },
      { name: "description", content: "All your shipping labels in one place. Search, filter and manage every parcel." },
      { property: "og:title", content: "Dashboard — Shipping Labels" },
      { property: "og:description", content: "All your shipping labels in one place." },
    ],
  }),
  component: Dashboard,
});

const statusColor: Record<LabelStatus, string> = {
  Pending: "bg-amber-100 text-amber-900 border-amber-200",
  Shipped: "bg-blue-100 text-blue-900 border-blue-200",
  Delivered: "bg-green-100 text-green-900 border-green-200",
  RTO: "bg-red-100 text-red-900 border-red-200",
};

function Dashboard() {
  const qc = useQueryClient();
  const refreshOneFn = useServerFn(refreshLabelTracking);
  const refreshAllFn = useServerFn(refreshAllTracking);
  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["labels"],
    queryFn: listLabels,
  });

  const [search, setSearch] = useState("");
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const couriers = useMemo(
    () => Array.from(new Set(labels.map((l) => l.courier_name))).sort(),
    [labels],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return labels.filter((l) => {
      if (courierFilter !== "all" && l.courier_name !== courierFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!s) return true;
      return (
        l.receiver_name.toLowerCase().includes(s) ||
        l.tracking_id.toLowerCase().includes(s) ||
        (l.order_reference ?? "").toLowerCase().includes(s)
      );
    });
  }, [labels, search, courierFilter, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<LabelStatus, number> = { Pending: 0, Shipped: 0, Delivered: 0, RTO: 0 };
    for (const l of labels) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [labels]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LabelStatus }) =>
      updateLabel(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Label deleted");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshOneMutation = useMutation({
    mutationFn: (id: string) => refreshOneFn({ data: { id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      if (r.skipped) toast.info(r.reason ?? "Skipped");
      else if (r.error) toast.warning(`Last check failed: ${r.error}`);
      else toast.success(`Updated: ${r.rawStatus ?? "no change"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshAllMutation = useMutation({
    mutationFn: () => refreshAllFn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success(
        `Refreshed ${r.processed} labels — ${r.updated} status updates, ${r.failed} failed, ${r.skipped} skipped`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total" value={labels.length} icon={<Package className="h-4 w-4" />} accent />
        <SummaryCard label="Pending" value={counts.Pending} icon={<Package className="h-4 w-4 text-amber-600" />} />
        <SummaryCard label="Shipped" value={counts.Shipped} icon={<Truck className="h-4 w-4 text-blue-600" />} />
        <SummaryCard label="Delivered" value={counts.Delivered} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} />
        <SummaryCard label="RTO" value={counts.RTO} icon={<RotateCcw className="h-4 w-4 text-red-600" />} />
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div>
            <CardTitle>All labels</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshAllMutation.mutate()}
              disabled={refreshAllMutation.isPending}
              title="Fetch latest tracking status for all non-final labels"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshAllMutation.isPending ? "animate-spin" : ""}`} />
              {refreshAllMutation.isPending ? "Refreshing…" : "Refresh all"}
            </Button>
            <Button asChild size="sm">
              <Link to="/create">
                <PlusCircle className="h-4 w-4 mr-1" /> New label
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/print">
                <Printer className="h-4 w-4 mr-1" /> Print
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name, tracking ID, order ref…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All couriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All couriers</SelectItem>
                {couriers.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last update</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No labels found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <LabelRow
                      key={l.id}
                      label={l}
                      onStatusChange={(status) => statusMutation.mutate({ id: l.id, status })}
                      onDelete={() => setDeleteId(l.id)}
                      onRefresh={() => refreshOneMutation.mutate(l.id)}
                      refreshing={refreshOneMutation.isPending && refreshOneMutation.variables === l.id}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this label?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "bg-primary text-primary-foreground" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={"text-sm " + (accent ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {label}
          </div>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function LabelRow({
  label,
  onStatusChange,
  onDelete,
  onRefresh,
  refreshing,
}: {
  label: Label;
  onStatusChange: (s: LabelStatus) => void;
  onDelete: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const isManualOnly = label.courier_name === "Shree Maruti Courier";
  const lastUpdate = label.last_tracking_update
    ? new Date(label.last_tracking_update)
    : null;
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{label.receiver_name}</div>
        <div className="text-xs text-muted-foreground">
          {label.receiver_city}, {label.receiver_state} • {label.receiver_pincode}
        </div>
      </TableCell>
      <TableCell>{label.courier_name}</TableCell>
      <TableCell className="font-mono text-xs">{label.tracking_id}</TableCell>
      <TableCell>
        <Badge variant="outline" className={statusColor[label.status]}>
          {label.status}
        </Badge>
        {label.raw_courier_status ? (
          <div className="text-[10px] text-muted-foreground mt-1 max-w-[180px] truncate" title={label.raw_courier_status}>
            {label.raw_courier_status}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {isManualOnly ? (
          <span className="text-muted-foreground italic">Manual only</span>
        ) : lastUpdate ? (
          <div>
            <div className="text-muted-foreground">
              {lastUpdate.toLocaleDateString()} {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            {label.last_tracking_error ? (
              <div className="text-[10px] text-red-600 max-w-[160px] truncate" title={label.last_tracking_error}>
                Last check failed
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">Never</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(label.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {!isManualOnly && (
            <Button
              variant="ghost"
              size="icon"
              title="Refresh tracking"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUSES.map((s) => (
                <DropdownMenuItem key={s} onClick={() => onStatusChange(s)}>
                  Mark as {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="ghost" size="icon" title="Edit">
            <Link to="/edit/$id" params={{ id: label.id }}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" title="Reprint">
            <Link to="/print" search={{ ids: label.id }}>
              <Printer className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" title="Delete" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

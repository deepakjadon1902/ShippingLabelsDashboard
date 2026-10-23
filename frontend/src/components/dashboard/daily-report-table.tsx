import { useState, useMemo } from "react";
import { Download, Calendar, Truck, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getLocalDateKey,
  formatDateTime,
  getOperationalStage,
  type Label,
} from "@/lib/labels";

export interface DailyReportTableProps {
  labels: Label[];
}

export function DailyReportTable({ labels }: DailyReportTableProps) {
  const [reportDate, setReportDate] = useState(() => getLocalDateKey(new Date()));

  // Filter shipments active on selected local calendar date
  const dailyData = useMemo(() => {
    const target = reportDate;
    const dayLabels = labels.filter((l) => {
      const cDate = l.created_at ? getLocalDateKey(l.created_at) : "";
      const dDate = l.delivered_at
        ? getLocalDateKey(l.delivered_at)
        : l.status === "Delivered" && l.last_tracking_update
          ? getLocalDateKey(l.last_tracking_update)
          : "";
      const eDate = l.tracking_event_date ? getLocalDateKey(l.tracking_event_date) : "";
      return cDate === target || dDate === target || eDate === target;
    });

    const courierBreakdown: Record<
      string,
      { manifested: number; delivered: number; failed: number; rto: number }
    > = {};

    let manifestedCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    let rtoCount = 0;

    for (const l of dayLabels) {
      const c = l.courier_name || "Unknown";
      if (!courierBreakdown[c]) {
        courierBreakdown[c] = { manifested: 0, delivered: 0, failed: 0, rto: 0 };
      }
      const cb = courierBreakdown[c];

      const cDate = l.created_at ? getLocalDateKey(l.created_at) : "";
      const dDate = l.delivered_at ? getLocalDateKey(l.delivered_at) : "";

      if (cDate === target) {
        manifestedCount++;
        cb.manifested++;
      }
      if (dDate === target || (l.status === "Delivered" && getLocalDateKey(l.last_tracking_update) === target)) {
        deliveredCount++;
        cb.delivered++;
      }
      if (l.is_delivery_failed) {
        failedCount++;
        cb.failed++;
      }
      if (l.status === "RTO" || (l.rto_returned_at && getLocalDateKey(l.rto_returned_at) === target)) {
        rtoCount++;
        cb.rto++;
      }
    }

    return {
      date: target,
      labels: dayLabels,
      manifestedCount,
      deliveredCount,
      failedCount,
      rtoCount,
      courierBreakdown,
    };
  }, [labels, reportDate]);

  const handleExportCsv = () => {
    const headers = [
      "AWB / Tracking Number",
      "Courier",
      "Operational Stage",
      "Core Status",
      "Receiver Name",
      "Phone",
      "City",
      "State",
      "Pincode",
      "Order Reference",
      "Dispatched Date",
      "Delivered Date",
      "Current Location",
      "Turnaround Time (TAT)",
      "Tracking Provider",
    ];

    const rows = dailyData.labels.map((l) => [
      `"${l.tracking_id}"`,
      `"${l.courier_name}"`,
      `"${getOperationalStage(l)}"`,
      `"${l.status}"`,
      `"${l.receiver_name.replace(/"/g, '""')}"`,
      `"${l.receiver_mobile_1}"`,
      `"${l.receiver_city.replace(/"/g, '""')}"`,
      `"${l.receiver_state.replace(/"/g, '""')}"`,
      `"${l.receiver_pincode}"`,
      `"${(l.order_reference || "").replace(/"/g, '""')}"`,
      `"${l.created_at ? formatDateTime(l.created_at) : ""}"`,
      `"${l.delivered_at ? formatDateTime(l.delivered_at) : ""}"`,
      `"${(l.tracking_location || "").replace(/"/g, '""')}"`,
      `"${l.tat_display || ""}"`,
      `"${l.tracking_provider || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `shipping_report_${dailyData.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Date Picker & Export Bar */}
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Operational Date Report</div>
              <div className="text-xs text-muted-foreground">
                Audited metrics and consignment movements on selected local calendar day.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="text-xs h-9 w-[160px]"
            />
            <Button
              onClick={handleExportCsv}
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 shrink-0"
              disabled={dailyData.labels.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Manifested on Date
            </span>
            <div className="text-2xl font-bold font-tabular text-foreground mt-1">
              {dailyData.manifestedCount}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Delivered on Date
            </span>
            <div className="text-2xl font-bold font-tabular text-emerald-600 dark:text-emerald-400 mt-1">
              {dailyData.deliveredCount}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Failed / NDR on Date
            </span>
            <div className="text-2xl font-bold font-tabular text-amber-600 dark:text-amber-400 mt-1">
              {dailyData.failedCount}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              RTO Actions on Date
            </span>
            <div className="text-2xl font-bold font-tabular text-rose-600 dark:text-rose-400 mt-1">
              {dailyData.rtoCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Courier Breakdown Table */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-sm font-bold text-foreground">
            Daily Breakdown by Courier Partner ({dailyData.date})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-wrapper rounded-b-lg overflow-x-auto" tabIndex={0} role="region" aria-label="Daily courier breakdown table">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <TableHead className="py-3">Courier Partner</TableHead>
                  <TableHead className="py-3">Manifested</TableHead>
                  <TableHead className="py-3">Delivered</TableHead>
                  <TableHead className="py-3">Delivery Attempts</TableHead>
                  <TableHead className="py-3">RTO</TableHead>
                  <TableHead className="py-3">Success Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(dailyData.courierBreakdown).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      No courier activity on {dailyData.date}.
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(dailyData.courierBreakdown).map(([courier, stats]) => {
                    const resolved = stats.delivered + stats.failed + stats.rto;
                    const successRate = resolved > 0 ? Math.round((stats.delivered / resolved) * 100) : 0;
                    return (
                      <TableRow key={courier} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground py-3 flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary shrink-0" />
                          {courier}
                        </TableCell>
                        <TableCell className="font-semibold font-tabular py-3">{stats.manifested}</TableCell>
                        <TableCell className="text-emerald-700 dark:text-emerald-400 font-semibold font-tabular py-3">
                          {stats.delivered}
                        </TableCell>
                        <TableCell className="font-tabular py-3">{stats.failed}</TableCell>
                        <TableCell className="text-rose-600 dark:text-rose-400 font-tabular py-3">{stats.rto}</TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-xs font-semibold">
                            {resolved > 0 ? `${successRate}%` : "Pending"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
} from "recharts";
import { Truck, CheckCircle2, RotateCcw, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatDuration,
  isLabelDelayed,
  isLabelRtoReturned,
  getLocalDateKey,
  type Label,
} from "@/lib/labels";

export interface AnalyticsChartsProps {
  labels: Label[];
}

export function AnalyticsCharts({ labels }: AnalyticsChartsProps) {
  // 1. 7-Day Volume Trends computed using LOCAL timezone date keys
  const trendData = useMemo(() => {
    const daysMap: Record<string, { date: string; displayDate: string; created: number; delivered: number }> = {};
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = getLocalDateKey(d);
      const displayDate = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      daysMap[key] = { date: key, displayDate, created: 0, delivered: 0 };
    }

    for (const l of labels) {
      if (l.created_at) {
        const cKey = getLocalDateKey(l.created_at);
        if (daysMap[cKey]) daysMap[cKey].created++;
      }
      const dDate = l.delivered_at || (l.status === "Delivered" ? l.last_tracking_update : null);
      if (dDate) {
        const dKey = getLocalDateKey(dDate);
        if (daysMap[dKey]) daysMap[dKey].delivered++;
      }
    }

    return Object.values(daysMap);
  }, [labels]);

  // 2. Courier Performance Matrix
  const courierMatrix = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        delivered: number;
        rto: number;
        delayed: number;
        allTatMs: number[];
      }
    > = {};

    for (const l of labels) {
      const c = l.courier_name || "Unknown";
      if (!map[c]) {
        map[c] = {
          total: 0,
          delivered: 0,
          rto: 0,
          delayed: 0,
          allTatMs: [],
        };
      }
      const item = map[c];
      item.total++;
      if (l.status === "Delivered") item.delivered++;
      if (l.status === "RTO" || isLabelRtoReturned(l)) item.rto++;
      if (isLabelDelayed(l)) item.delayed++;

      if (l.status === "Delivered") {
        const pickupMs = l.pickup_at ? new Date(l.pickup_at).getTime() : null;
        const createdMs = l.created_at ? new Date(l.created_at).getTime() : null;
        const deliveredMs = l.delivered_at ? new Date(l.delivered_at).getTime() : null;
        const start = pickupMs || createdMs;
        if (start && deliveredMs && deliveredMs >= start) {
          item.allTatMs.push(deliveredMs - start);
        }
      }
    }

    return Object.entries(map).map(([courier, stats]) => {
      const rate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
      const sampleSize = stats.allTatMs.length;
      const avgTatMs = sampleSize > 0 ? Math.round(stats.allTatMs.reduce((a, b) => a + b, 0) / sampleSize) : null;
      return {
        courier,
        ...stats,
        rate,
        sampleSize,
        avgTatDisplay: formatDuration(avgTatMs) || "Not enough data",
      };
    });
  }, [labels]);

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                7-Day Dispatch & Delivery Volume Trend
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time daily volume progression computed in local timezone.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Last 7 Days
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="deliveredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-2.5 text-xs text-popover-foreground space-y-1">
                        <div className="font-semibold">{label}</div>
                        <div className="flex items-center gap-2 text-primary font-medium">
                          <span className="h-2 w-2 rounded-full bg-primary" /> Dispatched: {payload[0]?.value}
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered: {payload[1]?.value}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                  formatter={(value) => <span className="text-foreground text-xs font-medium">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Dispatched"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#createdGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  name="Delivered"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#deliveredGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Courier Performance Matrix */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            Courier Partner SLA & Delivery Performance Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Volume completion rates, actual average turnaround times, and sample sizes across courier partners.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-wrapper rounded-b-lg overflow-x-auto" tabIndex={0} role="region" aria-label="Courier performance table">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <TableHead className="py-3">Courier Partner</TableHead>
                  <TableHead className="py-3">Total Volume</TableHead>
                  <TableHead className="py-3">Delivered</TableHead>
                  <TableHead className="py-3">Delivery Rate</TableHead>
                  <TableHead className="py-3">Delayed</TableHead>
                  <TableHead className="py-3">RTO</TableHead>
                  <TableHead className="py-3">Average TAT</TableHead>
                  <TableHead className="py-3">Sample (n)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierMatrix.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      No courier activity recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  courierMatrix.map((item) => (
                    <TableRow key={item.courier} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground flex items-center gap-2 py-3">
                        <Truck className="h-4 w-4 text-primary shrink-0" />
                        {item.courier}
                      </TableCell>
                      <TableCell className="font-semibold font-tabular py-3">{item.total}</TableCell>
                      <TableCell className="text-emerald-700 dark:text-emerald-400 font-semibold font-tabular py-3">
                        {item.delivered}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold font-tabular">{item.rate}%</span>
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.rate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {item.delayed > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold font-tabular">
                            {item.delayed}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {item.rto > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold font-tabular">
                            {item.rto}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-medium bg-muted/60 px-2 py-0.5 rounded text-[11px]">
                          {item.avgTatDisplay}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-tabular text-[11px] py-3">
                        {item.sampleSize} shipments
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

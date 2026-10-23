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
import { Truck, CheckCircle2, RotateCcw, AlertTriangle, TrendingUp, BarChart3, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatCompactDuration,
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
        const deliveredMs = l.delivered_at ? new Date(l.delivered_at).getTime() : null;
        if (pickupMs && deliveredMs && deliveredMs >= pickupMs) {
          item.allTatMs.push(deliveredMs - pickupMs);
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
        avgTatDisplay: formatCompactDuration(avgTatMs) || "—",
      };
    }).sort((a, b) => b.total - a.total);
  }, [labels]);

  const totals = useMemo(() => {
    let total = 0;
    let delivered = 0;
    let delayed = 0;
    let rto = 0;
    for (const c of courierMatrix) {
      total += c.total;
      delivered += c.delivered;
      delayed += c.delayed;
      rto += c.rto;
    }
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    return { total, delivered, delayed, rto, rate };
  }, [courierMatrix]);

  return (
    <div className="space-y-6">
      {/* 7-Day Trend Chart */}
      <Card className="border-border/80 shadow-xs bg-card">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                7-Day Dispatch vs. Delivery Trajectory
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Daily volume comparison computed in IST/local timezone.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="outline" className="text-[11px] font-semibold bg-muted/50">
                Rolling 7 Days
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="deliveredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const createdVal = Number(payload[0]?.value || 0);
                    const delivVal = Number(payload[1]?.value || 0);
                    return (
                      <div className="bg-popover/95 backdrop-blur border border-border rounded-lg shadow-md p-3 text-xs text-popover-foreground space-y-1.5 min-w-[140px]">
                        <div className="font-bold border-b border-border/50 pb-1 text-foreground">{label}</div>
                        <div className="flex items-center justify-between gap-3 text-primary font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-primary" /> Dispatches:
                          </span>
                          <span className="font-mono">{createdVal}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Deliveries:
                          </span>
                          <span className="font-mono">{delivVal}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                  formatter={(value) => <span className="text-foreground text-xs font-semibold">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Dispatches"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#createdGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  name="Deliveries"
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
      <Card className="border-border/80 shadow-xs bg-card">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                Courier Partner SLA & Delivery Performance Matrix
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Completion rates, compact average turnaround times (TAT), and SLA breaches by carrier.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] self-start sm:self-auto font-medium">
              {courierMatrix.length} Integrated Couriers
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-wrapper rounded-b-lg overflow-x-auto" tabIndex={0} role="region" aria-label="Courier performance table">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/80">
                  <TableHead className="py-2.5 px-4 font-bold">Courier Partner</TableHead>
                  <TableHead className="py-2.5 px-3 text-right font-bold">Total Assigned</TableHead>
                  <TableHead className="py-2.5 px-3 text-right font-bold">Delivered</TableHead>
                  <TableHead className="py-2.5 px-4 font-bold">Success Rate</TableHead>
                  <TableHead className="py-2.5 px-3 text-right font-bold">Delayed</TableHead>
                  <TableHead className="py-2.5 px-3 text-right font-bold">RTO</TableHead>
                  <TableHead className="py-2.5 px-3 text-right font-bold">Average TAT</TableHead>
                  <TableHead className="py-2.5 px-4 text-right font-bold">Sample</TableHead>
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
                    <TableRow key={item.courier} className="text-xs hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-foreground py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                            <Truck className="h-3.5 w-3.5" />
                          </div>
                          <span>{item.courier}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold font-tabular py-2.5 px-3">
                        {item.total}
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 dark:text-emerald-400 font-bold font-tabular py-2.5 px-3">
                        {item.delivered}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-tabular text-[11px] w-9 text-right">{item.rate}%</span>
                          <div className="h-1.5 flex-1 min-w-[60px] max-w-[100px] bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, item.rate))}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-3">
                        {item.delayed > 0 ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 font-bold font-tabular">
                            {item.delayed}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60 font-tabular text-[11px]">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-3">
                        {item.rto > 0 ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700 font-bold font-tabular">
                            {item.rto}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60 font-tabular text-[11px]">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-3 font-mono font-bold text-foreground text-[11px]">
                        {item.avgTatDisplay}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-tabular text-[10px] py-2.5 px-4">
                        {item.sampleSize} parcels
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {courierMatrix.length > 0 && (
                <TableFooter className="bg-muted/30 font-semibold text-xs border-t border-border">
                  <TableRow>
                    <TableCell className="px-4 py-2.5 font-bold text-foreground">Fleet Total</TableCell>
                    <TableCell className="text-right px-3 py-2.5 font-bold font-tabular">{totals.total}</TableCell>
                    <TableCell className="text-right px-3 py-2.5 font-bold font-tabular text-emerald-700 dark:text-emerald-400">
                      {totals.delivered}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-bold font-tabular">{totals.rate}% overall</TableCell>
                    <TableCell className="text-right px-3 py-2.5 font-bold font-tabular text-amber-600 dark:text-amber-400">
                      {totals.delayed}
                    </TableCell>
                    <TableCell className="text-right px-3 py-2.5 font-bold font-tabular text-rose-600 dark:text-rose-400">
                      {totals.rto}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right px-4 py-2.5 text-muted-foreground text-[11px]">
                      Aggregated
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

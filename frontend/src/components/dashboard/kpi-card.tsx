import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KpiCardProps {
  title: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "emerald" | "amber" | "rose" | "blue" | "purple" | "orange" | "slate" | "default";
  active?: boolean;
  onClick?: () => void;
  iconColor?: string;
  iconBg?: string;
  accentColor?: "emerald" | "amber" | "rose" | "blue" | "purple" | "orange" | "slate";
}

const badgeColorMap: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  amber: "bg-amber-50 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  rose: "bg-rose-50 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  blue: "bg-sky-50 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  purple: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  orange: "bg-orange-50 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  slate: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  default: "bg-muted text-muted-foreground",
};

const borderAccentMap: Record<string, string> = {
  emerald: "border-l-4 border-l-emerald-500",
  amber: "border-l-4 border-l-amber-500",
  rose: "border-l-4 border-l-rose-500",
  blue: "border-l-4 border-l-sky-500",
  purple: "border-l-4 border-l-indigo-500",
  orange: "border-l-4 border-l-orange-500",
  slate: "border-l-4 border-l-slate-400 dark:border-l-slate-600",
};

export function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  badge,
  badgeVariant = "default",
  active = false,
  onClick,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  accentColor,
}: KpiCardProps) {
  const isClickable = Boolean(onClick);
  const borderClass = accentColor ? borderAccentMap[accentColor] : "";

  return (
    <Card
      onClick={onClick}
      className={`relative overflow-hidden transition-all duration-150 flex flex-col justify-between border-border/80 shadow-xs ${borderClass} ${
        isClickable ? "cursor-pointer hover:shadow-sm hover:border-primary/40 active:scale-[0.99]" : ""
      } ${
        active
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "bg-card"
      }`}
    >
      <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
              {title}
            </span>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-tabular leading-tight">
              {value}
            </div>
          </div>
          <div className={`p-2 rounded-lg ${iconBg} ${iconColor} shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5 text-xs">
          <span className="text-muted-foreground text-[10px] leading-tight truncate font-medium">
            {sub}
          </span>
          {badge && (
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 font-semibold tracking-tight shrink-0 ${badgeColorMap[badgeVariant] || badgeColorMap.default}`}
            >
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

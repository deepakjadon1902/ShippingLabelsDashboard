import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KpiCardProps {
  title: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "emerald" | "amber" | "rose" | "blue" | "purple" | "slate" | "default";
  active?: boolean;
  onClick?: () => void;
  iconColor?: string;
  iconBg?: string;
}

const badgeColorMap: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  rose: "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  blue: "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  purple: "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  slate: "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  default: "bg-muted text-muted-foreground",
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
}: KpiCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <Card
      onClick={onClick}
      className={`relative overflow-hidden transition-all duration-200 ${
        isClickable ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${
        active
          ? "ring-2 ring-primary border-primary shadow-sm bg-card"
          : "hover:border-border/80 bg-card"
      }`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">
              {title}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-tabular">
              {value}
            </div>
          </div>
          <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground text-[11px] leading-tight truncate max-w-[180px]">
            {sub}
          </span>
          {badge && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 font-medium ${badgeColorMap[badgeVariant] || badgeColorMap.default}`}
            >
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

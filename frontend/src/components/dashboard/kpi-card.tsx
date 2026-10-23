import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accentColor?: string;
  active?: boolean;
  onClick?: () => void;
  badgeText?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  accentColor,
  active = false,
  onClick,
  badgeText,
}: KpiCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <Card
      onClick={onClick}
      className={`p-3 h-[84px] flex flex-col justify-between transition-all duration-200 select-none ${
        isClickable ? "cursor-pointer hover:shadow-sm hover:-translate-y-0.5" : ""
      } ${
        active
          ? "ring-2 ring-primary border-primary shadow-xs bg-card"
          : "hover:border-border/80 bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground leading-tight whitespace-nowrap">
          {label}
        </span>
        <div className="shrink-0">{icon}</div>
      </div>
      <div className="flex items-baseline justify-between gap-1.5 mt-auto">
        <span className="text-2xl font-bold tracking-tight font-tabular leading-none text-foreground">
          {value}
        </span>
        {badgeText && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 font-normal shrink-0 ${accentColor || "bg-muted"}`}
          >
            {badgeText}
          </Badge>
        )}
      </div>
    </Card>
  );
}

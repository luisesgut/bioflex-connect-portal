import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "accent" | "warning" | "success";
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon, 
  trend,
  variant = "default" 
}: StatsCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover",
      variant === "accent" && "border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10",
      variant === "warning" && "border-warning/30 bg-gradient-to-br from-warning/5 to-warning/10",
      variant === "success" && "border-success/30 bg-gradient-to-br from-success/5 to-success/10"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
          {trend && (
            <p className={cn(
              "mt-2 text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              <span className="ml-1 text-muted-foreground">vs last month</span>
            </p>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg",
          variant === "default" && "bg-primary/10 text-primary",
          variant === "accent" && "bg-accent/20 text-accent",
          variant === "warning" && "bg-warning/20 text-warning",
          variant === "success" && "bg-success/20 text-success"
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, Circle, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: string;
  product: string;
  stage: string;
  progress: number;
  isHot: boolean;
  estimatedCompletion: string;
}

const timelineItems: TimelineItem[] = [
  {
    id: "1",
    product: "Custom Stand-Up Pouch - 12oz",
    stage: "Printing",
    progress: 75,
    isHot: true,
    estimatedCompletion: "Dec 28",
  },
  {
    id: "2",
    product: "Resealable Flat Pouch - 8oz",
    stage: "Lamination",
    progress: 45,
    isHot: false,
    estimatedCompletion: "Jan 2",
  },
  {
    id: "3",
    product: "Vacuum Seal Pouch - 16oz",
    stage: "Converting",
    progress: 90,
    isHot: true,
    estimatedCompletion: "Dec 27",
  },
];

export function ProductionTimeline() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-card-foreground">Production Pipeline</h2>
        <p className="text-sm text-muted-foreground">Real-time production status updates</p>
      </div>
      
      <div className="space-y-6">
        {timelineItems.map((item) => (
          <div key={item.id} className="relative">
            <div className="flex items-start gap-4">
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                item.isHot 
                  ? "bg-accent/20" 
                  : item.progress === 100 
                    ? "bg-success/20" 
                    : "bg-info/20"
              )}>
                {item.isHot ? (
                  <Flame className="h-5 w-5 text-accent" />
                ) : item.progress === 100 ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <Clock className="h-5 w-5 text-info" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-medium text-card-foreground">
                    {item.product}
                  </h3>
                  {item.isHot && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      HOT
                    </span>
                  )}
                </div>
                
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.stage} • Est. {item.estimatedCompletion}
                </p>
                
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Progress</span>
                    <span className="text-xs font-medium text-card-foreground">{item.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        item.isHot 
                          ? "bg-gradient-accent" 
                          : item.progress === 100 
                            ? "bg-success" 
                            : "bg-info"
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

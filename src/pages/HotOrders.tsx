import { Flame, Clock, ArrowUp, ArrowDown, Package, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HotOrder {
  id: string;
  poNumber: string;
  product: string;
  quantity: string;
  stage: string;
  progress: number;
  daysRemaining: number;
  priorityRank: number;
  reason: string;
}

const hotOrders: HotOrder[] = [
  {
    id: "1",
    poNumber: "PO-2025-0142",
    product: "Custom Stand-Up Pouch - 12oz",
    quantity: "50,000 units",
    stage: "Printing",
    progress: 75,
    daysRemaining: 4,
    priorityRank: 1,
    reason: "Customer urgent request - Holiday launch",
  },
  {
    id: "2",
    poNumber: "PO-2025-0130",
    product: "Vacuum Seal Pouch - 16oz",
    quantity: "30,000 units",
    stage: "Converting",
    progress: 90,
    daysRemaining: 2,
    priorityRank: 2,
    reason: "Expedited shipping - Trade show deadline",
  },
  {
    id: "3",
    poNumber: "PO-2025-0148",
    product: "Retort Pouch - 10oz",
    quantity: "20,000 units",
    stage: "Pre-Press",
    progress: 25,
    daysRemaining: 8,
    priorityRank: 3,
    reason: "Product launch deadline",
  },
];

export default function HotOrders() {
  const handleMoveUp = (id: string) => {
    console.log("Move up:", id);
  };

  const handleMoveDown = (id: string) => {
    console.log("Move down:", id);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent shadow-glow">
              <Flame className="h-7 w-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Hot Orders
              </h1>
              <p className="mt-1 text-muted-foreground">
                Prioritize and manage your urgent production orders
              </p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-card-foreground">Priority Queue Management</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag orders or use the arrows to adjust production priority. Higher priority orders will be processed first.
            </p>
          </div>
        </div>

        {/* Hot Orders List */}
        <div className="space-y-4">
          {hotOrders.map((order, index) => (
            <div
              key={order.id}
              className="group relative overflow-hidden rounded-xl border border-accent/30 bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-accent/50 animate-slide-up"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              {/* Priority Badge */}
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-accent opacity-10" />
              
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                {/* Left Section - Order Info */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-accent text-lg font-bold text-accent-foreground shadow-glow">
                    #{order.priorityRank}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-card-foreground">
                        {order.product}
                      </h3>
                      <Badge variant="outline" className="font-mono text-xs">
                        {order.poNumber}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.quantity}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Flame className="h-4 w-4 text-accent" />
                      <span className="text-accent font-medium">{order.reason}</span>
                    </div>
                  </div>
                </div>

                {/* Middle Section - Progress */}
                <div className="lg:flex-1 lg:max-w-md lg:px-8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-card-foreground">
                      {order.stage}
                    </span>
                    <span className="text-sm font-bold text-accent">{order.progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className="h-full rounded-full bg-gradient-accent transition-all duration-500"
                      style={{ width: `${order.progress}%` }}
                    />
                  </div>
                </div>

                {/* Right Section - Time & Actions */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(
                      "text-sm font-semibold",
                      order.daysRemaining <= 3 ? "text-destructive" : "text-card-foreground"
                    )}>
                      {order.daysRemaining} days left
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMoveUp(order.id)}
                      disabled={order.priorityRank === 1}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMoveDown(order.id)}
                      disabled={order.priorityRank === hotOrders.length}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {hotOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 animate-fade-in">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No hot orders</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All orders are running on normal priority
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

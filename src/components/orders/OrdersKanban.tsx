import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { Flame, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  po_number: string;
  product_name: string | null;
  product_item_type: string | null;
  product_customer: string | null;
  quantity: number;
  status: string;
  is_hot_order: boolean;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
}

interface OrdersKanbanProps {
  orders: Order[];
  isAdmin: boolean;
}

const statusStyles: Record<string, string> = {
  pending: "bg-info/10 text-info border-info/20",
  submitted: "bg-info/10 text-info border-info/20",
  accepted: "bg-success/10 text-success border-success/20",
  "in-production": "bg-warning/10 text-warning border-warning/20",
  shipped: "bg-accent/10 text-accent border-accent/20",
  delivered: "bg-success/10 text-success border-success/20",
};

const statusLabels: Record<string, string> = {
  pending: "Submitted",
  submitted: "Submitted",
  accepted: "Accepted",
  "in-production": "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
};

const columnColors: string[] = [
  "bg-blue-500/10 border-blue-500/30",
  "bg-purple-500/10 border-purple-500/30",
  "bg-amber-500/10 border-amber-500/30",
  "bg-emerald-500/10 border-emerald-500/30",
  "bg-teal-500/10 border-teal-500/30",
  "bg-indigo-500/10 border-indigo-500/30",
  "bg-orange-500/10 border-orange-500/30",
  "bg-cyan-500/10 border-cyan-500/30",
  "bg-rose-500/10 border-rose-500/30",
  "bg-lime-500/10 border-lime-500/30",
];

export function OrdersKanban({ orders, isAdmin }: OrdersKanbanProps) {
  const navigate = useNavigate();

  // Group orders by product item_type (product family)
  const families = Array.from(
    new Set(orders.map((o) => o.product_item_type || "Unassigned"))
  ).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });

  const getOrdersByFamily = (family: string) =>
    orders.filter((o) => (o.product_item_type || "Unassigned") === family);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {families.map((family, idx) => {
          const familyOrders = getOrdersByFamily(family);

          return (
            <div key={family} className="flex-shrink-0 w-80">
              <div
                className={cn(
                  "rounded-lg border-2 h-full",
                  columnColors[idx % columnColors.length]
                )}
              >
                <div className="p-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm truncate">
                      {family}
                    </h3>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {familyOrders.length}
                    </Badge>
                  </div>
                </div>

                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="p-2 space-y-2">
                    {familyOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        —
                      </div>
                    ) : (
                      familyOrders.map((order) => (
                        <Card
                          key={order.id}
                          className="cursor-pointer hover:shadow-md transition-shadow bg-card"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-xs font-medium text-card-foreground">
                                {order.po_number}
                              </span>
                              <div className="flex items-center gap-1">
                                {order.is_hot_order && (
                                  <Flame className="h-3.5 w-3.5 text-accent animate-pulse" />
                                )}
                                {order.do_not_delay && (
                                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                                )}
                              </div>
                            </div>
                            <h4 className="font-medium text-sm line-clamp-2 mb-1">
                              {order.product_name || "No product"}
                            </h4>
                            {order.product_customer && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {order.product_customer}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  statusStyles[order.status]
                                )}
                              >
                                {statusLabels[order.status] || order.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {order.quantity.toLocaleString()} units
                              </span>
                            </div>
                            {(order.requested_delivery_date || order.estimated_delivery_date) && (
                              <div className="mt-2 text-[10px] text-muted-foreground">
                                {order.requested_delivery_date && (
                                  <span>Due: {formatDate(order.requested_delivery_date)}</span>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

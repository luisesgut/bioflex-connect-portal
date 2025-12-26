import { Flame, MoreVertical, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  product: string;
  quantity: string;
  status: "in-production" | "pending" | "shipped" | "delivered";
  priority: "normal" | "high" | "hot";
  estimatedDelivery: string;
  poNumber: string;
}

const orders: Order[] = [
  {
    id: "1",
    product: "Custom Stand-Up Pouch - 12oz",
    quantity: "50,000 units",
    status: "in-production",
    priority: "hot",
    estimatedDelivery: "Dec 30, 2025",
    poNumber: "PO-2025-0142",
  },
  {
    id: "2",
    product: "Resealable Flat Pouch - 8oz",
    quantity: "25,000 units",
    status: "in-production",
    priority: "high",
    estimatedDelivery: "Jan 5, 2026",
    poNumber: "PO-2025-0138",
  },
  {
    id: "3",
    product: "Gusseted Bag - 2lb",
    quantity: "100,000 units",
    status: "pending",
    priority: "normal",
    estimatedDelivery: "Jan 12, 2026",
    poNumber: "PO-2025-0135",
  },
  {
    id: "4",
    product: "Vacuum Seal Pouch - 16oz",
    quantity: "30,000 units",
    status: "shipped",
    priority: "hot",
    estimatedDelivery: "Dec 28, 2025",
    poNumber: "PO-2025-0130",
  },
  {
    id: "5",
    product: "Spouted Pouch - 32oz",
    quantity: "15,000 units",
    status: "delivered",
    priority: "normal",
    estimatedDelivery: "Dec 20, 2025",
    poNumber: "PO-2025-0125",
  },
];

const statusStyles = {
  "in-production": "bg-info/10 text-info border-info/20",
  "pending": "bg-muted text-muted-foreground border-muted",
  "shipped": "bg-warning/10 text-warning border-warning/20",
  "delivered": "bg-success/10 text-success border-success/20",
};

const statusLabels = {
  "in-production": "In Production",
  "pending": "Pending",
  "shipped": "Shipped",
  "delivered": "Delivered",
};

export function OrdersTable() {
  return (
    <div className="rounded-xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b p-6">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Recent Orders</h2>
          <p className="text-sm text-muted-foreground">Track your purchase orders and production status</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          View All
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                PO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Est. Delivery
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-muted/20">
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="font-mono text-sm font-medium text-card-foreground">
                    {order.poNumber}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-card-foreground">
                    {order.product}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {order.quantity}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant="outline" className={cn("font-medium", statusStyles[order.status])}>
                    {statusLabels[order.status]}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {order.priority === "hot" ? (
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-accent animate-pulse" />
                      <span className="text-sm font-semibold text-accent">Hot</span>
                    </div>
                  ) : order.priority === "high" ? (
                    <span className="text-sm font-medium text-warning">High</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Normal</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {order.estimatedDelivery}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

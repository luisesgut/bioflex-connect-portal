import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Plus, FileText, Flame, MoreVertical, Download, Eye } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  poNumber: string;
  product: string;
  quantity: string;
  status: "draft" | "submitted" | "in-production" | "shipped" | "delivered";
  priority: "normal" | "high" | "hot";
  createdDate: string;
  estimatedDelivery: string;
  totalValue: string;
}

const orders: Order[] = [
  {
    id: "1",
    poNumber: "PO-2025-0142",
    product: "Custom Stand-Up Pouch - 12oz",
    quantity: "50,000 units",
    status: "in-production",
    priority: "hot",
    createdDate: "Dec 15, 2025",
    estimatedDelivery: "Dec 30, 2025",
    totalValue: "$12,500",
  },
  {
    id: "2",
    poNumber: "PO-2025-0138",
    product: "Resealable Flat Pouch - 8oz",
    quantity: "25,000 units",
    status: "in-production",
    priority: "high",
    createdDate: "Dec 12, 2025",
    estimatedDelivery: "Jan 5, 2026",
    totalValue: "$6,250",
  },
  {
    id: "3",
    poNumber: "PO-2025-0135",
    product: "Gusseted Bag - 2lb",
    quantity: "100,000 units",
    status: "submitted",
    priority: "normal",
    createdDate: "Dec 10, 2025",
    estimatedDelivery: "Jan 12, 2026",
    totalValue: "$22,000",
  },
  {
    id: "4",
    poNumber: "PO-2025-0130",
    product: "Vacuum Seal Pouch - 16oz",
    quantity: "30,000 units",
    status: "shipped",
    priority: "hot",
    createdDate: "Dec 5, 2025",
    estimatedDelivery: "Dec 28, 2025",
    totalValue: "$9,000",
  },
  {
    id: "5",
    poNumber: "PO-2025-0125",
    product: "Spouted Pouch - 32oz",
    quantity: "15,000 units",
    status: "delivered",
    priority: "normal",
    createdDate: "Nov 28, 2025",
    estimatedDelivery: "Dec 20, 2025",
    totalValue: "$7,500",
  },
  {
    id: "6",
    poNumber: "PO-2025-0145",
    product: "Retort Pouch - 10oz",
    quantity: "20,000 units",
    status: "draft",
    priority: "normal",
    createdDate: "Dec 20, 2025",
    estimatedDelivery: "TBD",
    totalValue: "$5,800",
  },
];

const statusStyles = {
  draft: "bg-muted text-muted-foreground border-muted",
  submitted: "bg-info/10 text-info border-info/20",
  "in-production": "bg-warning/10 text-warning border-warning/20",
  shipped: "bg-accent/10 text-accent border-accent/20",
  delivered: "bg-success/10 text-success border-success/20",
};

const statusLabels = {
  draft: "Draft",
  submitted: "Submitted",
  "in-production": "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
};

const statusFilters = ["All", "Draft", "Submitted", "In Production", "Shipped", "Delivered"];

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "All" || 
                         statusLabels[order.status] === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Purchase Orders
            </h1>
            <p className="mt-1 text-muted-foreground">
              Create and manage your purchase orders
            </p>
          </div>
          <Link to="/orders/new">
            <Button variant="accent" className="gap-2">
              <Plus className="h-5 w-5" />
              Create New PO
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PO number or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((status) => (
              <Button
                key={status}
                variant={selectedStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus(status)}
                className="transition-all duration-200"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    PO Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Product
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Quantity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Value
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Est. Delivery
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.map((order) => (
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
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-card-foreground">
                      {order.totalValue}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <Eye className="h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Download className="h-4 w-4" />
                            Download PO
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-accent">
                            <Flame className="h-4 w-4" />
                            Mark as Hot
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No orders found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

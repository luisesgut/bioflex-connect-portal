import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, FileText, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { AcceptOrderDialog } from "@/components/orders/AcceptOrderDialog";
import { BulkOrdersManager } from "@/components/orders/BulkOrdersManager";
import { ChangeRequestDialog } from "@/components/orders/ChangeRequestDialog";
import { EditableOrderRow } from "@/components/orders/EditableOrderRow";
import { differenceInHours } from "date-fns";

interface InventoryStats {
  inFloor: number;
  shipped: number;
  pending: number;
  percentProduced: number;
}

interface Order {
  id: string;
  po_number: string;
  product_name: string | null;
  quantity: number;
  total_price: number | null;
  status: string;
  is_hot_order: boolean;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  pdf_url: string | null;
  sales_order_number: string | null;
  inventoryStats: InventoryStats;
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

const statusFilters = ["All", "Submitted", "Accepted", "In Production", "Shipped", "Delivered"];

export default function Orders() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [changeRequestDialogOpen, setChangeRequestDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    
    // Fetch orders
    const { data: ordersData, error: ordersError } = await supabase
      .from("purchase_orders")
      .select(`
        id,
        po_number,
        quantity,
        total_price,
        status,
        is_hot_order,
        do_not_delay,
        requested_delivery_date,
        estimated_delivery_date,
        created_at,
        pdf_url,
        sales_order_number,
        products (name)
      `)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      toast.error("Failed to load orders");
      setLoading(false);
      return;
    }

    // Get all sales order numbers and PO numbers for inventory lookup
    const salesOrderNumbers = (ordersData || [])
      .map((o: any) => o.sales_order_number)
      .filter((son: string | null): son is string => son !== null && son !== "");

    const poNumbers = (ordersData || [])
      .map((o: any) => o.po_number)
      .filter((po: string | null): po is string => po !== null && po !== "");

    // Create maps for inventory stats - keyed by both sales_order and po_number
    let inventoryBySalesOrder: Record<string, { inFloor: number; shipped: number }> = {};
    let inventoryByPO: Record<string, { inFloor: number; shipped: number }> = {};
    
    // Fetch current inventory by bfx_order (matches sales_order_number)
    if (salesOrderNumbers.length > 0) {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory_pallets")
        .select("bfx_order, stock")
        .in("bfx_order", salesOrderNumbers);

      if (!inventoryError && inventoryData) {
        inventoryData.forEach((pallet: any) => {
          const salesOrder = pallet.bfx_order;
          if (!salesOrder) return;

          if (!inventoryBySalesOrder[salesOrder]) {
            inventoryBySalesOrder[salesOrder] = { inFloor: 0, shipped: 0 };
          }
          inventoryBySalesOrder[salesOrder].inFloor += pallet.stock || 0;
        });
      }

      // Fetch shipped pallets by bfx_order
      const { data: shippedData, error: shippedError } = await supabase
        .from("shipped_pallets")
        .select("bfx_order, quantity")
        .in("bfx_order", salesOrderNumbers);

      if (!shippedError && shippedData) {
        shippedData.forEach((pallet: any) => {
          const salesOrder = pallet.bfx_order;
          if (!salesOrder) return;

          if (!inventoryBySalesOrder[salesOrder]) {
            inventoryBySalesOrder[salesOrder] = { inFloor: 0, shipped: 0 };
          }
          inventoryBySalesOrder[salesOrder].shipped += pallet.quantity || 0;
        });
      }
    }

    // Also fetch inventory by customer_lot (matches po_number)
    if (poNumbers.length > 0) {
      const { data: inventoryByLotData, error: inventoryByLotError } = await supabase
        .from("inventory_pallets")
        .select("customer_lot, stock")
        .in("customer_lot", poNumbers);

      if (!inventoryByLotError && inventoryByLotData) {
        inventoryByLotData.forEach((pallet: any) => {
          const poNum = pallet.customer_lot;
          if (!poNum) return;

          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0 };
          }
          inventoryByPO[poNum].inFloor += pallet.stock || 0;
        });
      }

      // Fetch shipped pallets by customer_lot
      const { data: shippedByLotData, error: shippedByLotError } = await supabase
        .from("shipped_pallets")
        .select("customer_lot, quantity")
        .in("customer_lot", poNumbers);

      if (!shippedByLotError && shippedByLotData) {
        shippedByLotData.forEach((pallet: any) => {
          const poNum = pallet.customer_lot;
          if (!poNum) return;

          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0 };
          }
          inventoryByPO[poNum].shipped += pallet.quantity || 0;
        });
      }
    }

    const formattedOrders = (ordersData || []).map((order: any) => {
      // Combine stats from both matching methods (bfx_order → sales_order AND customer_lot → po_number)
      const statsBySalesOrder = inventoryBySalesOrder[order.sales_order_number] || { inFloor: 0, shipped: 0 };
      const statsByPO = inventoryByPO[order.po_number] || { inFloor: 0, shipped: 0 };
      
      const stats = {
        inFloor: statsBySalesOrder.inFloor + statsByPO.inFloor,
        shipped: statsBySalesOrder.shipped + statsByPO.shipped,
      };
      
      const produced = stats.inFloor + stats.shipped;
      const pending = Math.max(0, order.quantity - produced);
      const percentProduced = order.quantity > 0 ? Math.round((produced / order.quantity) * 100) : 0;

      return {
        id: order.id,
        po_number: order.po_number,
        product_name: order.products?.name || null,
        quantity: order.quantity,
        total_price: order.total_price,
        status: order.status,
        is_hot_order: order.is_hot_order,
        do_not_delay: order.do_not_delay ?? false,
        requested_delivery_date: order.requested_delivery_date,
        estimated_delivery_date: order.estimated_delivery_date,
        created_at: order.created_at,
        pdf_url: order.pdf_url,
        sales_order_number: order.sales_order_number,
        inventoryStats: {
          inFloor: stats.inFloor,
          shipped: stats.shipped,
          pending,
          percentProduced,
        },
      };
    });
    setOrders(formattedOrders);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const getStatusFilter = (status: string): string => {
    if (status === "pending" || status === "submitted") return "Submitted";
    if (status === "accepted") return "Accepted";
    if (status === "in-production") return "In Production";
    if (status === "shipped") return "Shipped";
    if (status === "delivered") return "Delivered";
    return "Submitted";
  };

  const getAcceptanceDeadline = (createdAt: string) => {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 1 day
    const hoursLeft = differenceInHours(deadline, new Date());
    return hoursLeft;
  };

  const handleAcceptOrder = (order: Order) => {
    setSelectedOrder(order);
    setAcceptDialogOpen(true);
  };

  const handleRequestChange = (order: Order) => {
    setSelectedOrder(order);
    setChangeRequestDialogOpen(true);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (order.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = selectedStatus === "All" || 
                         getStatusFilter(order.status) === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

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
          <div className="flex items-center gap-3">
            {isAdmin && <BulkOrdersManager onUpdated={fetchOrders} />}
            <Link to="/orders/new">
              <Button variant="accent" className="gap-2">
                <Plus className="h-5 w-5" />
                Create New PO
              </Button>
            </Link>
          </div>
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

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Orders Table */}
        {!loading && filteredOrders.length > 0 && (
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
                    {isAdmin && (
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Sales Order
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Customer Delivery
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Bioflex Delivery
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      In Floor
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Shipped
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pending
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      % Produced
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => (
                    <EditableOrderRow
                      key={order.id}
                      order={order}
                      isAdmin={isAdmin}
                      statusStyles={statusStyles}
                      statusLabels={statusLabels}
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      onAcceptOrder={handleAcceptOrder}
                      onRequestChange={handleRequestChange}
                      onUpdated={fetchOrders}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No orders found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length === 0 
                ? "Create your first purchase order to get started"
                : "Try adjusting your search or filter criteria"}
            </p>
            {orders.length === 0 && (
              <Link to="/orders/new" className="mt-4">
                <Button variant="accent" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Create New PO
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Accept Order Dialog */}
        <AcceptOrderDialog
          open={acceptDialogOpen}
          onOpenChange={setAcceptDialogOpen}
          order={selectedOrder}
          onAccepted={fetchOrders}
        />

        {/* Change Request Dialog */}
        <ChangeRequestDialog
          open={changeRequestDialogOpen}
          onOpenChange={setChangeRequestDialogOpen}
          order={selectedOrder}
          onSubmitted={fetchOrders}
        />
      </div>
    </MainLayout>
  );
}

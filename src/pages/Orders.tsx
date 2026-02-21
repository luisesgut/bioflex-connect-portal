import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, FileText, Loader2, Package, PackageCheck, List, CalendarDays, LayoutGrid, RotateCcw } from "lucide-react";
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
import { FilterableColumnHeader } from "@/components/orders/FilterableColumnHeader";
import { ResizableTableHeader } from "@/components/orders/ResizableTableHeader";
import { differenceInHours } from "date-fns";
import { ProductionTimeline } from "@/components/orders/ProductionTimeline";
import { OrdersKanban } from "@/components/orders/OrdersKanban";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useColumnConfig } from "@/hooks/useColumnConfig";

interface LoadDetail {
  load_number: string;
  load_id: string;
  pallet_count: number;
  quantity: number;
}

interface ShippedLoadDetail {
  load_number: string;
  load_id: string;
  pallet_count: number;
  quantity: number;
  delivery_date: string | null;
  shipped_at: string;
}

interface ExcessStockDetail {
  pallet_count: number;
  total_quantity: number;
}

interface InventoryStats {
  inFloor: number;
  shipped: number;
  pending: number;
  percentProduced: number;
  loadDetails: LoadDetail[];
  shippedLoadDetails: ShippedLoadDetail[];
  excessStock: ExcessStockDetail | null;
}

interface Order {
  id: string;
  po_number: string;
  product_name: string | null;
  product_pt_code: string | null;
  product_customer: string | null;
  product_item_type: string | null;
  product_dp_sales_csr: string | null;
  product_customer_item: string | null;
  product_item_description: string | null;
  quantity: number;
  total_price: number | null;
  status: string;
  is_hot_order: boolean;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  printing_date: string | null;
  conversion_date: string | null;
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
  closed: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<string, string> = {
  pending: "Submitted",
  submitted: "Submitted",
  accepted: "Accepted",
  "in-production": "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
  closed: "Closed",
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

  // Column config
  const { getOrderedColumns, getColumnWidth, setColumnWidth, reorderColumns, resetColumns } = useColumnConfig();

  // Column filters
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [itemTypeFilter, setItemTypeFilter] = useState<string[]>([]);
  const [dpSalesFilter, setDpSalesFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);

  // Date sorting
  const [customerDeliverySort, setCustomerDeliverySort] = useState<"asc" | "desc" | null>(null);
  const [bioflexDeliverySort, setBioflexDeliverySort] = useState<"asc" | "desc" | null>(null);

  // View mode toggle
  const [viewMode, setViewMode] = useState<"list" | "timeline" | "board">("list");

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    
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
        printing_date,
        conversion_date,
        created_at,
        pdf_url,
        sales_order_number,
        products (name, sku, customer, item_type, dp_sales_csr_names, customer_item, item_description, codigo_producto, pt_code)
      `)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      toast.error("Failed to load orders");
      setLoading(false);
      return;
    }

    const salesOrderNumbers = (ordersData || [])
      .map((o: any) => o.sales_order_number)
      .filter((son: string | null): son is string => son !== null && son !== "");

    const poNumbers = (ordersData || [])
      .map((o: any) => o.po_number)
      .filter((po: string | null): po is string => po !== null && po !== "");

    let inventoryByPO: Record<string, { inFloor: number; shipped: number; palletIds: Set<string> }> = {};
    let loadDetailsByPO: Record<string, LoadDetail[]> = {};
    let shippedLoadDetailsByPO: Record<string, ShippedLoadDetail[]> = {};
    let shippedPalletIds: Record<string, Set<string>> = {};

    const salesOrderToPO: Record<string, string> = {};
    (ordersData || []).forEach((order: any) => {
      if (order.sales_order_number && order.po_number) {
        salesOrderToPO[order.sales_order_number] = order.po_number;
      }
    });
    
    if (salesOrderNumbers.length > 0) {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory_pallets")
        .select("id, bfx_order, stock")
        .in("bfx_order", salesOrderNumbers);

      if (!inventoryError && inventoryData) {
        inventoryData.forEach((pallet: any) => {
          const salesOrder = pallet.bfx_order;
          if (!salesOrder) return;
          const poNum = salesOrderToPO[salesOrder];
          if (!poNum) return;
          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0, palletIds: new Set() };
          }
          if (!inventoryByPO[poNum].palletIds.has(pallet.id)) {
            inventoryByPO[poNum].palletIds.add(pallet.id);
            inventoryByPO[poNum].inFloor += pallet.stock || 0;
          }
        });
      }

      const { data: shippedData, error: shippedError } = await supabase
        .from("shipped_pallets")
        .select("id, bfx_order, quantity")
        .in("bfx_order", salesOrderNumbers);

      if (!shippedError && shippedData) {
        shippedData.forEach((pallet: any) => {
          const salesOrder = pallet.bfx_order;
          if (!salesOrder) return;
          const poNum = salesOrderToPO[salesOrder];
          if (!poNum) return;
          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0, palletIds: new Set() };
          }
          if (!shippedPalletIds[poNum]) {
            shippedPalletIds[poNum] = new Set();
          }
          if (!shippedPalletIds[poNum].has(pallet.id)) {
            shippedPalletIds[poNum].add(pallet.id);
            inventoryByPO[poNum].shipped += pallet.quantity || 0;
          }
        });
      }
    }

    if (poNumbers.length > 0) {
      const { data: inventoryByLotData, error: inventoryByLotError } = await supabase
        .from("inventory_pallets")
        .select(`
          id,
          customer_lot,
          stock,
          load_pallets (
            id,
            quantity,
            load_id,
            shipping_loads (
              id,
              load_number,
              status
            )
          )
        `)
        .in("customer_lot", poNumbers);

      if (!inventoryByLotError && inventoryByLotData) {
        inventoryByLotData.forEach((pallet: any) => {
          const poNum = pallet.customer_lot;
          if (!poNum) return;
          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0, palletIds: new Set() };
          }
          if (!inventoryByPO[poNum].palletIds.has(pallet.id)) {
            inventoryByPO[poNum].palletIds.add(pallet.id);
            inventoryByPO[poNum].inFloor += pallet.stock || 0;
          }
          if (pallet.load_pallets && pallet.load_pallets.length > 0) {
            const loadPallet = pallet.load_pallets[0];
            const loadInfo = loadPallet?.shipping_loads;
            if (loadInfo && loadInfo.status !== "in_transit" && loadInfo.status !== "delivered") {
              if (!loadDetailsByPO[poNum]) {
                loadDetailsByPO[poNum] = [];
              }
              const existingLoad = loadDetailsByPO[poNum].find(l => l.load_id === loadInfo.id);
              if (existingLoad) {
                existingLoad.pallet_count += 1;
                existingLoad.quantity += pallet.stock || 0;
              } else {
                loadDetailsByPO[poNum].push({
                  load_id: loadInfo.id,
                  load_number: loadInfo.load_number,
                  pallet_count: 1,
                  quantity: pallet.stock || 0,
                });
              }
            }
          }
        });
      }

      const { data: shippedByLotData, error: shippedByLotError } = await supabase
        .from("shipped_pallets")
        .select(`
          id,
          customer_lot,
          quantity,
          load_id,
          delivery_date,
          shipped_at,
          shipping_loads:load_id (
            id,
            load_number
          )
        `)
        .in("customer_lot", poNumbers);

      if (!shippedByLotError && shippedByLotData) {
        shippedByLotData.forEach((pallet: any) => {
          const poNum = pallet.customer_lot;
          if (!poNum) return;
          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0, palletIds: new Set() };
          }
          if (!shippedPalletIds[poNum]) {
            shippedPalletIds[poNum] = new Set();
          }
          if (!shippedPalletIds[poNum].has(pallet.id)) {
            shippedPalletIds[poNum].add(pallet.id);
            inventoryByPO[poNum].shipped += pallet.quantity || 0;
          }
          const loadInfo = pallet.shipping_loads;
          if (loadInfo) {
            if (!shippedLoadDetailsByPO[poNum]) {
              shippedLoadDetailsByPO[poNum] = [];
            }
            const existingLoad = shippedLoadDetailsByPO[poNum].find(l => l.load_id === loadInfo.id);
            if (existingLoad) {
              existingLoad.pallet_count += 1;
              existingLoad.quantity += pallet.quantity || 0;
            } else {
              shippedLoadDetailsByPO[poNum].push({
                load_id: loadInfo.id,
                load_number: loadInfo.load_number,
                pallet_count: 1,
                quantity: pallet.quantity || 0,
                delivery_date: pallet.delivery_date,
                shipped_at: pallet.shipped_at,
              });
            }
          }
        });
      }
    }

    const ptCodes = (ordersData || [])
      .map((o: any) => o.products?.sku)
      .filter((pt: string | null): pt is string => pt !== null && pt !== "");
    
    let excessStockByPT: Record<string, ExcessStockDetail> = {};
    
    if (ptCodes.length > 0) {
      const { data: excessData, error: excessError } = await supabase
        .from("inventory_pallets")
        .select("pt_code, stock")
        .in("pt_code", ptCodes);
      
      if (!excessError && excessData) {
        excessData.forEach((pallet: any) => {
          const ptCode = pallet.pt_code;
          if (!ptCode) return;
          if (!excessStockByPT[ptCode]) {
            excessStockByPT[ptCode] = { pallet_count: 0, total_quantity: 0 };
          }
          excessStockByPT[ptCode].pallet_count += 1;
          excessStockByPT[ptCode].total_quantity += pallet.stock || 0;
        });
      }
    }

    const formattedOrders = (ordersData || []).map((order: any) => {
      const stats = inventoryByPO[order.po_number] || { inFloor: 0, shipped: 0 };
      const produced = stats.inFloor + stats.shipped;
      const pending = Math.max(0, order.quantity - produced);
      const percentProduced = order.quantity > 0 ? Math.round((produced / order.quantity) * 100) : 0;
      const loadDetails = loadDetailsByPO[order.po_number] || [];
      const shippedLoadDetails = shippedLoadDetailsByPO[order.po_number] || [];
      const productSkuForInventory = order.products?.sku || null;
      const excessStock = productSkuForInventory ? excessStockByPT[productSkuForInventory] || null : null;
      const productPtCode = (order.products as any)?.codigo_producto || null;

      return {
        id: order.id,
        po_number: order.po_number,
        product_name: order.products?.name || null,
        product_pt_code: productPtCode,
        product_customer: order.products?.customer || null,
        product_item_type: order.products?.item_type || null,
        product_dp_sales_csr: order.products?.dp_sales_csr_names || null,
        product_customer_item: order.products?.customer_item || null,
        product_item_description: order.products?.item_description || null,
        quantity: order.quantity,
        total_price: order.total_price,
        status: order.status,
        is_hot_order: order.is_hot_order,
        do_not_delay: order.do_not_delay ?? false,
        requested_delivery_date: order.requested_delivery_date,
        estimated_delivery_date: order.estimated_delivery_date,
        printing_date: order.printing_date || null,
        conversion_date: order.conversion_date || null,
        created_at: order.created_at,
        pdf_url: order.pdf_url,
        sales_order_number: order.sales_order_number,
        inventoryStats: {
          inFloor: stats.inFloor,
          shipped: stats.shipped,
          pending,
          percentProduced,
          loadDetails,
          shippedLoadDetails,
          excessStock,
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
    const deadline = new Date(created.getTime() + 24 * 60 * 60 * 1000);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filterOptions = useMemo(() => ({
    products: orders.map((o) => o.product_name).filter(Boolean) as string[],
    customers: orders.map((o) => o.product_customer).filter(Boolean) as string[],
    itemTypes: orders.map((o) => o.product_item_type).filter(Boolean) as string[],
    dpSales: orders.map((o) => o.product_dp_sales_csr).filter(Boolean) as string[],
    statuses: orders.map((o) => statusLabels[o.status] || "Submitted"),
    priorities: ["Hot", "DND", "Normal"],
    customerDeliveryDates: orders.map((o) => formatDate(o.requested_delivery_date)),
    bioflexDeliveryDates: orders.map((o) => formatDate(o.estimated_delivery_date)),
  }), [orders]);

  const getPriorityLabel = (order: Order) => {
    if (order.is_hot_order) return "Hot";
    if (order.do_not_delay) return "DND";
    return "Normal";
  };

  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter((order) => {
      const matchesSearch = order.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (order.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesStatus = selectedStatus === "All" || 
                           getStatusFilter(order.status) === selectedStatus;
      const matchesProduct = productFilter.length === 0 || 
                            (order.product_name && productFilter.includes(order.product_name));
      const matchesCustomer = customerFilter.length === 0 || 
                             (order.product_customer && customerFilter.includes(order.product_customer));
      const matchesItemType = itemTypeFilter.length === 0 || 
                             (order.product_item_type && itemTypeFilter.includes(order.product_item_type));
      const matchesDpSales = dpSalesFilter.length === 0 || 
                            (order.product_dp_sales_csr && dpSalesFilter.includes(order.product_dp_sales_csr));
      const matchesStatusFilter = statusFilter.length === 0 || 
                                 statusFilter.includes(statusLabels[order.status] || "Submitted");
      const matchesPriority = priorityFilter.length === 0 || 
                             priorityFilter.includes(getPriorityLabel(order));
      
      return matchesSearch && matchesStatus && matchesProduct && matchesCustomer && 
             matchesItemType && matchesDpSales && matchesStatusFilter && matchesPriority;
    });

    if (customerDeliverySort) {
      result = [...result].sort((a, b) => {
        const dateA = a.requested_delivery_date ? new Date(a.requested_delivery_date).getTime() : 0;
        const dateB = b.requested_delivery_date ? new Date(b.requested_delivery_date).getTime() : 0;
        return customerDeliverySort === "asc" ? dateA - dateB : dateB - dateA;
      });
    } else if (bioflexDeliverySort) {
      result = [...result].sort((a, b) => {
        const dateA = a.estimated_delivery_date ? new Date(a.estimated_delivery_date).getTime() : 0;
        const dateB = b.estimated_delivery_date ? new Date(b.estimated_delivery_date).getTime() : 0;
        return bioflexDeliverySort === "asc" ? dateA - dateB : dateB - dateA;
      });
    }

    return result;
  }, [orders, searchQuery, selectedStatus, productFilter, customerFilter, itemTypeFilter, 
      dpSalesFilter, statusFilter, priorityFilter, customerDeliverySort, bioflexDeliverySort]);

  const activeOrders = useMemo(() => 
    filteredAndSortedOrders.filter(order => order.status !== "closed"), 
    [filteredAndSortedOrders]
  );
  
  const closedOrders = useMemo(() => 
    filteredAndSortedOrders.filter(order => order.status === "closed"), 
    [filteredAndSortedOrders]
  );

  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const handleReactivateOrder = async (orderId: string) => {
    setReactivatingId(orderId);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "accepted" })
      .eq("id", orderId);
    if (error) {
      toast.error("Failed to reactivate order");
    } else {
      toast.success("Order reactivated successfully");
      fetchOrders();
    }
    setReactivatingId(null);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  // Column filter/sort config maps
  const columnFilterConfig: Record<string, {
    options: string[];
    selectedValues: string[];
    onFilterChange: (values: string[]) => void;
    showSort?: boolean;
    sortDirection?: "asc" | "desc" | null;
    onSortChange?: (dir: "asc" | "desc" | null) => void;
  }> = {
    product: { options: filterOptions.products, selectedValues: productFilter, onFilterChange: setProductFilter },
    customer: { options: filterOptions.customers, selectedValues: customerFilter, onFilterChange: setCustomerFilter },
    item_type: { options: filterOptions.itemTypes, selectedValues: itemTypeFilter, onFilterChange: setItemTypeFilter },
    dp_sales_csr: { options: filterOptions.dpSales, selectedValues: dpSalesFilter, onFilterChange: setDpSalesFilter },
    status: { options: filterOptions.statuses, selectedValues: statusFilter, onFilterChange: setStatusFilter },
    priority: { options: filterOptions.priorities, selectedValues: priorityFilter, onFilterChange: setPriorityFilter },
    customer_delivery: {
      options: filterOptions.customerDeliveryDates,
      selectedValues: [],
      onFilterChange: () => {},
      showSort: true,
      sortDirection: customerDeliverySort,
      onSortChange: (dir) => { setCustomerDeliverySort(dir); setBioflexDeliverySort(null); },
    },
    bioflex_delivery: {
      options: filterOptions.bioflexDeliveryDates,
      selectedValues: [],
      onFilterChange: () => {},
      showSort: true,
      sortDirection: bioflexDeliverySort,
      onSortChange: (dir) => { setBioflexDeliverySort(dir); setCustomerDeliverySort(null); },
    },
  };

  const orderedColumns = getOrderedColumns(isAdmin);

  const renderColumnHeader = (col: typeof orderedColumns[0]) => {
    const filterCfg = columnFilterConfig[col.id];
    if (filterCfg) {
      return (
        <ResizableTableHeader
          key={col.id}
          column={col}
          width={getColumnWidth(col.id)}
          onResize={setColumnWidth}
          onReorder={reorderColumns}
        >
          <FilterableColumnHeader
            title={col.label}
            options={filterCfg.options}
            selectedValues={filterCfg.selectedValues}
            onFilterChange={filterCfg.onFilterChange}
            showSort={filterCfg.showSort}
            sortDirection={filterCfg.sortDirection}
            onSortChange={filterCfg.onSortChange}
            align={col.align}
          />
        </ResizableTableHeader>
      );
    }
    return (
      <ResizableTableHeader
        key={col.id}
        column={col}
        width={getColumnWidth(col.id)}
        onResize={setColumnWidth}
        onReorder={reorderColumns}
      >
        <span className={cn(
          "px-6 py-4 text-xs font-medium uppercase tracking-wider text-muted-foreground block",
          col.align === "right" ? "text-right" : "text-left"
        )}>
          {col.label}
        </span>
      </ResizableTableHeader>
    );
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PO number or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {viewMode === "list" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={resetColumns} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Columns
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset column order and widths</TooltipContent>
              </Tooltip>
            )}
            
            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "timeline" | "board")} className="w-auto">
              <TabsList>
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="board" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Board
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Timeline View */}
        {!loading && viewMode === "timeline" && (
          <ProductionTimeline 
            orders={activeOrders.map(o => ({
              id: o.id,
              po_number: o.po_number,
              product_name: o.product_name || undefined,
              quantity: o.quantity,
              requested_delivery_date: o.requested_delivery_date,
              printing_date: o.printing_date,
              conversion_date: o.conversion_date,
              estimated_delivery_date: o.estimated_delivery_date,
              is_hot_order: o.is_hot_order,
              status: o.status,
            }))}
          />
        )}

        {/* Board View */}
        {!loading && viewMode === "board" && (
          <OrdersKanban orders={activeOrders} isAdmin={isAdmin} />
        )}

        {/* Active Orders Table */}
        {!loading && viewMode === "list" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Active POs</h2>
              <span className="text-sm text-muted-foreground">({activeOrders.length})</span>
            </div>
            
            {activeOrders.length > 0 ? (
              <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: "0.2s" }}>
                <div className="overflow-x-auto">
                  <table className="w-max min-w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {orderedColumns.map(renderColumnHeader)}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activeOrders.map((order) => (
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
                          columnOrder={orderedColumns.map(c => c.id)}
                          columnWidths={Object.fromEntries(orderedColumns.map(c => [c.id, getColumnWidth(c.id)]))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-3 text-base font-semibold text-foreground">No active orders</h3>
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
          </div>
        )}

        {/* Closed Orders Table */}
        {!loading && viewMode === "list" && closedOrders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-success" />
              <h2 className="text-lg font-semibold">Closed POs</h2>
              <span className="text-sm text-muted-foreground">({closedOrders.length})</span>
            </div>
            
            <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">PO Number</th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Quantity</th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer Delivery</th>
                      {isAdmin && (
                        <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {closedOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                        <td className="whitespace-nowrap px-6 py-4">
                          <Link 
                            to={`/orders/${order.id}`}
                            className="font-mono text-sm font-medium text-primary hover:underline"
                          >
                            {order.po_number}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">
                            {[order.product_customer_item, order.product_item_description].filter(Boolean).join(' - ') || order.product_name || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">
                            {order.product_customer || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                          {order.quantity.toLocaleString()} units
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                          {formatDate(order.requested_delivery_date)}
                        </td>
                        {isAdmin && (
                          <td className="whitespace-nowrap px-6 py-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleReactivateOrder(order.id)}
                              disabled={reactivatingId === order.id}
                            >
                              {reactivatingId === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4" />
                                  Reactivate
                                </>
                              )}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {selectedOrder && (
          <>
            <AcceptOrderDialog
              open={acceptDialogOpen}
              onOpenChange={setAcceptDialogOpen}
              order={selectedOrder}
              onAccepted={fetchOrders}
            />
            <ChangeRequestDialog
              open={changeRequestDialogOpen}
              onOpenChange={setChangeRequestDialogOpen}
              order={selectedOrder}
              onSubmitted={fetchOrders}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}

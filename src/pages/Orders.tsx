import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, FileText, Loader2, Package, PackageCheck, List, CalendarDays, LayoutGrid, RotateCcw, X, User, Tag, Box, DollarSign, Calendar, Truck } from "lucide-react";
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
import { OrdersCanvas } from "@/components/orders/OrdersCanvas";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useColumnConfig } from "@/hooks/useColumnConfig";
import { useLanguage } from "@/hooks/useLanguage";
import { mapProductLineToItemType, mapTipoEmpaqueToProductLine } from "@/utils/destinyProducts";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

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
  sapStockAvailable: number | null;
  sapVerificationLoading: boolean;
}

interface StockVerificationWarehouseDetail {
  lote?: string;
  cantidad?: number | string;
}

interface CatOrdenOpenItem {
  pedido?: number | string | null;
  u_PO2?: string | null;
  u_Cl1?: string | null;
  clave?: string | null;
  producto?: string | null;
  frgnName?: string | null;
  u_ItemNo?: string | null;
  tipoEmpaque?: string | null;
  cantidad?: number | string | null;
  precio?: number | string | null;
  value?: number | string | null;
  cantidadSolicitada?: number | string | null;
  cantidadEnviada?: number | string | null;
  fechaDocumento?: string | null;
  fechaVencimiento?: string | null;
  estadoTiempo?: string | null;
  totalStockDisponible?: number | string | null;
  detallesAlmacen?: StockVerificationWarehouseDetail[] | null;
  detallesAlmacenTotal?: StockVerificationWarehouseDetail[] | null;
}

interface CatOrdenClosedItem {
  pedido?: number | string | null;
  cliente?: string | null;
  u_PO2?: string | null;
  u_Cl1?: string | null;
  clave?: string | null;
  producto?: string | null;
  frgnName?: string | null;
  u_ItemNo?: string | null;
  u_ImpRl?: string | null;
  unidad?: string | null;
  claveUnidad?: string | null;
  tipoEmpaque?: string | null;
  validado?: string | null;
  costo?: string | null;
  cantidad?: number | string | null;
  precio?: number | null;
  value?: number | null;
  entregado?: number | string | null;
  cantidadSolicitada?: number | string | null;
  cantidadEnviada?: number | string | null;
  fechaDocumento?: string | null;
  fechaVencimiento?: string | null;
  estadoTiempo?: string | null;
  diasRestantes?: number | null;
  vendedor?: string | null;
  detallesAlmacen?: Array<Record<string, unknown>>;
  detallesAlmacenTotal?: Array<Record<string, unknown>>;
}

interface Order {
  id: string;
  po_number: string;
  product_id: string | null;
  product_name: string | null;
  product_pt_code: string | null;
  product_customer: string | null;
  product_item_type: string | null;
  product_tipo_empaque: string | null;
  product_dp_sales_csr: string | null;
  product_customer_item: string | null;
  product_item_description: string | null;
  quantity: number;
  total_price: number | null;
  status: string;
  is_hot_order: boolean;
  hot_order_priority: number | null;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  printing_date: string | null;
  conversion_date: string | null;
  order_document_date: string | null;
  order_due_date: string | null;
  order_timing_status: string | null;
  created_at: string;
  pdf_url: string | null;
  sales_order_number: string | null;
  accepted_at: string | null;
  inventoryStats: InventoryStats;
  closed_source?: "supabase" | "sap";
  closed_sap_payload?: CatOrdenClosedItem | null;
}

const CAT_ORDEN_OPEN_WITH_ORDEN_ENDPOINT = "http://172.16.10.31/api/CatOrden/open-with-orden";
const CAT_ORDEN_CLOSED_WITH_ORDEN_ENDPOINT = "http://172.16.10.31/api/CatOrden/closed-with-orden";
const SAP_ORDERS_SYNC_ENDPOINT = "http://172.16.10.31/api/Sync/orders";

interface SyncOrdersResponse {
  success?: boolean;
  inserted?: number;
  updated_po?: number;
  synced_at?: string;
}

const parseApiNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizePoKey = (value: string | null | undefined): string => {
  const cleaned = (value || "").trim().toUpperCase();
  if (!cleaned) return "";
  const compact = cleaned.replace(/\s+/g, "");
  if (/^\d+$/.test(compact)) {
    return String(Number(compact));
  }
  return compact;
};

const sumWarehouseQty = (details?: StockVerificationWarehouseDetail[] | null): number =>
  (details || []).reduce((sum, lot) => sum + (parseApiNumber(lot?.cantidad) || 0), 0);

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
  const { isAdmin, isInternalUser } = useAdmin();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [changeRequestDialogOpen, setChangeRequestDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [showRecentClosedSap, setShowRecentClosedSap] = useState(false);

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
  const [viewMode, setViewMode] = useState<"list" | "timeline" | "board" | "canvas">((isAdmin || isInternalUser) ? "board" : "list");

  const fetchOrders = async (): Promise<Order[]> => {
    if (!user) return [];

    const purchaseOrdersSelect = `
        id,
        po_number,
        product_id,
        quantity,
        total_price,
        status,
        is_hot_order,
        hot_order_priority,
        do_not_delay,
        requested_delivery_date,
        estimated_delivery_date,
        printing_date,
        conversion_date,
        created_at,
        pdf_url,
        sales_order_number,
        accepted_at,
        products (name, customer, item_type, product_line, tipo_empaque, dp_sales_csr_names, customer_item, item_description, codigo_producto, pt_code)
      `;

    let { data: ordersData, error: ordersError } = await supabase
      .from("purchase_orders")
      .select(purchaseOrdersSelect)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      throw ordersError;
    }

    let catOrdenByPO: Record<string, CatOrdenOpenItem> = {};
    try {
      const catOrdenResponse = await fetch(CAT_ORDEN_OPEN_WITH_ORDEN_ENDPOINT, {
        signal: AbortSignal.timeout(30000),
      });

      if (catOrdenResponse.ok) {
        const catOrdenPayload = (await catOrdenResponse.json()) as CatOrdenOpenItem[];
        if (Array.isArray(catOrdenPayload)) {
          catOrdenByPO = catOrdenPayload.reduce<Record<string, CatOrdenOpenItem>>((acc, item) => {
            const poKey = normalizePoKey(item.u_PO2);
            if (poKey && !acc[poKey]) {
              acc[poKey] = item;
            }
            return acc;
          }, {});
        } else {
          console.warn("Unexpected CatOrden open-with-orden response format");
        }
      } else {
        console.warn(`CatOrden open-with-orden unavailable (status: ${catOrdenResponse.status})`);
      }
    } catch (catOrdenError) {
      console.warn("Failed to fetch CatOrden open-with-orden:", catOrdenError);
    }

    // Create missing SAP POs in Supabase so they behave like regular editable rows.
    const existingPONumbers = new Set(
      (ordersData || [])
        .map((order: any) => normalizePoKey(order.po_number))
        .filter(Boolean)
    );
    const sapItems = Object.values(catOrdenByPO).filter((item) => normalizePoKey(item.u_PO2));
    const missingSapItems = sapItems.filter((item) => !existingPONumbers.has(normalizePoKey(item.u_PO2)));

    if (missingSapItems.length > 0 && isAdmin) {
      const sapProductKeys = Array.from(
        new Set(
          missingSapItems
            .map((item) => (item.clave || "").trim())
            .filter(Boolean)
        )
      );

      const productIdByKey = new Map<string, string>();
      if (sapProductKeys.length > 0) {
        const [byPtCode, byCodigoProducto] = await Promise.all([
          supabase.from("products").select("id, pt_code").in("pt_code", sapProductKeys),
          supabase.from("products").select("id, codigo_producto").in("codigo_producto", sapProductKeys),
        ]);

        (byPtCode.data || []).forEach((p: any) => {
          if (p.pt_code) productIdByKey.set(String(p.pt_code).trim().toUpperCase(), p.id);
        });
        (byCodigoProducto.data || []).forEach((p: any) => {
          if (p.codigo_producto) productIdByKey.set(String(p.codigo_producto).trim().toUpperCase(), p.id);
        });
      }

      const sapInserts = missingSapItems.map((item) => {
        const poNumber = item.u_PO2!.trim();
        const sapCantidad = parseApiNumber(item.cantidad);
        const sapPrecio = parseApiNumber(item.precio);
        const quantity = sapCantidad !== null ? sapCantidad * 1000 : 0;
        const totalPrice = sapCantidad !== null && sapPrecio !== null ? sapCantidad * sapPrecio : null;
        const salesOrderNumber =
          item.pedido !== null && item.pedido !== undefined ? String(item.pedido) : null;
        const productKey = (item.clave || "").trim().toUpperCase();
        const productId = productKey ? productIdByKey.get(productKey) || null : null;

        return {
          po_number: poNumber,
          quantity,
          price_per_thousand: sapPrecio,
          total_price: totalPrice,
          status: salesOrderNumber ? "accepted" : "submitted",
          product_id: productId,
          sales_order_number: salesOrderNumber,
          user_id: user.id,
        };
      });

      const { error: upsertSapError } = await supabase
        .from("purchase_orders")
        .upsert(sapInserts, { onConflict: "po_number", ignoreDuplicates: true });

      if (upsertSapError) {
        console.error("Error syncing SAP purchase orders:", upsertSapError);
      } else {
        const { data: refreshedOrdersData, error: refreshedOrdersError } = await supabase
          .from("purchase_orders")
          .select(purchaseOrdersSelect)
          .order("created_at", { ascending: false });

        if (!refreshedOrdersError && refreshedOrdersData) {
          ordersData = refreshedOrdersData;
        }
      }
    }

    const combinedOrdersSource = ordersData || [];

    const salesOrderNumbers = combinedOrdersSource
      .map((o: any) => o.sales_order_number)
      .filter((son: unknown): son is string => typeof son === "string" && son.trim() !== "");

    const poNumbers = combinedOrdersSource
      .map((o: any) => o.po_number)
      .filter((po: unknown): po is string => typeof po === "string" && po.trim() !== "");

    let inventoryByPO: Record<string, { inFloor: number; shipped: number; palletIds: Set<string> }> = {};
    let loadDetailsByPO: Record<string, LoadDetail[]> = {};
    let shippedLoadDetailsByPO: Record<string, ShippedLoadDetail[]> = {};
    let shippedTraceability: Record<string, Set<string>> = {};

    const salesOrderToPO: Record<string, string> = {};
    combinedOrdersSource.forEach((order: any) => {
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
        .select("id, bfx_order, quantity, traceability")
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
          if (!shippedTraceability[poNum]) {
            shippedTraceability[poNum] = new Set();
          }
          const traceKey = pallet.traceability || pallet.id;
          if (!shippedTraceability[poNum].has(traceKey)) {
            shippedTraceability[poNum].add(traceKey);
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
          traceability,
          load_id,
          delivery_date,
          shipped_at
        `)
        .in("customer_lot", poNumbers);

      if (!shippedByLotError && shippedByLotData) {
        shippedByLotData.forEach((pallet: any) => {
          const poNum = pallet.customer_lot;
          if (!poNum) return;
          if (!inventoryByPO[poNum]) {
            inventoryByPO[poNum] = { inFloor: 0, shipped: 0, palletIds: new Set() };
          }
          if (!shippedTraceability[poNum]) {
            shippedTraceability[poNum] = new Set();
          }
          const traceKey = pallet.traceability || pallet.id;
          if (!shippedTraceability[poNum].has(traceKey)) {
            shippedTraceability[poNum].add(traceKey);
            inventoryByPO[poNum].shipped += pallet.quantity || 0;
          }
        });
      }
    }

    const ptCodes = combinedOrdersSource
      .map((o: any) => o.products?.codigo_producto || o.products?.pt_code)
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

    // Admin-only: link orders without product_id to products using SAP clave data
    if (isAdmin && Object.keys(catOrdenByPO).length > 0) {
      const ordersWithoutProduct = combinedOrdersSource.filter(
        (o: any) => !o.product_id && catOrdenByPO[normalizePoKey(o.po_number)]?.clave
      );

      if (ordersWithoutProduct.length > 0) {
        const sapClaves = Array.from(
          new Set(
            ordersWithoutProduct
              .map((o: any) => (catOrdenByPO[normalizePoKey(o.po_number)]?.clave || "").trim())
              .filter(Boolean)
          )
        );

        if (sapClaves.length > 0) {
          const [byPtCode2, byCodigoProducto2] = await Promise.all([
            supabase.from("products").select("id, pt_code").in("pt_code", sapClaves),
            supabase.from("products").select("id, codigo_producto").in("codigo_producto", sapClaves),
          ]);

          const linkMap = new Map<string, string>();
          (byPtCode2.data || []).forEach((p: any) => {
            if (p.pt_code) linkMap.set(String(p.pt_code).trim().toUpperCase(), p.id);
          });
          (byCodigoProducto2.data || []).forEach((p: any) => {
            if (p.codigo_producto) linkMap.set(String(p.codigo_producto).trim().toUpperCase(), p.id);
          });

          const updatePromises = ordersWithoutProduct
            .map((o: any) => {
              const clave = (catOrdenByPO[normalizePoKey(o.po_number)]?.clave || "").trim().toUpperCase();
              const productId = linkMap.get(clave);
              if (productId) {
                return supabase
                  .from("purchase_orders")
                  .update({ product_id: productId })
                  .eq("id", o.id);
              }
              return null;
            })
            .filter(Boolean);

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            // Refresh to get updated product joins
            const { data: refreshedData } = await supabase
              .from("purchase_orders")
              .select(purchaseOrdersSelect)
              .order("created_at", { ascending: false });
            if (refreshedData) {
              ordersData = refreshedData;
            }
          }
        }
      }
    }

    // Admin-only: update existing POs missing price_per_thousand with SAP data
    if (isAdmin && Object.keys(catOrdenByPO).length > 0) {
      const ordersSource = ordersData || combinedOrdersSource;
      const ordersMissingPrice = ordersSource.filter(
        (o: any) => (o.price_per_thousand === null || o.price_per_thousand === undefined || o.price_per_thousand === 0) && catOrdenByPO[normalizePoKey(o.po_number)]?.precio
      );

      if (ordersMissingPrice.length > 0) {
        const priceUpdatePromises = ordersMissingPrice
          .map((o: any) => {
            const sapPrecio = parseApiNumber(catOrdenByPO[normalizePoKey(o.po_number)]?.precio);
            if (sapPrecio !== null && sapPrecio > 0) {
              const sapCantidad = parseApiNumber(catOrdenByPO[normalizePoKey(o.po_number)]?.cantidad);
              const totalPrice = sapCantidad !== null ? sapCantidad * sapPrecio : null;
              return supabase
                .from("purchase_orders")
                .update({ price_per_thousand: sapPrecio, total_price: totalPrice })
                .eq("id", o.id);
            }
            return null;
          })
          .filter(Boolean);

        if (priceUpdatePromises.length > 0) {
          await Promise.all(priceUpdatePromises);
        }
      }
    }

    const finalOrdersSource = ordersData || combinedOrdersSource;
    const formattedOrders = finalOrdersSource.map((order: any) => {
      const catOrdenItem = catOrdenByPO[normalizePoKey(order.po_number)];
      const apiCantidad = parseApiNumber(catOrdenItem?.cantidad);
      const apiPrecio = parseApiNumber(catOrdenItem?.precio);
      const quantityFromApi = apiCantidad !== null ? apiCantidad * 1000 : null;
      const totalPriceFromApi = parseApiNumber(catOrdenItem?.value) ??
        (apiCantidad !== null && apiPrecio !== null ? apiCantidad * apiPrecio : null);
      const salesOrderFromApi =
        catOrdenItem?.pedido !== null && catOrdenItem?.pedido !== undefined
          ? String(catOrdenItem.pedido)
          : null;
      const mergedQuantity = quantityFromApi ?? order.quantity;
      const mergedSalesOrder = salesOrderFromApi || order.sales_order_number || null;
      const stats = inventoryByPO[order.po_number] || { inFloor: 0, shipped: 0 };
      const hasSalesOrder = Boolean(mergedSalesOrder && mergedSalesOrder.trim() !== "" && order.po_number);
      const sapRequested = parseApiNumber(catOrdenItem?.cantidadSolicitada) ?? mergedQuantity;
      const sapShipped = parseApiNumber(catOrdenItem?.cantidadEnviada);
      const sapAssignedStock = sumWarehouseQty(catOrdenItem?.detallesAlmacen);
      const sapOtherStock = sumWarehouseQty(catOrdenItem?.detallesAlmacenTotal);
      const sapStockAvailable = parseApiNumber(catOrdenItem?.totalStockDisponible) ?? (sapAssignedStock + sapOtherStock);
      const hasSapWarehouseData =
        Boolean(catOrdenItem) &&
        (sapShipped !== null ||
          sapRequested !== null ||
          sapAssignedStock > 0 ||
          sapOtherStock > 0 ||
          parseApiNumber(catOrdenItem?.totalStockDisponible) !== null);

      const effectiveInFloor = hasSapWarehouseData ? sapAssignedStock : (hasSalesOrder ? 0 : stats.inFloor);
      const effectiveShipped = hasSapWarehouseData ? (sapShipped ?? 0) : (hasSalesOrder ? 0 : stats.shipped);
      const produced = effectiveInFloor + effectiveShipped;
      const requestedForProgress = hasSapWarehouseData ? (sapRequested ?? mergedQuantity) : mergedQuantity;
      const pending = Math.max(0, requestedForProgress - effectiveShipped);
      const percentProduced = requestedForProgress > 0 ? Math.round((effectiveShipped / requestedForProgress) * 100) : 0;
      const loadDetails = loadDetailsByPO[order.po_number] || [];
      const shippedLoadDetails = shippedLoadDetailsByPO[order.po_number] || [];
      const productSkuForInventory = order.products?.codigo_producto || order.products?.pt_code || null;
      const excessStockFromInventory = productSkuForInventory ? excessStockByPT[productSkuForInventory] || null : null;
      const excessStockFromSap =
        hasSapWarehouseData && sapStockAvailable > pending
          ? {
              pallet_count: (catOrdenItem?.detallesAlmacen?.length || 0) + (catOrdenItem?.detallesAlmacenTotal?.length || 0),
              total_quantity: Math.max(0, sapStockAvailable - pending),
            }
          : null;
      const excessStock = excessStockFromSap ?? excessStockFromInventory;
      const productPtCode = (order.products as any)?.codigo_producto || (order.products as any)?.pt_code || null;
      const productTipoEmpaque = catOrdenItem?.tipoEmpaque || order.products?.tipo_empaque || null;
      const derivedProductItemType =
        order.products?.item_type ||
        mapProductLineToItemType((order.products as any)?.product_line) ||
        mapProductLineToItemType(mapTipoEmpaqueToProductLine(productTipoEmpaque));

      return {
        id: order.id,
        po_number: order.po_number,
        product_id: order.product_id || null,
        product_name: catOrdenItem?.producto || catOrdenItem?.frgnName || order.products?.name || null,
        product_pt_code: catOrdenItem?.clave || productPtCode,
        product_customer: catOrdenItem?.u_Cl1 || order.products?.customer || null,
        product_item_type: derivedProductItemType,
        product_tipo_empaque: productTipoEmpaque,

        product_dp_sales_csr: order.products?.dp_sales_csr_names || null,
        product_customer_item: catOrdenItem?.u_ItemNo || order.products?.customer_item || null,
        product_item_description: catOrdenItem?.frgnName || order.products?.item_description || null,
        quantity: requestedForProgress,
        total_price: totalPriceFromApi ?? order.total_price,
        status: order.status,
        is_hot_order: order.is_hot_order,
        hot_order_priority: order.hot_order_priority ?? null,
        do_not_delay: order.do_not_delay ?? false,
        requested_delivery_date: order.requested_delivery_date,
        estimated_delivery_date: order.estimated_delivery_date,
        printing_date: order.printing_date || null,
        conversion_date: order.conversion_date || null,
        order_document_date: catOrdenItem?.fechaDocumento || null,
        order_due_date: catOrdenItem?.fechaVencimiento || null,
        order_timing_status: catOrdenItem?.estadoTiempo || null,
        created_at: order.created_at,
        pdf_url: order.pdf_url,
        sales_order_number: mergedSalesOrder,
        accepted_at: order.accepted_at || null,
        inventoryStats: {
          inFloor: effectiveInFloor,
          shipped: effectiveShipped,
          pending,
          percentProduced,
          loadDetails,
          shippedLoadDetails,
          excessStock,
          sapStockAvailable: hasSapWarehouseData ? sapStockAvailable : null,
          sapVerificationLoading: false,
        },
      };
    });
    return formattedOrders;
  };

  const {
    data: orders = [] as Order[],
    isLoading: loading,
    isFetching,
    refetch: refetchOrders,
    error: ordersError,
  } = useQuery<Order[]>({
    queryKey: ["purchase-orders", user?.id, isAdmin],
    queryFn: fetchOrders,
    enabled: !!user,
    staleTime: 5_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  if (ordersError) {
    console.error("Error fetching orders:", ordersError);
  }

  const {
    data: recentClosedSapOrders = [] as CatOrdenClosedItem[],
    isFetching: fetchingRecentClosedSap,
  } = useQuery<CatOrdenClosedItem[]>({
    queryKey: ["purchase-orders-closed-last-15-days"],
    enabled: showRecentClosedSap && !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch(CAT_ORDEN_CLOSED_WITH_ORDEN_ENDPOINT, {
        method: "GET",
        headers: { accept: "*/*" },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Closed orders fetch failed with status ${response.status}`);
      }

      const payload = await response.json();
      const list: CatOrdenClosedItem[] = Array.isArray(payload) ? payload : [];
      const now = Date.now();
      const fifteenDaysAgo = now - (15 * 24 * 60 * 60 * 1000);

      return list
        .filter((item) => {
          if (!item.fechaDocumento) return false;
          const ts = new Date(item.fechaDocumento).getTime();
          return Number.isFinite(ts) && ts >= fifteenDaysAgo && ts <= now;
        })
        .sort((a, b) => {
          const dateA = a.fechaDocumento ? new Date(a.fechaDocumento).getTime() : 0;
          const dateB = b.fechaDocumento ? new Date(b.fechaDocumento).getTime() : 0;
          return dateB - dateA;
        });
    },
  });

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

  const syncOrdersFromSap = async () => {
    setSyncingOrders(true);
    try {
      const response = await fetch(SAP_ORDERS_SYNC_ENDPOINT, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Orders sync failed with status ${response.status}`);
      }

      const payload = (await response.json()) as SyncOrdersResponse;
      await refetchOrders();

      toast.success(
        `Ordenes sincronizadas. Insertadas: ${payload.inserted ?? 0}, actualizadas: ${payload.updated_po ?? 0}`
      );
    } catch (error) {
      console.error("Error syncing purchase orders:", error);
      toast.error("No fue posible sincronizar las ordenes");
    } finally {
      setSyncingOrders(false);
    }
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
    const hasAnyAvailability = (order: Order) => {
      const inFloor = order.inventoryStats.inFloor || 0;
      const shipped = order.inventoryStats.shipped || 0;
      const stockAvailable = order.inventoryStats.sapStockAvailable || 0;
      const excess = order.inventoryStats.excessStock?.total_quantity || 0;
      return inFloor > 0 || shipped > 0 || stockAvailable > 0 || excess > 0;
    };

    let result = orders.filter((order) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = order.po_number.toLowerCase().includes(q) ||
                           (order.product_name?.toLowerCase().includes(q) ?? false) ||
                           (order.sales_order_number?.toLowerCase().includes(q) ?? false);
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
    } else {
      result = [...result].sort((a, b) => {
        const aAccepted = a.status === "accepted" ? 0 : 1;
        const bAccepted = b.status === "accepted" ? 0 : 1;
        if (aAccepted !== bAccepted) return aAccepted - bAccepted;

        const aHasAvailability = hasAnyAvailability(a) ? 0 : 1;
        const bHasAvailability = hasAnyAvailability(b) ? 0 : 1;
        if (aHasAvailability !== bHasAvailability) return aHasAvailability - bHasAvailability;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
  
  const orderIdByPoNumber = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      const key = normalizePoKey(order.po_number);
      if (key) {
        map.set(key, order.id);
      }
    });
    return map;
  }, [orders]);

  const combinedClosedOrders = useMemo(() => {
    const rows: Array<
      | { kind: "supabase"; key: string; poKey: string; order: Order }
      | { kind: "sap"; key: string; poKey: string; order: CatOrdenClosedItem }
    > = [];
    const seen = new Set<string>();

    closedOrders.forEach((order) => {
      const poKey = normalizePoKey(order.po_number);
      const key = poKey || order.id;
      seen.add(key);
      rows.push({ kind: "supabase", key, poKey, order });
    });

    if (showRecentClosedSap) {
      recentClosedSapOrders.forEach((order, index) => {
        const poKey = normalizePoKey(order.u_PO2);
        const key = poKey || `sap-closed-${index}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ kind: "sap", key, poKey, order });
      });
    }

    return rows.sort((a, b) => {
      const dateA =
        a.kind === "supabase"
          ? new Date(a.order.created_at).getTime()
          : (a.order.fechaDocumento ? new Date(a.order.fechaDocumento).getTime() : 0);
      const dateB =
        b.kind === "supabase"
          ? new Date(b.order.created_at).getTime()
          : (b.order.fechaDocumento ? new Date(b.order.fechaDocumento).getTime() : 0);
      return dateB - dateA;
    });
  }, [closedOrders, recentClosedSapOrders, showRecentClosedSap]);

  const boardOrders = useMemo(() => {
    const mappedClosedOrders: Order[] = combinedClosedOrders.map((row) => {
      if (row.kind === "supabase") {
        return row.order;
      }

      const order = row.order;
      const quantity = parseApiNumber(order.cantidadSolicitada) ?? ((parseApiNumber(order.cantidad) ?? 0) * 1000);
      const salesOrderNumber =
        order.pedido !== null && order.pedido !== undefined ? String(order.pedido) : null;

      return {
        id: `sap-closed-${row.poKey || salesOrderNumber || order.u_ItemNo || "order"}`,
        po_number: order.u_PO2 || "—",
        product_id: null,
        product_name: order.frgnName || order.producto || null,
        product_pt_code: order.clave || null,
        product_customer: order.u_Cl1 || null,
        product_item_type: null,
        product_tipo_empaque: order.tipoEmpaque || null,
        product_dp_sales_csr: null,
        product_customer_item: order.u_ItemNo || null,
        product_item_description: order.frgnName || order.producto || null,
        quantity,
        total_price: order.value ?? null,
        status: "closed",
        is_hot_order: false,
        hot_order_priority: null,
        do_not_delay: false,
        requested_delivery_date: order.fechaVencimiento || null,
        estimated_delivery_date: null,
        printing_date: null,
        conversion_date: null,
        order_document_date: order.fechaDocumento || null,
        order_due_date: order.fechaVencimiento || null,
        order_timing_status: order.estadoTiempo || null,
        created_at: order.fechaDocumento || new Date().toISOString(),
        pdf_url: null,
        sales_order_number: salesOrderNumber,
        accepted_at: null,
        closed_source: "sap",
        closed_sap_payload: order,
        inventoryStats: {
          inFloor: 0,
          shipped: parseApiNumber(order.cantidadEnviada) ?? 0,
          pending: 0,
          percentProduced: 100,
          loadDetails: [],
          shippedLoadDetails: [],
          excessStock: null,
          sapStockAvailable: null,
          sapVerificationLoading: false,
        },
      };
    });

    return [...activeOrders, ...mappedClosedOrders];
  }, [activeOrders, combinedClosedOrders]);

  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [selectedClosedSapOrder, setSelectedClosedSapOrder] = useState<CatOrdenClosedItem | null>(null);

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
      refetchOrders();
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
              {t('page.orders.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t('page.orders.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={isAdmin ? syncOrdersFromSap : () => refetchOrders()}
              disabled={isAdmin ? syncingOrders : isFetching}
              className="gap-1.5"
            >
              <RotateCcw className={cn("h-3.5 w-3.5", (isAdmin ? syncingOrders : isFetching) && "animate-spin")} />
              {isAdmin ? "Sincronizar ordenes" : "Refresh"}
            </Button>
            {isAdmin && <BulkOrdersManager onUpdated={refetchOrders} />}
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
              placeholder="Search by PO number, product, or sales order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showRecentClosedSap ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRecentClosedSap((prev) => !prev)}
              className="gap-1.5"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              Closed POs · Last 2 Weeks
            </Button>
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
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "timeline" | "board" | "canvas")} className="w-auto">
              <TabsList>
                {(isAdmin || isInternalUser) && (
                  <TabsTrigger value="board" className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Board
                  </TabsTrigger>
                )}
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="canvas" className="gap-2">
                  <Package className="h-4 w-4" />
                  Canvas
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

        {/* Board View - grouped by tipo_empaque */}
        {!loading && viewMode === "board" && (
          <OrdersCanvas
            orders={boardOrders}
            groupBy="product_tipo_empaque"
            onClosedSapOrderClick={(order) => setSelectedClosedSapOrder(order)}
            closedFirst={showRecentClosedSap}
          />
        )}

        {/* Canvas View - grouped by item_type */}
        {!loading && viewMode === "canvas" && (
          <OrdersCanvas orders={activeOrders} groupBy="product_item_type" />
        )}

        {/* Active & Closed Orders Tables (order swaps when showRecentClosedSap is on) */}
        {!loading && viewMode === "list" && (
          <div className="flex flex-col gap-8">

        {/* Active Orders Table */}
        <div style={{ order: showRecentClosedSap ? 2 : 1 }}>
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
                          onUpdated={refetchOrders}
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
        </div>

        {/* Closed Orders Table */}
        {(closedOrders.length > 0 || showRecentClosedSap) && (
          <div style={{ order: showRecentClosedSap ? 1 : 2 }}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-success" />
              <h2 className="text-lg font-semibold">Closed POs</h2>
              {!fetchingRecentClosedSap && (
                <span className="text-sm text-muted-foreground">({combinedClosedOrders.length})</span>
              )}
            </div>

            {fetchingRecentClosedSap ? (
              <div className="flex items-center justify-center rounded-xl border bg-card py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : combinedClosedOrders.length > 0 ? (
              <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: "0.3s" }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">PO Number</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Sales Order</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Item Code</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Product</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Quantity</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Document Date</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Timing</th>
                        {isAdmin && (
                          <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {combinedClosedOrders.map((row) => {
                        if (row.kind === "supabase") {
                          const order = row.order;
                          return (
                            <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                              <td className="whitespace-nowrap px-6 py-4">
                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-muted">
                                  Closed
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <Link
                                  to={`/orders/${order.id}`}
                                  className="font-mono text-sm font-medium text-primary hover:underline"
                                >
                                  {order.po_number}
                                </Link>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                {order.sales_order_number || "—"}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                {order.product_customer_item || "—"}
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {[order.product_customer_item, order.product_item_description].filter(Boolean).join(" - ") || order.product_name || "—"}
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {order.product_customer || "—"}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                {order.quantity.toLocaleString()} units
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                {formatDate(order.order_document_date || order.requested_delivery_date)}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                {order.order_timing_status || "—"}
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
                          );
                        }

                        const order = row.order;
                        const existingOrderId = row.poKey ? orderIdByPoNumber.get(row.poKey) : undefined;
                        const quantity = parseApiNumber(order.cantidadSolicitada) ?? ((parseApiNumber(order.cantidad) ?? 0) * 1000);

                        return (
                          <tr
                            key={row.key}
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => setSelectedClosedSapOrder(order)}
                          >
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-muted">
                                Closed
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              {existingOrderId ? (
                                <Link
                                  to={`/orders/${existingOrderId}`}
                                  className="font-mono text-sm font-medium text-primary hover:underline"
                                >
                                  {order.u_PO2 || "—"}
                                </Link>
                              ) : (
                                <span className="font-mono text-sm font-medium">{order.u_PO2 || "—"}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                              {order.pedido !== null && order.pedido !== undefined ? String(order.pedido) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                              {order.u_ItemNo || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {order.frgnName || order.producto || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {order.u_Cl1 || "—"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                              {quantity ? quantity.toLocaleString() : "—"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                              {formatDate(order.fechaDocumento || null)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                              {order.estadoTiempo || "—"}
                            </td>
                            {isAdmin && <td className="whitespace-nowrap px-6 py-4 text-right" />}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-10">
                <PackageCheck className="h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-3 text-base font-semibold text-foreground">No hay ordenes cerradas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No se encontraron ordenes cerradas para mostrar.
                </p>
              </div>
            )}
          </div>
          </div>
        )}
          </div>
        )}

        {/* Dialogs */}
        {selectedOrder && (
          <>
            <AcceptOrderDialog
              open={acceptDialogOpen}
              onOpenChange={setAcceptDialogOpen}
              order={selectedOrder}
              onAccepted={refetchOrders}
            />
            <ChangeRequestDialog
              open={changeRequestDialogOpen}
              onOpenChange={setChangeRequestDialogOpen}
              order={selectedOrder}
              onSubmitted={refetchOrders}
            />
          </>
        )}

        {/* Closed SAP Order Detail Sheet */}
        <Sheet open={!!selectedClosedSapOrder} onOpenChange={(open) => { if (!open) setSelectedClosedSapOrder(null); }}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedClosedSapOrder && (
              <>
                <SheetHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-muted">
                      Closed
                    </span>
                    {selectedClosedSapOrder.estadoTiempo && (
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        selectedClosedSapOrder.estadoTiempo === "A Tiempo"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        {selectedClosedSapOrder.estadoTiempo}
                      </span>
                    )}
                  </div>
                  <SheetTitle className="text-xl mt-1">
                    PO {selectedClosedSapOrder.u_PO2 || "—"}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">Sales Order #{selectedClosedSapOrder.pedido ?? "—"}</p>
                </SheetHeader>

                <div className="space-y-6">
                  {/* Customer & Vendor */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Customer</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Company</p>
                        <p className="font-medium">{selectedClosedSapOrder.cliente || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Customer</p>
                        <p className="font-medium">{selectedClosedSapOrder.u_Cl1 || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Sales Rep</p>
                        <p className="font-medium">{selectedClosedSapOrder.vendedor || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Product */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Tag className="h-4 w-4" /> Product</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Item No.</p>
                        <p className="font-medium font-mono">{selectedClosedSapOrder.u_ItemNo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Clave</p>
                        <p className="font-medium font-mono">{selectedClosedSapOrder.clave || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Product (SAP)</p>
                        <p className="font-medium">{selectedClosedSapOrder.producto || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Foreign Name</p>
                        <p className="font-medium">{selectedClosedSapOrder.frgnName || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Packaging</p>
                        <p className="font-medium">{selectedClosedSapOrder.tipoEmpaque || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Unit</p>
                        <p className="font-medium">{selectedClosedSapOrder.unidad || selectedClosedSapOrder.claveUnidad || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quantities & Pricing */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Box className="h-4 w-4" /> Quantities & Pricing</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Qty Requested</p>
                        <p className="font-medium">{parseApiNumber(selectedClosedSapOrder.cantidadSolicitada)?.toLocaleString() ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Qty Sent</p>
                        <p className="font-medium">{parseApiNumber(selectedClosedSapOrder.cantidadEnviada)?.toLocaleString() ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Delivered</p>
                        <p className="font-medium">{parseApiNumber(selectedClosedSapOrder.entregado)?.toLocaleString() ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Cantidad</p>
                        <p className="font-medium">{parseApiNumber(selectedClosedSapOrder.cantidad)?.toLocaleString() ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Price / unit</p>
                        <p className="font-medium">{selectedClosedSapOrder.precio != null ? `$${selectedClosedSapOrder.precio}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Total Value</p>
                        <p className="font-medium">{selectedClosedSapOrder.value != null ? `$${selectedClosedSapOrder.value.toLocaleString()}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Costo</p>
                        <p className="font-medium">{selectedClosedSapOrder.costo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Imp. RL</p>
                        <p className="font-medium">{selectedClosedSapOrder.u_ImpRl || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Dates</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Document Date</p>
                        <p className="font-medium">{formatDate(selectedClosedSapOrder.fechaDocumento || null)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Due Date</p>
                        <p className="font-medium">{formatDate(selectedClosedSapOrder.fechaVencimiento || null)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Days Remaining</p>
                        <p className="font-medium">{selectedClosedSapOrder.diasRestantes ?? "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Details */}
                  {selectedClosedSapOrder.detallesAlmacen && selectedClosedSapOrder.detallesAlmacen.length > 0 && (
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Warehouse Details</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              {Object.keys(selectedClosedSapOrder.detallesAlmacen[0]).map((key) => (
                                <th key={key} className="px-2 py-1.5 text-left text-muted-foreground font-medium capitalize">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedClosedSapOrder.detallesAlmacen.map((row, i) => (
                              <tr key={i} className="hover:bg-muted/20">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-2 py-1.5 text-muted-foreground">{val != null ? String(val) : "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Warehouse Totals */}
                  {selectedClosedSapOrder.detallesAlmacenTotal && selectedClosedSapOrder.detallesAlmacenTotal.length > 0 && (
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Warehouse Totals</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              {Object.keys(selectedClosedSapOrder.detallesAlmacenTotal[0]).map((key) => (
                                <th key={key} className="px-2 py-1.5 text-left text-muted-foreground font-medium capitalize">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedClosedSapOrder.detallesAlmacenTotal.map((row, i) => (
                              <tr key={i} className="hover:bg-muted/20">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-2 py-1.5 text-muted-foreground">{val != null ? String(val) : "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}

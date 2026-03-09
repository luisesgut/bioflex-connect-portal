import { useState, useEffect } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileText,
  Flame,
  Package,
  Truck,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  CalendarIcon,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { POActivityTimeline } from "@/components/orders/POActivityTimeline";
import { POComments } from "@/components/orders/POComments";
import { EditOrderDialog } from "@/components/orders/EditOrderDialog";
import { AcceptOrderDialog } from "@/components/orders/AcceptOrderDialog";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";




interface OrderDetails {
  id: string;
  po_number: string;
  po_date: string;
  quantity: number;
  total_price: number | null;
  price_per_thousand: number | null;
  status: string;
  is_hot_order: boolean;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  printing_date: string | null;
  conversion_date: string | null;
  created_at: string;
  accepted_at: string | null;
  updated_at: string;
  pdf_url: string | null;
  notes: string | null;
  sales_order_number: string | null;
  pallets_needed: number | null;
  product: {
    name: string;
    customer: string | null;
    item_type: string | null;
    tipo_empaque: string | null;
    customer_item: string | null;
    item_description: string | null;
    dp_sales_csr_names: string | null;
    codigo_producto: string | null;
    pt_code: string | null;
    pieces_per_pallet: number | null;
    pc_number: string | null;
    print_card_url: string | null;
    customer_tech_spec_url: string | null;
    bfx_spec_url: string | null;
  } | null;
}

interface StockWarehouseDetail {
  lote: string;
  cantidad: number;
  pesoBruto: number;
  pesoNeto: number;
  cajas: number;
  fecha?: string | null;
  bfx_order?: string | null;
  po_number?: string | null;
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
  totalStockDisponible?: number | string | null;
  detallesAlmacen?: StockWarehouseDetail[] | null;
  detallesAlmacenTotal?: StockWarehouseDetail[] | null;
}

interface StockVerificationItem {
  claveProducto: string;
  producto: string;
  cantidadSolicitada: number;
  unidadSolicitada: string;
  cantidadEnviada: number;
  cantidadPendiente: number;
  porcentajeEnviado: number;
  puedeCompletarOrden: boolean;
  detallesAlmacen: StockWarehouseDetail[];
  detallesAlmacenTotal?: StockWarehouseDetail[];
  totalStockDisponible?: number;
  stockAsignadoPO?: number;
  stockOtrasPOs?: number;
}

const CAT_ORDEN_OPEN_WITH_ORDEN_ENDPOINT = "http://172.16.10.31/api/CatOrden/open-with-orden";


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
  if (/^\d+$/.test(compact)) return String(Number(compact));
  return compact;
};

const sumWarehouseQty = (details?: StockWarehouseDetail[] | null): number =>
  (details || []).reduce((sum, lot) => sum + (parseApiNumber(lot?.cantidad) || 0), 0);


const statusStyles: Record<string, string> = {
  pending: "bg-info/10 text-info border-info/20",
  submitted: "bg-info/10 text-info border-info/20",
  accepted: "bg-success/10 text-success border-success/20",
  "in-production": "bg-warning/10 text-warning border-warning/20",
  shipped: "bg-accent/10 text-accent border-accent/20",
  delivered: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-muted",
  "pending-hot-approval": "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  pending: "Submitted",
  submitted: "Submitted",
  accepted: "Accepted",
  "in-production": "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
  closed: "Closed",
  "pending-hot-approval": "Pending Hot Order Approval",
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [sapOrderData, setSapOrderData] = useState<CatOrdenOpenItem | null>(null);
  const [stockVerification, setStockVerification] = useState<StockVerificationItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [togglingHot, setTogglingHot] = useState(false);
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [savingDeliveryDate, setSavingDeliveryDate] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState<Date | undefined>(undefined);
  const [pendingHotRequest, setPendingHotRequest] = useState<{ id: string; reason: string; created_at: string } | null>(null);
  const [reviewingHot, setReviewingHot] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
      fetchPendingHotRequest();
    }
  }, [id]);

  const fetchPendingHotRequest = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("order_change_requests")
      .select("id, reason, created_at")
      .eq("purchase_order_id", id)
      .eq("request_type", "hot_order" as any)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.error("Error fetching pending hot request:", error);
    setPendingHotRequest(data || null);
  };

  const handleReviewHotOrder = async (approved: boolean) => {
    if (!pendingHotRequest || !order) return;
    setReviewingHot(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("order_change_requests")
        .update({
          status: approved ? "approved" : "rejected",
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", pendingHotRequest.id);
      if (updateError) throw updateError;

      if (approved) {
        const { error: poError } = await supabase
          .from("purchase_orders")
          .update({ is_hot_order: true })
          .eq("id", order.id);
        if (poError) throw poError;
        setOrder({ ...order, is_hot_order: true });
      }

      toast.success(approved ? "Hot Order approved" : "Hot Order request rejected");
      setPendingHotRequest(null);
    } catch (error) {
      console.error("Error reviewing hot order:", error);
      toast.error("Failed to process request");
    }
    setReviewingHot(false);
  };

  useEffect(() => {
    if (!order?.po_number) {
      setSapOrderData(null);
      setStockVerification([]);
      setStockError(null);
      setStockLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchStockVerification = async () => {
      setStockLoading(true);
      setStockError(null);

      try {
        // Fetch order data from SAP and inventory dates from database in parallel
        const [orderResponse, sapInvResult, poResult] = await Promise.all([
          fetch(CAT_ORDEN_OPEN_WITH_ORDEN_ENDPOINT, {
            method: "GET",
            headers: { accept: "*/*" },
            signal: controller.signal,
          }),
          supabase.from('sap_inventory').select('traceability, fecha, bfx_order'),
          supabase.from('purchase_orders').select('po_number, sales_order_number'),
        ]);

        // Build maps of lote -> fecha and lote -> bfx_order from the database
        let fechaByLote: Record<string, string> = {};
        let bfxOrderByLote: Record<string, string> = {};
        if (sapInvResult.data) {
          for (const item of sapInvResult.data) {
            if (item.traceability) {
              if (item.fecha && !fechaByLote[item.traceability]) {
                fechaByLote[item.traceability] = item.fecha;
              }
              if (item.bfx_order && !bfxOrderByLote[item.traceability]) {
                bfxOrderByLote[item.traceability] = item.bfx_order;
              }
            }
          }
        }

        // Build map of sales_order_number -> po_number
        let poBySONumber: Record<string, string> = {};
        if (poResult.data) {
          for (const po of poResult.data) {
            if (po.sales_order_number && po.po_number) {
              poBySONumber[po.sales_order_number] = po.po_number;
            }
          }
        }

        if (!orderResponse.ok) {
          throw new Error(`HTTP ${orderResponse.status}`);
        }

        const payload = await orderResponse.json();
        const list: CatOrdenOpenItem[] = Array.isArray(payload) ? payload : [];
        const sapItem =
          list.find((item) => normalizePoKey(item.u_PO2) === normalizePoKey(order.po_number)) || null;


        const enrichWithFecha = (details: StockWarehouseDetail[]): StockWarehouseDetail[] =>
          details.map((d) => {
            const bfxOrder = bfxOrderByLote[d.lote] || null;
            return {
              ...d,
              fecha: d.fecha || fechaByLote[d.lote] || null,
              bfx_order: bfxOrder,
              po_number: bfxOrder ? (poBySONumber[bfxOrder] || null) : null,
            };
          });

        setSapOrderData(sapItem);

        if (!sapItem) {
          setStockVerification([]);
          return;
        }

        const requested =
          parseApiNumber(sapItem.cantidadSolicitada) ??
          ((parseApiNumber(sapItem.cantidad) || 0) * 1000);
        const shipped = parseApiNumber(sapItem.cantidadEnviada) ?? 0;
        const pending = Math.max(0, requested - shipped);
        const lotsCurrent = enrichWithFecha(sapItem.detallesAlmacen || []);
        const lotsOther = enrichWithFecha(sapItem.detallesAlmacenTotal || []);
        const assignedFromLots = sumWarehouseQty(lotsCurrent);
        const otherFromLots = sumWarehouseQty(lotsOther);
        const totalStock =
          parseApiNumber(sapItem.totalStockDisponible) ?? (assignedFromLots + otherFromLots);
        const percent = requested > 0 ? (shipped / requested) * 100 : 0;

        setStockVerification([
          {
            claveProducto: sapItem.clave || order.product?.codigo_producto || order.product?.pt_code || "",
            producto: sapItem.producto || sapItem.frgnName || order.product?.name || "",
            cantidadSolicitada: requested,
            unidadSolicitada: "Units",
            cantidadEnviada: shipped,
            cantidadPendiente: pending,
            porcentajeEnviado: percent,
            puedeCompletarOrden: totalStock >= pending,
            detallesAlmacen: lotsCurrent,
            detallesAlmacenTotal: lotsOther,
            totalStockDisponible: totalStock,
            stockAsignadoPO: assignedFromLots,
            stockOtrasPOs: otherFromLots,
          },
        ]);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("Error loading SAP order details:", error);
        setStockError("Unable to verify stock for this order right now.");
      } finally {
        setStockLoading(false);
      }
    };

    fetchStockVerification();

    return () => {
      controller.abort();
    };
  }, [order?.po_number, order?.product?.codigo_producto, order?.product?.name, order?.product?.pt_code]);

  const fetchOrderDetails = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        id,
        po_number,
        po_date,
        quantity,
        total_price,
        price_per_thousand,
        status,
        is_hot_order,
        do_not_delay,
        requested_delivery_date,
        estimated_delivery_date,
        printing_date,
        conversion_date,
        created_at,
        accepted_at,
        updated_at,
        pdf_url,
        notes,
        sales_order_number,
        pallets_needed,
        products (
          name,
          sku,
          customer,
          item_type,
          tipo_empaque,
          customer_item,
          item_description,
          dp_sales_csr_names,
          codigo_producto,
          pt_code,
          pieces_per_pallet,
          print_card,
          print_card_url,
          customer_tech_spec_url,
          bfx_spec_url
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order details");
      navigate("/orders");
      return;
    }

    if (!data) {
      toast.error("Order not found");
      navigate("/orders");
      return;
    }

    const orderData: OrderDetails = {
      ...data,
      printing_date: data.printing_date || null,
      conversion_date: data.conversion_date || null,
      product: data.products as OrderDetails["product"],
    };
    setOrder(orderData);


    setLoading(false);
  };

  const handleToggleHotOrder = async () => {
    if (!order) return;
    // If order is already accepted and not yet hot, require change request approval
    const needsApproval = !order.is_hot_order && order.status !== "pending" && order.status !== "submitted";
    
    if (needsApproval) {
      setTogglingHot(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from("order_change_requests")
          .insert({
            purchase_order_id: order.id,
            request_type: "hot_order" as any,
            current_quantity: order.quantity,
            reason: "Customer requests Hot Order priority",
            requested_by: userData.user.id,
          });

        if (error) throw error;
        toast.success("Hot Order request submitted for admin approval");
        fetchPendingHotRequest();
      } catch (error) {
        console.error("Error submitting hot order request:", error);
        toast.error("Failed to submit hot order request");
      }
      setTogglingHot(false);
      return;
    }

    // Direct toggle for pending/submitted orders or removing hot order
    setTogglingHot(true);
    const newValue = !order.is_hot_order;
    const { error } = await supabase
      .from("purchase_orders")
      .update({ is_hot_order: newValue })
      .eq("id", order.id);
    if (error) {
      toast.error("Failed to update hot order status");
    } else {
      toast.success(newValue ? "Order marked as Hot Order" : "Hot Order status removed");
      setOrder({ ...order, is_hot_order: newValue });
    }
    setTogglingHot(false);
  };

  const handleSaveDeliveryDate = async () => {
    if (!order || !newDeliveryDate) return;
    setSavingDeliveryDate(true);
    const dateStr = format(newDeliveryDate, "yyyy-MM-dd");
    const { error } = await supabase
      .from("purchase_orders")
      .update({ requested_delivery_date: dateStr })
      .eq("id", order.id);
    if (error) {
      toast.error("Failed to update delivery date");
    } else {
      toast.success("Delivery date updated");
      setOrder({ ...order, requested_delivery_date: dateStr });
      setEditingDeliveryDate(false);
    }
    setSavingDeliveryDate(false);
  };


  const handleCloseOrder = async () => {
    if (!order) return;
    setClosing(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "closed" })
      .eq("id", order.id);
    if (error) {
      toast.error("Failed to close order");
    } else {
      toast.success("Order closed successfully");
      setOrder({ ...order, status: "closed" });
    }
    setClosing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBD";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return null;
  }

  const displaySalesOrder =
    sapOrderData?.pedido !== null && sapOrderData?.pedido !== undefined
      ? String(sapOrderData.pedido)
      : order.sales_order_number;
  const sapRequested =
    parseApiNumber(sapOrderData?.cantidadSolicitada) ??
    (() => {
      const sapBaseQty = parseApiNumber(sapOrderData?.cantidad);
      return sapBaseQty !== null ? sapBaseQty * 1000 : null;
    })();
  const displayQuantity = sapRequested ?? order.quantity;
  const displayTotalPrice =
    parseApiNumber(sapOrderData?.value) ??
    (() => {
      const c = parseApiNumber(sapOrderData?.cantidad);
      const p = parseApiNumber(sapOrderData?.precio);
      return c !== null && p !== null ? c * p : order.total_price;
    })();
  const displayPricePerThousand = parseApiNumber(sapOrderData?.precio) ?? order.price_per_thousand;
  const displayItemCode = sapOrderData?.u_ItemNo || order.product?.customer_item || "—";
  const displayItemDescription = sapOrderData?.frgnName || sapOrderData?.producto || order.product?.item_description || "—";
  const displayFinalCustomer = sapOrderData?.u_Cl1 || order.product?.customer || "—";
  const displayTipoEmpaque = sapOrderData?.tipoEmpaque || order.product?.tipo_empaque || "—";
  const displayPtCode = sapOrderData?.clave || order.product?.codigo_producto || order.product?.pt_code || "—";
  const displayProductName = sapOrderData?.producto || sapOrderData?.frgnName || order.product?.name || "—";

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/orders")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{order.po_number}</h1>
              {(() => {
                const displayStatus = pendingHotRequest ? "pending-hot-approval" : order.status;
                return (
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-3 py-1",
                      statusStyles[displayStatus] || statusStyles.pending
                    )}
                  >
                    {statusLabels[displayStatus] || order.status}
                  </Badge>
                );
              })()}
              {order.is_hot_order && (
                <Badge variant="destructive" className="gap-1">
                  <Flame className="h-3 w-3" />
                  Hot Order
                </Badge>
              )}
              {order.do_not_delay && (
                <Badge variant="secondary" className="gap-1">
                  Do Not Delay
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created on {formatDateTime(order.created_at)}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {(order.status === "pending" || order.status === "submitted") && (
                <Button
                  variant="default"
                  onClick={() => setAcceptDialogOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Accept PO
                </Button>
              )}
              {order.status !== "closed" && (
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit PO
                </Button>
              )}
              {order.status !== "closed" && (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleCloseOrder}
                  disabled={closing}
                >
                  {closing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Close Order
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Product Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Product Name</label>
                    <p className="font-medium">{displayProductName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Code</label>
                    <p className="font-medium">{displayItemCode}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Description</label>
                    <p className="font-medium">{displayItemDescription}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Final Customer</label>
                    <p className="font-medium">{displayFinalCustomer}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Type</label>
                    <p className="font-medium">{order.product?.item_type || "—"}</p>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">Tipo Empaque</label>
                      <p className="font-medium">{displayTipoEmpaque}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">PT Code</label>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{displayPtCode}</p>
                        {order.product?.bfx_spec_url && (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-xs"
                            onClick={() => openStorageFile(order.product!.bfx_spec_url!, 'print-cards')}
                          >
                            <FileText className="h-3.5 w-3.5 mr-0.5 inline" />
                            BFX Spec
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-muted-foreground">Pieces per Pallet</label>
                    <p className="font-medium">{order.product?.pieces_per_pallet?.toLocaleString() || "—"}</p>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">PC Number</label>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{order.product?.print_card || "—"}</p>
                        {order.product?.print_card_url && (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-xs"
                            onClick={() => openStorageFile(order.product!.print_card_url!, 'print-cards')}
                          >
                            <FileText className="h-3.5 w-3.5 mr-0.5 inline" />
                            PC PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-muted-foreground">Customer Spec Sheet</label>
                    {order.product?.customer_tech_spec_url ? (
                      <Button
                        variant="link"
                        className="p-0 h-auto block"
                        onClick={() => openStorageFile(order.product!.customer_tech_spec_url!, 'print-cards')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1 inline" />
                        View Spec Sheet
                      </Button>
                    ) : (
                      <p className="font-medium">—</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">PO Number</label>
                    <p className="font-medium">{order.po_number}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">PO Date</label>
                    <p className="font-medium">{formatDate(order.po_date)}</p>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sales Order #</label>
                      <p className="font-medium">{displaySalesOrder || "—"}</p>
                    </div>
                  )}
                  {isAdmin && order.accepted_at && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sales Order Date</label>
                      <p className="font-medium">{formatDate(order.accepted_at.split("T")[0])}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-muted-foreground">PO Age (Days)</label>
                    <p className="font-medium">
                      {(() => {
                        const start = new Date(order.po_date);
                        const end = order.status === "closed" ? new Date(order.updated_at) : new Date();
                        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        return `${days} days`;
                      })()}
                    </p>
                  </div>
                  {order.accepted_at && isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">SO Age (Days)</label>
                      <p className="font-medium">
                        {(() => {
                          const start = new Date(order.accepted_at);
                          const end = order.status === "closed" ? new Date(order.updated_at) : new Date();
                          const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                          return `${days} days`;
                        })()}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-muted-foreground">Quantity</label>
                    <p className="font-medium">{displayQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Pallets Needed</label>
                    <p className="font-medium">
                      {order.product?.pieces_per_pallet && displayQuantity
                        ? (() => {
                            const result = displayQuantity / order.product.pieces_per_pallet;
                            return Number.isInteger(result) ? result.toLocaleString() : parseFloat(result.toFixed(2)).toLocaleString();
                          })()
                        : "—"}
                    </p>
                  </div>
                  {isAdmin && (
                    <>
                      <div>
                        <label className="text-sm text-muted-foreground">Price per Thousand</label>
                        <p className="font-medium">{formatCurrency(displayPricePerThousand)}</p>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Total Price</label>
                        <p className="font-medium">{formatCurrency(displayTotalPrice)}</p>
                      </div>
                    </>
                  )}
                  {order.pdf_url && (
                    <div className="md:col-span-2">
                      <label className="text-sm text-muted-foreground">PO Document</label>
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => openStorageFile(order.pdf_url!, 'ncr-attachments')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View PDF
                      </Button>
                    </div>
                  )}
                </div>
                {order.notes && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <label className="text-sm text-muted-foreground">Notes</label>
                      <p className="font-medium mt-1">{order.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Customer Ship Date (Requested)</label>
                    {!isAdmin && order.status !== "closed" && editingDeliveryDate ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !newDeliveryDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newDeliveryDate ? format(newDeliveryDate, "MMM d, yyyy") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={newDeliveryDate}
                              onSelect={setNewDeliveryDate}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" onClick={handleSaveDeliveryDate} disabled={savingDeliveryDate || !newDeliveryDate}>
                          {savingDeliveryDate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDeliveryDate(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{formatDate(order.requested_delivery_date)}</p>
                        {!isAdmin && order.status !== "closed" && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setNewDeliveryDate(order.requested_delivery_date ? new Date(order.requested_delivery_date) : undefined);
                            setEditingDeliveryDate(true);
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Bioflex Ship Date (Estimated)</label>
                    <p className="font-medium">{formatDate(order.estimated_delivery_date)}</p>
                  </div>
                </div>

                {/* Pending Hot Order Request Banner */}
                {pendingHotRequest && (
                  <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-warning" />
                        <div>
                          <p className="text-sm font-medium">Hot Order Request — Pending Approval</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted {formatDate(pendingHotRequest.created_at)}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleReviewHotOrder(false)}
                            disabled={reviewingHot}
                          >
                            {reviewingHot ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReviewHotOrder(true)}
                            disabled={reviewingHot}
                          >
                            {reviewingHot ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer button to request hot order (only if no pending request) */}
                {!isAdmin && order.status !== "closed" && !order.is_hot_order && !pendingHotRequest && (
                  <div className="mt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleToggleHotOrder}
                      disabled={togglingHot}
                      className="gap-1"
                    >
                      {togglingHot ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flame className="h-3 w-3" />}
                      {order.status !== "pending" && order.status !== "submitted"
                        ? "Request Hot Order"
                        : "Mark as Hot Order"}
                    </Button>
                  </div>
                )}

                <Separator className="my-6" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm text-muted-foreground">Stock Verification</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full border px-2 py-1 text-muted-foreground">
                        Sales Order: <span className="font-semibold text-foreground">{displaySalesOrder || "—"}</span>
                      </span>
                      <span className="rounded-full border px-2 py-1 text-muted-foreground">
                        PO Number: <span className="font-semibold text-foreground">{order.po_number || "—"}</span>
                      </span>
                    </div>
                  </div>

                  {stockLoading && (
                    <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking warehouse availability...
                    </div>
                  )}

                  {!stockLoading && stockError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {stockError}
                    </div>
                  )}

                  {!stockLoading && !stockError && stockVerification.length === 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                      No stock verification data returned for this Sales Order / PO combination.
                    </div>
                  )}

                  {!stockLoading && !stockError && stockVerification.length > 0 && (
                    <div className="space-y-4">
                      {stockVerification.map((item, index) => (
                        <div
                          key={`${item.claveProducto}-${index}`}
                          className="rounded-xl border bg-gradient-to-br from-emerald-50/60 via-background to-sky-50/60 p-4 space-y-4"
                        >
                          {(() => {
                            const lotsCurrent = item.detallesAlmacen || [];
                            const lotsOther = item.detallesAlmacenTotal || [];
                            const assignedFromLots = lotsCurrent.reduce((sum, lot) => sum + (lot.cantidad || 0), 0);
                            const otherFromLots = lotsOther.reduce((sum, lot) => sum + (lot.cantidad || 0), 0);
                            const stockAssignedPO = item.stockAsignadoPO ?? assignedFromLots;
                            const stockOtherPOs = item.stockOtrasPOs ?? otherFromLots;
                            const totalStock = item.totalStockDisponible ?? (stockAssignedPO + stockOtherPOs);

                            return (
                              <>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div>
                                    <p className="text-sm text-muted-foreground">{item.claveProducto}</p>
                                    <p className="font-semibold">{item.producto}</p>
                                  </div>
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
                                      item.puedeCompletarOrden
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                                        : "border-amber-500/40 bg-amber-500/10 text-amber-700"
                                    )}
                                  >
                                    {item.puedeCompletarOrden ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    )}
                                    {item.puedeCompletarOrden ? "Can complete order" : "Insufficient stock"}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                  <div className="rounded-lg border bg-background/70 p-3">
                                    <p className="text-xs text-muted-foreground">Requested</p>
                                    <p className="text-lg font-semibold">
                                      {item.cantidadSolicitada.toLocaleString()} {item.unidadSolicitada}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-background/70 p-3">
                                    <p className="text-xs text-muted-foreground">Shipped</p>
                                    <p className="text-lg font-semibold">{item.cantidadEnviada.toLocaleString()}</p>
                                  </div>
                                  <div className="rounded-lg border bg-background/70 p-3">
                                    <p className="text-xs text-muted-foreground">Pending</p>
                                    <p className="text-lg font-semibold">{item.cantidadPendiente.toLocaleString()}</p>
                                  </div>
                                  <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/70 p-3">
                                    <p className="text-xs text-emerald-700">Stock Assigned To This PO</p>
                                    <p className="text-lg font-semibold text-emerald-900">{stockAssignedPO.toLocaleString()}</p>
                                  </div>
                                  <div className="rounded-lg border border-sky-200/70 bg-sky-50/70 p-3">
                                    <p className="text-xs text-sky-700">Stock From Other POs</p>
                                    <p className="text-lg font-semibold text-sky-900">{stockOtherPOs.toLocaleString()}</p>
                                  </div>
                                </div>

                                <div className="rounded-lg border bg-background/70 p-3">
                                  <p className="text-xs text-muted-foreground">Total Warehouse Stock</p>
                                  <p className="text-2xl font-semibold">{totalStock.toLocaleString()}</p>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Fulfillment progress</span>
                                    <span>{item.porcentajeEnviado.toFixed(2)}%</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        item.puedeCompletarOrden ? "bg-emerald-500" : "bg-amber-500"
                                      )}
                                      style={{ width: `${Math.min(100, Math.max(0, item.porcentajeEnviado))}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium">Lots Assigned To This PO</p>
                                      <Badge variant="secondary">{lotsCurrent.length} pallets</Badge>
                                    </div>
                                    {lotsCurrent.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No lots assigned to this PO.</p>
                                    ) : (
                                      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/30 overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead className="bg-emerald-100/70 text-emerald-900">
                                            <tr>
                                              {isAdmin && <th className="px-3 py-1.5 text-left font-medium">Lot</th>}
                                              <th className="px-3 py-1.5 text-left font-medium">Date</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Boxes</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Gross</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Net</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {lotsCurrent.map((detalle, detailIndex) => (
                                              <tr
                                                key={`${detalle.lote}-${detailIndex}`}
                                                className="border-t border-emerald-100/80 odd:bg-background/60 even:bg-emerald-50/40"
                                              >
                                                {isAdmin && <td className="px-3 py-1 font-medium">{detalle.lote}</td>}
                                                <td className="px-3 py-1 text-muted-foreground">
                                                  {detalle.fecha ? new Date(detalle.fecha).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) : "—"}
                                                </td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.cantidad.toLocaleString()}</td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.cajas.toLocaleString()}</td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.pesoBruto.toLocaleString()}</td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.pesoNeto.toLocaleString()}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium">Stock In Other POs</p>
                                      <Badge variant="outline">{lotsOther.length} pallets</Badge>
                                    </div>
                                    {lotsOther.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No pallets reported from other POs.</p>
                                    ) : (
                                      <div className="rounded-lg border border-sky-200/70 bg-sky-50/30 overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead className="bg-sky-100/70 text-sky-900">
                                            <tr>
                                              {isAdmin && <th className="px-3 py-1.5 text-left font-medium">Lot</th>}
                                              <th className="px-3 py-1.5 text-left font-medium">PO</th>
                                              <th className="px-3 py-1.5 text-left font-medium">Date</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Boxes</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Gross</th>
                                              <th className="px-3 py-1.5 text-right font-medium">Net</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {lotsOther.map((detalle, detailIndex) => (
                                              <tr
                                                key={`${detalle.lote}-${detailIndex}`}
                                                className="border-t border-sky-100/80 odd:bg-background/60 even:bg-sky-50/40"
                                              >
                                                {isAdmin && <td className="px-3 py-1 font-medium">{detalle.lote}</td>}
                                                <td className="px-3 py-1 text-muted-foreground font-medium">{detalle.po_number || detalle.bfx_order || "—"}</td>
                                                <td className="px-3 py-1 text-muted-foreground">
                                                  {detalle.fecha ? new Date(detalle.fecha).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) : "—"}
                                                </td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.cantidad.toLocaleString()}</td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.cajas.toLocaleString()}</td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.pesoBruto.toLocaleString()}</td>
                                                <td className="px-3 py-1 text-right tabular-nums">{detalle.pesoNeto.toLocaleString()}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Comments Section */}
          <div className="lg:col-span-1 space-y-4 overflow-visible relative z-10">
            {/* Customer Comments */}
            <POComments
              purchaseOrderId={order.id}
              isInternal={false}
              title="Customer Comments"
            />

            {/* Internal Notes - Admin Only */}
            {isAdmin && (
              <div className="relative z-20">
                <POComments
                  purchaseOrderId={order.id}
                  isInternal={true}
                  title="Internal Notes"
                />
              </div>
            )}
          </div>

          {/* Activity Timeline - Full width inside the grid */}
          <div className="lg:col-span-3">
            <POActivityTimeline
              order={{
                id: order.id,
                po_number: order.po_number,
                sales_order_number: order.sales_order_number,
                created_at: order.created_at,
                status: order.status,
                is_hot_order: order.is_hot_order,
              }}
            />
          </div>
        </div>

        {/* Edit Order Dialog */}
        {isAdmin && order && (
          <EditOrderDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            order={order}
            onSaved={fetchOrderDetails}
          />
        )}
        {/* Accept Order Dialog */}
        {isAdmin && order && (
          <AcceptOrderDialog
            open={acceptDialogOpen}
            onOpenChange={setAcceptDialogOpen}
            order={{
              id: order.id,
              po_number: order.po_number,
              is_hot_order: order.is_hot_order,
              product_name: order.product?.name || null,
            }}
            onAccepted={fetchOrderDetails}
          />
        )}
      </div>
    </MainLayout>
  );
}

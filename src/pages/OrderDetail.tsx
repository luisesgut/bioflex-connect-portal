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
import { cn } from "@/lib/utils";




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
  pdf_url: string | null;
  notes: string | null;
  sales_order_number: string | null;
  pallets_needed: number | null;
  product: {
    name: string;
    sku: string;
    customer: string | null;
    item_type: string | null;
    tipo_empaque: string | null;
    customer_item: string | null;
    item_description: string | null;
    dp_sales_csr_names: string | null;
    codigo_producto: string | null;
    pt_code: string | null;
    pieces_per_pallet: number | null;
    print_card: string | null;
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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [stockVerification, setStockVerification] = useState<StockVerificationItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  useEffect(() => {
    if (!order?.sales_order_number || !order?.po_number) {
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
        const response = await fetch(
          `http://172.16.10.31/api/Ordenes/verificar-stock/${encodeURIComponent(order.sales_order_number)}/${encodeURIComponent(order.po_number)}`,
          {
            method: "GET",
            headers: { accept: "*/*" },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        setStockVerification(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("Error verifying stock:", error);
        setStockError("Unable to verify stock for this order right now.");
      } finally {
        setStockLoading(false);
      }
    };

    fetchStockVerification();

    return () => {
      controller.abort();
    };
  }, [order?.sales_order_number, order?.po_number]);

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
              <Badge
                variant="outline"
                className={cn(
                  "px-3 py-1",
                  statusStyles[order.status] || statusStyles.pending
                )}
              >
                {statusLabels[order.status] || order.status}
              </Badge>
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
                    <label className="text-sm text-muted-foreground">Item Code</label>
                    <p className="font-medium">{order.product?.customer_item || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Description</label>
                    <p className="font-medium">{order.product?.item_description || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Final Customer</label>
                    <p className="font-medium">{order.product?.customer || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Type</label>
                    <p className="font-medium">{order.product?.item_type || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Tipo Empaque</label>
                    <p className="font-medium">{order.product?.tipo_empaque || "—"}</p>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">PT Code</label>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{order.product?.codigo_producto || order.product?.pt_code || "—"}</p>
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
                    <label className="text-sm text-muted-foreground">PO Date</label>
                    <p className="font-medium">{formatDate(order.po_date)}</p>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sales Order #</label>
                      <p className="font-medium">{order.sales_order_number || "—"}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-muted-foreground">Quantity</label>
                    <p className="font-medium">{order.quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Pallets Needed</label>
                    <p className="font-medium">
                      {order.product?.pieces_per_pallet && order.quantity
                        ? (() => {
                            const result = order.quantity / order.product.pieces_per_pallet;
                            return Number.isInteger(result) ? result.toLocaleString() : parseFloat(result.toFixed(2)).toLocaleString();
                          })()
                        : "—"}
                    </p>
                  </div>
                  {isAdmin && (
                    <>
                      <div>
                        <label className="text-sm text-muted-foreground">Price per Thousand</label>
                        <p className="font-medium">{formatCurrency(order.price_per_thousand)}</p>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Total Price</label>
                        <p className="font-medium">{formatCurrency(order.total_price)}</p>
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
                    <label className="text-sm text-muted-foreground">Customer Delivery (Requested)</label>
                    <p className="font-medium">{formatDate(order.requested_delivery_date)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Bioflex Delivery (Estimated)</label>
                    <p className="font-medium">{formatDate(order.estimated_delivery_date)}</p>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm text-muted-foreground">Stock Verification</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full border px-2 py-1 text-muted-foreground">
                        Sales Order: <span className="font-semibold text-foreground">{order.sales_order_number || "—"}</span>
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
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {lotsCurrent.map((detalle, detailIndex) => (
                                          <div
                                            key={`${detalle.lote}-${detailIndex}`}
                                            className="rounded-lg border border-emerald-200/60 bg-emerald-50/30 p-3 space-y-1"
                                          >
                                            <p className="text-xs text-muted-foreground">Lot</p>
                                            <p className="font-medium">{detalle.lote}</p>
                                            <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                                              <p className="text-muted-foreground">Qty: <span className="text-foreground font-medium">{detalle.cantidad.toLocaleString()}</span></p>
                                              <p className="text-muted-foreground">Boxes: <span className="text-foreground font-medium">{detalle.cajas.toLocaleString()}</span></p>
                                              <p className="text-muted-foreground">Gross: <span className="text-foreground font-medium">{detalle.pesoBruto.toLocaleString()}</span></p>
                                              <p className="text-muted-foreground">Net: <span className="text-foreground font-medium">{detalle.pesoNeto.toLocaleString()}</span></p>
                                            </div>
                                          </div>
                                        ))}
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
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {lotsOther.map((detalle, detailIndex) => (
                                          <div
                                            key={`${detalle.lote}-${detailIndex}`}
                                            className="rounded-lg border border-sky-200/60 bg-sky-50/30 p-3 space-y-1"
                                          >
                                            <p className="text-xs text-muted-foreground">Lot</p>
                                            <p className="font-medium">{detalle.lote}</p>
                                            <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                                              <p className="text-muted-foreground">Qty: <span className="text-foreground font-medium">{detalle.cantidad.toLocaleString()}</span></p>
                                              <p className="text-muted-foreground">Boxes: <span className="text-foreground font-medium">{detalle.cajas.toLocaleString()}</span></p>
                                              <p className="text-muted-foreground">Gross: <span className="text-foreground font-medium">{detalle.pesoBruto.toLocaleString()}</span></p>
                                              <p className="text-muted-foreground">Net: <span className="text-foreground font-medium">{detalle.pesoNeto.toLocaleString()}</span></p>
                                            </div>
                                          </div>
                                        ))}
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
      </div>
    </MainLayout>
  );
}

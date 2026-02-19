import { useState, useEffect } from "react";
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
  

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

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
          {isAdmin && order.status !== "closed" && (
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
                      <label className="text-sm text-muted-foreground">PT Number</label>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{order.product?.pt_code || "—"}</p>
                        {order.product?.bfx_spec_url && (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-xs"
                            onClick={() => window.open(order.product!.bfx_spec_url!, "_blank")}
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
                            onClick={() => window.open(order.product!.print_card_url!, "_blank")}
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
                        onClick={() => window.open(order.product!.customer_tech_spec_url!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1 inline" />
                        View Spec Sheet
                      </Button>
                    ) : (
                      <p className="font-medium">—</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">PT Code (SAP)</label>
                      <p className="font-medium">{order.product?.codigo_producto || "—"}</p>
                    </div>
                  )}
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
                        onClick={() => window.open(order.pdf_url!, "_blank")}
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
              </CardContent>
            </Card>

          </div>

          {/* Comments Section */}
          <div className="lg:col-span-1 space-y-4">
            {/* Customer Comments */}
            <POComments
              purchaseOrderId={order.id}
              isInternal={false}
              title="Customer Comments"
            />

            {/* Internal Notes - Admin Only */}
            {isAdmin && (
              <POComments
                purchaseOrderId={order.id}
                isInternal={true}
                title="Internal Notes"
              />
            )}
          </div>
        </div>

        {/* Activity Timeline - Inline, same width as left column */}
        <div className="lg:w-2/3">
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
    </MainLayout>
  );
}

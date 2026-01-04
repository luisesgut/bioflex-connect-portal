import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileText,
  Flame,
  Calendar,
  Package,
  Truck,
  DollarSign,
  Hash,
  User,
  Clock,
  ExternalLink,
  Loader2,
  Send,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { POActivityTimeline } from "@/components/orders/POActivityTimeline";
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
    customer_item: string | null;
    item_description: string | null;
    dp_sales_csr_names: string | null;
    codigo_producto: string | null;
  } | null;
}

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  created_at: string;
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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
      fetchComments();
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
          customer_item,
          item_description,
          dp_sales_csr_names,
          codigo_producto
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

    setOrder({
      ...data,
      product: data.products as OrderDetails["product"],
    });
    setLoading(false);
  };

  const fetchComments = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("po_comments")
      .select("*")
      .eq("purchase_order_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    setComments(data || []);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !id) return;

    setSubmittingComment(true);
    const { error } = await supabase.from("po_comments").insert({
      purchase_order_id: id,
      user_id: user.id,
      comment: newComment.trim(),
    });

    if (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } else {
      toast.success("Comment added");
      setNewComment("");
      fetchComments();
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("po_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    } else {
      toast.success("Comment deleted");
      fetchComments();
    }
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
          <Button variant="outline" onClick={() => setTimelineOpen(true)}>
            <Clock className="h-4 w-4 mr-2" />
            Activity Timeline
          </Button>
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
                    <p className="font-medium">{order.product?.name || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Customer Item</label>
                    <p className="font-medium">{order.product?.customer_item || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Description</label>
                    <p className="font-medium">{order.product?.item_description || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Customer</label>
                    <p className="font-medium">{order.product?.customer || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Item Type</label>
                    <p className="font-medium">{order.product?.item_type || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">DP Sales/CSR</label>
                    <p className="font-medium">{order.product?.dp_sales_csr_names || "—"}</p>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm text-muted-foreground">PT Code</label>
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
                  <div>
                    <label className="text-sm text-muted-foreground">Sales Order #</label>
                    <p className="font-medium">{order.sales_order_number || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Quantity</label>
                    <p className="font-medium">{order.quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Pallets Needed</label>
                    <p className="font-medium">{order.pallets_needed || "—"}</p>
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
                  {order.accepted_at && (
                    <div className="md:col-span-2">
                      <label className="text-sm text-muted-foreground">Accepted On</label>
                      <p className="font-medium">{formatDateTime(order.accepted_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comments Section */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 max-h-[400px] pr-4 mb-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No comments yet</p>
                      <p className="text-sm">Be the first to add a comment</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="bg-muted/50 rounded-lg p-3 border"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm">{comment.comment}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDateTime(comment.created_at)}
                              </p>
                            </div>
                            {comment.user_id === user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    className="w-full"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Add Comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Activity Timeline Dialog */}
      <POActivityTimeline
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        order={{
          id: order.id,
          po_number: order.po_number,
          sales_order_number: order.sales_order_number,
          created_at: order.created_at,
          status: order.status,
          is_hot_order: order.is_hot_order,
        }}
      />
    </MainLayout>
  );
}

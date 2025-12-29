import { useState, useEffect } from "react";
import { Flame, Clock, Package, AlertTriangle, FileText, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { format, differenceInDays } from "date-fns";

interface HotOrder {
  id: string;
  po_number: string;
  product_name: string | null;
  quantity: number;
  status: string;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  pdf_url: string | null;
}

export default function HotOrders() {
  const { isAdmin } = useAdmin();
  const [hotOrders, setHotOrders] = useState<HotOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotOrders = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          quantity,
          status,
          requested_delivery_date,
          estimated_delivery_date,
          notes,
          created_at,
          pdf_url,
          products (name)
        `)
        .eq("is_hot_order", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching hot orders:", error);
      } else {
        const formattedOrders = (data || []).map((order: any) => ({
          id: order.id,
          po_number: order.po_number,
          product_name: order.products?.name || null,
          quantity: order.quantity,
          status: order.status,
          requested_delivery_date: order.requested_delivery_date,
          estimated_delivery_date: order.estimated_delivery_date,
          notes: order.notes,
          created_at: order.created_at,
          pdf_url: order.pdf_url,
        }));
        setHotOrders(formattedOrders);
      }
      setLoading(false);
    };

    fetchHotOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      submitted: { variant: "outline", label: "Submitted" },
      accepted: { variant: "default", label: "Accepted" },
      in_production: { variant: "default", label: "In Production" },
      shipped: { variant: "default", label: "Shipped" },
      delivered: { variant: "default", label: "Delivered" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = statusConfig[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDaysInfo = (order: HotOrder) => {
    const deliveryDate = order.estimated_delivery_date || order.requested_delivery_date;
    if (!deliveryDate) {
      return { text: "ASAP - Awaiting confirmation", urgent: true };
    }
    const days = differenceInDays(new Date(deliveryDate), new Date());
    if (days < 0) {
      return { text: `${Math.abs(days)} days overdue`, urgent: true };
    }
    if (days === 0) {
      return { text: "Due today", urgent: true };
    }
    return { text: `${days} days left`, urgent: days <= 3 };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent shadow-glow">
              <Flame className="h-7 w-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Hot Orders
              </h1>
              <p className="mt-1 text-muted-foreground">
                {isAdmin ? "All prioritized urgent production orders" : "Your prioritized urgent production orders"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-accent border-accent">
            {hotOrders.length} Hot {hotOrders.length === 1 ? "Order" : "Orders"}
          </Badge>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-card-foreground">Priority Production Queue</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Hot orders are prioritized in the production queue. Bioflex will confirm delivery dates within 2 days for ASAP requests.
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        )}

        {/* Hot Orders List */}
        {!loading && hotOrders.length > 0 && (
          <div className="space-y-4">
            {hotOrders.map((order, index) => {
              const daysInfo = getDaysInfo(order);
              return (
                <div
                  key={order.id}
                  className="group relative overflow-hidden rounded-xl border border-accent/30 bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-accent/50 animate-slide-up"
                  style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                >
                  {/* Priority Badge */}
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-accent opacity-10" />
                  
                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left Section - Order Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-accent shadow-glow">
                        <Flame className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-semibold text-card-foreground truncate">
                            {order.product_name || "Unknown Product"}
                          </h3>
                          {order.pdf_url ? (
                            <a
                              href={order.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="font-mono text-xs">{order.po_number}</span>
                            </a>
                          ) : (
                            <Badge variant="outline" className="font-mono text-xs">
                              {order.po_number}
                            </Badge>
                          )}
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {order.quantity.toLocaleString()} units
                        </p>
                        {order.notes && (
                          <div className="mt-3 flex items-center gap-2 text-sm">
                            <Flame className="h-4 w-4 text-accent shrink-0" />
                            <span className="text-accent font-medium truncate">{order.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Section - Delivery Dates */}
                    <div className="lg:flex-shrink-0 lg:px-8">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Customer Delivery</span>
                          <p className="font-medium text-card-foreground">
                            {order.requested_delivery_date ? formatDate(order.requested_delivery_date) : "ASAP"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bioflex Delivery</span>
                          <p className="font-medium text-card-foreground">
                            {formatDate(order.estimated_delivery_date)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Time Left */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className={cn(
                          "text-sm font-semibold whitespace-nowrap",
                          daysInfo.urgent ? "text-destructive" : "text-card-foreground"
                        )}>
                          {daysInfo.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && hotOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 animate-fade-in">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No hot orders</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All orders are running on normal priority
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

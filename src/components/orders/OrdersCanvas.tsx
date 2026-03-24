import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { Flame, ShieldAlert, DollarSign, Package, Truck, Clock, Loader2, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasOrder {
  id: string;
  po_number: string;
  sales_order_number?: string | null;
  product_name: string | null;
  product_item_type: string | null;
  product_tipo_empaque: string | null;
  product_customer: string | null;
  quantity: number;
  total_price: number | null;
  status: string;
  is_hot_order: boolean;
  hot_order_priority: number | null;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  order_document_date: string | null;
  order_due_date: string | null;
  order_timing_status: string | null;
  accepted_at: string | null;
  inventoryStats: {
    inFloor: number;
    shipped: number;
    pending: number;
    sapStockAvailable?: number | null;
    sapVerificationLoading?: boolean;
  };
}

interface OrdersCanvasProps {
  orders: CanvasOrder[];
  groupBy?: "product_item_type" | "product_tipo_empaque";
}

const columnColors: string[] = [
  "bg-blue-500/10 border-blue-500/30",
  "bg-purple-500/10 border-purple-500/30",
  "bg-amber-500/10 border-amber-500/30",
  "bg-emerald-500/10 border-emerald-500/30",
  "bg-teal-500/10 border-teal-500/30",
  "bg-indigo-500/10 border-indigo-500/30",
  "bg-orange-500/10 border-orange-500/30",
  "bg-cyan-500/10 border-cyan-500/30",
  "bg-rose-500/10 border-rose-500/30",
  "bg-lime-500/10 border-lime-500/30",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(dateString: string | null) {
  if (!dateString) return "TBD";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTimingStatusClasses(status: string | null) {
  const normalized = (status || "").trim().toLowerCase();
  if (!normalized) return "border-border bg-muted/60 text-muted-foreground";
  if (normalized.includes("tiempo") || normalized.includes("time")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("por vencer") || normalized.includes("almost")) {
    return "border-yellow-300 bg-yellow-50 text-yellow-700";
  }
  if (normalized.includes("venc") || normalized.includes("late") || normalized.includes("over")) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (normalized.includes("hoy") || normalized.includes("today")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function translateTimingStatus(status: string | null): string {
  if (!status) return "No status";
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("a tiempo")) return "On Time";
  if (normalized.includes("por vencer")) return "Almost Due";
  if (normalized.includes("vencido") || normalized.includes("vencida")) return "Overdue";
  return status;
}

function getSOAgeDays(acceptedAt: string | null): number | null {
  if (!acceptedAt) return null;
  const start = new Date(acceptedAt);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function sortOrders(orders: CanvasOrder[]): CanvasOrder[] {
  return [...orders].sort((a, b) => {
    // Hot orders first
    if (a.is_hot_order && !b.is_hot_order) return -1;
    if (!a.is_hot_order && b.is_hot_order) return 1;
    // Among hot orders, sort by priority (lower = higher priority)
    if (a.is_hot_order && b.is_hot_order) {
      const pa = a.hot_order_priority ?? 999;
      const pb = b.hot_order_priority ?? 999;
      if (pa !== pb) return pa - pb;
    }
    // DND next
    if (a.do_not_delay && !b.do_not_delay) return -1;
    if (!a.do_not_delay && b.do_not_delay) return 1;
    // Then by closest delivery date
    const dateA = a.requested_delivery_date ? new Date(a.requested_delivery_date).getTime() : Infinity;
    const dateB = b.requested_delivery_date ? new Date(b.requested_delivery_date).getTime() : Infinity;
    return dateA - dateB;
  });
}

export function OrdersCanvas({ orders, groupBy = "product_item_type" }: OrdersCanvasProps) {
  const navigate = useNavigate();

  // Only accepted (active) orders, exclude closed
  const activeOrders = orders.filter(
    (o) => o.status !== "closed" && o.status !== "delivered"
  );

  const normalizeGroupValue = (value: string | null | undefined) => {
    const raw = (value || "").trim();
    const normalized = raw.toLowerCase();
    if (!raw || normalized === "null" || normalized === "undefined" || normalized === "unassigned" || normalized === "n/a") {
      return "Unassigned";
    }
    return raw;
  };

  const getGroupValue = (o: CanvasOrder) => normalizeGroupValue(o[groupBy]);

  // Group by selected field
  const families = Array.from(
    new Set(activeOrders.map(getGroupValue))
  ).sort((a, b) => {
    const aUnassigned = a === "Unassigned";
    const bUnassigned = b === "Unassigned";
    if (aUnassigned && !bUnassigned) return 1;
    if (!aUnassigned && bUnassigned) return -1;
    return a.localeCompare(b);
  });

  const getOrdersByFamily = (family: string) =>
    sortOrders(activeOrders.filter((o) => getGroupValue(o) === family));

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {families.map((family, idx) => {
          const familyOrders = getOrdersByFamily(family);

          // Summary calculations
          const totalVolume = familyOrders.reduce((sum, o) => sum + o.quantity, 0);
          const totalAmount = familyOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
          const verifiedOrders = familyOrders.filter(o => !o.inventoryStats.sapVerificationLoading);
          const anyLoading = familyOrders.some(o => o.inventoryStats.sapVerificationLoading);
          const totalShipped = verifiedOrders.reduce((sum, o) => sum + o.inventoryStats.shipped, 0);
          const totalInWarehouse = verifiedOrders.reduce((sum, o) => sum + o.inventoryStats.inFloor, 0);
          const totalPending = verifiedOrders.reduce((sum, o) => sum + o.inventoryStats.pending, 0);

          return (
            <div key={family} className="flex-shrink-0 w-80">
              <div
                className={cn(
                  "rounded-lg border-2 h-full flex flex-col",
                  columnColors[idx % columnColors.length]
                )}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm truncate">{family}</h3>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {familyOrders.length}
                    </Badge>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span>Orders: <strong className="text-foreground">{formatNumber(totalVolume)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      <span>{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Truck className="h-3 w-3" />
                      <span>Shipped: <strong className="text-foreground">{formatNumber(totalShipped)}</strong>{anyLoading && <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-0.5" />}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span>In WH: <strong className="text-foreground">{formatNumber(totalInWarehouse)}</strong>{anyLoading && <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-0.5" />}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground col-span-2">
                      <Clock className="h-3 w-3" />
                      <span>Pending: <strong className="text-foreground">{formatNumber(totalPending)}</strong>{anyLoading && <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-0.5" />}</span>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <ScrollArea className="h-[calc(100vh-380px)] flex-1">
                  <div className="p-2 space-y-2">
                    {familyOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">—</div>
                    ) : (
                      familyOrders.map((order) => {
                        const soAge = getSOAgeDays(order.accepted_at);
                        return (
                          <Card
                            key={order.id}
                            className={cn(
                              "cursor-pointer hover:shadow-md transition-shadow bg-card",
                              order.is_hot_order && "ring-1 ring-destructive/30 border-destructive/20"
                            )}
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-1 gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    <span className="font-mono text-xs font-medium text-card-foreground">
                                      {order.po_number}
                                    </span>
                                    {order.sales_order_number && (
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        SO: {order.sales_order_number}
                                      </span>
                                    )}
                                    {order.is_hot_order && (
                                      <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                        <Flame className="h-3 w-3" />
                                        Hot{order.hot_order_priority ? ` #${order.hot_order_priority}` : ""}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {order.do_not_delay && (
                                    <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                                  )}
                                </div>
                              </div>
                              <h4 className="font-medium text-sm line-clamp-2 mb-1">
                                {order.product_name || "No product"}
                              </h4>
                              {order.product_customer && (
                                <p className="text-xs text-muted-foreground mb-1">
                                  {order.product_customer}
                                </p>
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">
                                  {order.quantity.toLocaleString()} units
                                </span>
                                {order.total_price != null && (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {formatCurrency(order.total_price)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                {order.requested_delivery_date && (
                                  <span>Due: {formatDate(order.requested_delivery_date)}</span>
                                )}
                                {soAge !== null && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                    SO: {soAge}d
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 grid gap-1.5">
                                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                  <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                                    <div className="text-muted-foreground">Fecha de creacion</div>
                                    <div className="mt-0.5 font-semibold text-foreground">
                                      {formatLongDate(order.order_document_date)}
                                    </div>
                                  </div>
                                  <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                                    <div className="text-muted-foreground">Fecha de entrega</div>
                                    <div className="mt-0.5 font-semibold text-foreground">
                                      {formatLongDate(order.order_due_date)}
                                    </div>
                                  </div>
                                </div>
                                <div className={cn("rounded-md border px-2 py-1.5 text-[10px] flex items-center gap-1.5", getTimingStatusClasses(order.order_timing_status))}>
                                  <span className="uppercase tracking-wide opacity-80">Status:</span>
                                  <span className="text-xs font-semibold">{translateTimingStatus(order.order_timing_status)}</span>
                                </div>
                              </div>
                              {/* Mini progress bar */}
                              <div className="mt-2">
                              {order.inventoryStats.sapVerificationLoading ? (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Verifying with SAP...</span>
                                  </div>
                                ) : (
                                  <>
                                    {(() => {
                                      const shipped = order.inventoryStats.shipped;
                                      const inFloor = order.inventoryStats.inFloor;
                                      const stockOtherPOs = Math.max(0, (order.inventoryStats.sapStockAvailable ?? 0) - inFloor);
                                      const totalStock = shipped + inFloor + stockOtherPOs;
                                      const threshold = order.quantity * 1.1;
                                      const isOverLimit = order.quantity > 0 && totalStock > threshold;
                                      const excessPercent = order.quantity > 0 ? Math.round(((totalStock / order.quantity) - 1) * 100) : 0;
                                      const fulfillmentPct = order.quantity > 0 ? Math.round((totalStock / order.quantity) * 100) : 0;

                                      return (
                                        <>
                                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                            <span>{fulfillmentPct}%</span>
                                            {isOverLimit && (
                                              <span className="text-destructive font-semibold">+{excessPercent}%</span>
                                            )}
                                          </div>
                                          <div className={cn("h-1.5 rounded-full overflow-hidden flex", isOverLimit ? "bg-destructive/20" : "bg-muted")}>
                                            {order.quantity > 0 && (() => {
                                              const shippedPct = (shipped / order.quantity) * 100;
                                              const whPct = (inFloor / order.quantity) * 100;
                                              const otherPct = (stockOtherPOs / order.quantity) * 100;
                                              const cap = 110;
                                              const shippedClamped = Math.min(shippedPct, cap);
                                              const whClamped = Math.min(whPct, cap - shippedClamped);
                                              const otherClamped = Math.min(otherPct, cap - shippedClamped - whClamped);
                                              const totalClamped = shippedClamped + whClamped + otherClamped;
                                              const overflowPct = isOverLimit ? Math.min(((totalStock / order.quantity) * 100) - 110, cap) : 0;
                                              const scale = cap > 0 ? 100 / cap : 1;
                                              return (
                                                <>
                                                  <div className="bg-success h-full" style={{ width: `${shippedClamped * scale}%` }} />
                                                  <div className="bg-info h-full" style={{ width: `${whClamped * scale}%` }} />
                                                  <div className="bg-info/50 h-full" style={{ width: `${otherClamped * scale}%` }} />
                                                  {isOverLimit && (
                                                    <div className="bg-destructive h-full" style={{ width: `${overflowPct * scale}%` }} />
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />Ship {formatNumber(shipped)}</span>
                                              <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-info" />WH {formatNumber(inFloor)}</span>
                                              {stockOtherPOs > 0 && (
                                                <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-info/50" />Other {formatNumber(stockOtherPOs)}</span>
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

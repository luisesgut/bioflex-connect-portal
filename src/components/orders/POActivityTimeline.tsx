import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Package, Truck, CheckCircle2, XCircle, Clock, AlertTriangle, Flame, Calendar, ArrowRightLeft, Ban, ShieldAlert, RefreshCw, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: "order_created" | "order_accepted" | "status_change" | "change_request" | "load_created" | "load_shipped" | "load_delivered";
  title: string;
  description: string;
  timestamp: string;
  status?: "pending" | "approved" | "rejected" | "info";
  icon: "file" | "check" | "truck" | "package" | "clock" | "alert" | "flame" | "change" | "cancel" | "shield" | "status" | "edit";
  metadata?: Record<string, string | number | null>;
}

interface POActivityTimelineProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  order: {
    id: string;
    po_number: string;
    sales_order_number: string | null;
    created_at: string;
    status: string;
    is_hot_order: boolean;
  };
}

const iconMap = {
  file: FileText,
  check: CheckCircle2,
  truck: Truck,
  package: Package,
  clock: Clock,
  alert: AlertTriangle,
  flame: Flame,
  change: ArrowRightLeft,
  cancel: Ban,
  shield: ShieldAlert,
  status: RefreshCw,
  edit: Pencil,
};

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-600 border-green-500/30",
  rejected: "bg-red-500/20 text-red-600 border-red-500/30",
  info: "bg-blue-500/20 text-blue-600 border-blue-500/30",
};

export function POActivityTimeline({ open, onOpenChange, order }: POActivityTimelineProps) {
  const isInline = open === undefined;
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (isInline || open) {
      fetchActivityData();
    }
  }, [isInline, open, order.id]);

  const fetchActivityData = async () => {
    setLoading(true);
    const timelineEvents: TimelineEvent[] = [];

    try {
      // 1. Order created event
      timelineEvents.push({
        id: `order-created-${order.id}`,
        type: "order_created",
        title: "Purchase Order Created",
        description: `PO ${order.po_number} was submitted`,
        timestamp: order.created_at,
        status: "info",
        icon: "file",
      });

      // 2. Fetch purchase order details for accepted_at
      const { data: poData } = await supabase
        .from("purchase_orders")
        .select("accepted_at, accepted_by")
        .eq("id", order.id)
        .maybeSingle();

      if (poData?.accepted_at) {
        timelineEvents.push({
          id: `order-accepted-${order.id}`,
          type: "order_accepted",
          title: "Order Accepted",
          description: `PO was accepted and confirmed`,
          timestamp: poData.accepted_at,
          status: "approved",
          icon: "check",
        });
      }

      // 2b. Fetch status change history
      const { data: statusHistory } = await supabase
        .from("po_status_history")
        .select("*")
        .eq("purchase_order_id", order.id)
        .order("changed_at", { ascending: true });

      if (statusHistory) {
        const statusLabels: Record<string, string> = {
          pending: "Pending",
          submitted: "Submitted",
          accepted: "Accepted",
          in_production: "In Production",
          shipped: "Shipped",
          delivered: "Delivered",
          cancelled: "Cancelled",
        };

        for (const change of statusHistory) {
          const oldLabel = statusLabels[change.old_status || ""] || change.old_status || "Unknown";
          const newLabel = statusLabels[change.new_status] || change.new_status;
          
          // Detect if this is an edit event (same status, notes starting with "PO edited:")
          const isEditEvent = change.old_status === change.new_status && change.notes?.startsWith("PO edited:");

          timelineEvents.push({
            id: `status-change-${change.id}`,
            type: "status_change",
            title: isEditEvent ? "PO Edited" : "Status Changed",
            description: isEditEvent
              ? (change.notes?.replace("PO edited: ", "") || "Order details were modified")
              : `Status updated from "${oldLabel}" to "${newLabel}"`,
            timestamp: change.changed_at,
            status: "info",
            icon: isEditEvent ? "edit" : "status",
            metadata: !isEditEvent && change.notes ? { reason: change.notes } : undefined,
          });
        }
      }

      // 3. Fetch change requests for this PO
      const { data: changeRequests } = await supabase
        .from("order_change_requests")
        .select("*")
        .eq("purchase_order_id", order.id)
        .order("created_at", { ascending: true });

      if (changeRequests) {
        for (const req of changeRequests) {
          const requestTypeLabels: Record<string, string> = {
            volume_change: "Volume Change",
            cancellation: "Cancellation",
            do_not_delay: "Do Not Delay",
          };

          let description = `${requestTypeLabels[req.request_type] || req.request_type} request`;
          if (req.request_type === "volume_change" && req.requested_quantity) {
            description += ` from ${req.current_quantity.toLocaleString()} to ${req.requested_quantity.toLocaleString()}`;
          }

          timelineEvents.push({
            id: `change-request-created-${req.id}`,
            type: "change_request",
            title: `${requestTypeLabels[req.request_type] || "Change"} Request Submitted`,
            description,
            timestamp: req.created_at,
            status: "pending",
            icon: req.request_type === "cancellation" ? "cancel" : "change",
            metadata: { reason: req.reason },
          });

          if (req.status !== "pending" && req.reviewed_at) {
            timelineEvents.push({
              id: `change-request-reviewed-${req.id}`,
              type: "change_request",
              title: `${requestTypeLabels[req.request_type] || "Change"} Request ${req.status === "approved" ? "Approved" : "Rejected"}`,
              description: req.admin_notes || `Request was ${req.status}`,
              timestamp: req.reviewed_at,
              status: req.status as "approved" | "rejected",
              icon: req.status === "approved" ? "check" : "shield",
            });
          }
        }
      }

      // 4. Find released pallets associated with this PO
      // Get inventory pallets that match this PO
      let inventoryQuery = supabase
        .from("inventory_pallets")
        .select("id");
      
      if (order.sales_order_number) {
        inventoryQuery = inventoryQuery.or(`bfx_order.eq.${order.sales_order_number},customer_lot.eq.${order.po_number}`);
      } else {
        inventoryQuery = inventoryQuery.eq("customer_lot", order.po_number);
      }

      const { data: matchingPallets } = await inventoryQuery;
      const palletIds = matchingPallets?.map(p => p.id) || [];

      if (palletIds.length > 0) {
        // Get ONLY released load_pallets (actioned and not on hold)
        const { data: loadPallets } = await supabase
          .from("load_pallets")
          .select("load_id, pallet_id, quantity, actioned_at, is_on_hold, destination")
          .in("pallet_id", palletIds)
          .not("actioned_at", "is", null)
          .eq("is_on_hold", false);

        if (loadPallets && loadPallets.length > 0) {
          // Group released pallets by load_id
          const loadGroupMap = new Map<string, { count: number; totalVolume: number; destinations: Set<string>; earliestAction: string }>();
          for (const lp of loadPallets) {
            const existing = loadGroupMap.get(lp.load_id);
            if (existing) {
              existing.count++;
              existing.totalVolume += Number(lp.quantity) || 0;
              if (lp.destination) existing.destinations.add(lp.destination);
              if (lp.actioned_at && lp.actioned_at < existing.earliestAction) {
                existing.earliestAction = lp.actioned_at;
              }
            } else {
              const dests = new Set<string>();
              if (lp.destination) dests.add(lp.destination);
              loadGroupMap.set(lp.load_id, {
                count: 1,
                totalVolume: Number(lp.quantity) || 0,
                destinations: dests,
                earliestAction: lp.actioned_at!,
              });
            }
          }

          const loadIds = [...loadGroupMap.keys()];

          // Get shipping loads info
          const { data: loads } = await supabase
            .from("shipping_loads")
            .select("id, load_number, status, shipping_date, created_at")
            .in("id", loadIds)
            .order("created_at", { ascending: true });

          // Get destination actual dates for delivered loads
          const { data: destDates } = await supabase
            .from("load_destination_dates")
            .select("load_id, destination, actual_date")
            .in("load_id", loadIds)
            .not("actual_date", "is", null);

          const destDatesByLoad = new Map<string, Array<{ destination: string; actual_date: string }>>();
          if (destDates) {
            for (const dd of destDates) {
              const arr = destDatesByLoad.get(dd.load_id) || [];
              arr.push({ destination: dd.destination, actual_date: dd.actual_date! });
              destDatesByLoad.set(dd.load_id, arr);
            }
          }

          if (loads) {
            for (const load of loads) {
              const group = loadGroupMap.get(load.id);
              if (!group) continue;

              // Released pallets event
              timelineEvents.push({
                id: `load-released-${load.id}`,
                type: "load_created",
                title: "Pallets Released",
                description: `${group.count} pallet${group.count !== 1 ? "s" : ""} released in Load ${load.load_number} — ${group.totalVolume.toLocaleString()} total volume`,
                timestamp: group.earliestAction,
                status: "approved",
                icon: "check",
                metadata: { load_number: load.load_number },
              });

              // Load shipped
              if (load.status === "in_transit" || load.status === "delivered") {
                timelineEvents.push({
                  id: `load-shipped-${load.id}`,
                  type: "load_shipped",
                  title: "Load Shipped",
                  description: `Load ${load.load_number} is in transit`,
                  timestamp: load.shipping_date,
                  status: "info",
                  icon: "truck",
                  metadata: { load_number: load.load_number },
                });
              }

              // Delivery per destination (actual dates only)
              if (load.status === "delivered" || load.status === "in_transit") {
                const destinations = destDatesByLoad.get(load.id) || [];
                // Only show destinations relevant to this PO's pallets
                const poDestinations = group.destinations;
                const relevantDests = destinations.filter(d => poDestinations.has(d.destination));
                
                for (const dest of relevantDests) {
                  timelineEvents.push({
                    id: `load-dest-delivered-${load.id}-${dest.destination}`,
                    type: "load_delivered",
                    title: "Delivered",
                    description: `Load ${load.load_number} arrived at ${dest.destination}`,
                    timestamp: dest.actual_date,
                    status: "approved",
                    icon: "check",
                    metadata: { load_number: load.load_number },
                  });
                }
              }
            }
          }
        }
      }

      // Also check shipped_pallets for historical data
      let shippedQuery = supabase
        .from("shipped_pallets")
        .select("*, shipping_loads:load_id(id, load_number, status, shipping_date)")
        .not("destination", "is", null);

      if (order.sales_order_number) {
        shippedQuery = shippedQuery.or(`bfx_order.eq.${order.sales_order_number},customer_lot.eq.${order.po_number}`);
      } else {
        shippedQuery = shippedQuery.eq("customer_lot", order.po_number);
      }

      const { data: shippedPallets } = await shippedQuery;

      if (shippedPallets) {
        // Group by load_id
        const shippedLoadMap = new Map<string, { count: number; totalVolume: number; destinations: Set<string>; shippedAt: string; load: any }>();
        for (const sp of shippedPallets) {
          const existing = shippedLoadMap.get(sp.load_id);
          if (existing) {
            existing.count++;
            existing.totalVolume += Number(sp.quantity) || 0;
            if (sp.destination) existing.destinations.add(sp.destination);
          } else {
            const dests = new Set<string>();
            if (sp.destination) dests.add(sp.destination);
            shippedLoadMap.set(sp.load_id, {
              count: 1,
              totalVolume: Number(sp.quantity) || 0,
              destinations: dests,
              shippedAt: sp.shipped_at,
              load: sp.shipping_loads,
            });
          }
        }

        for (const [loadId, group] of shippedLoadMap) {
          const alreadyHasLoad = timelineEvents.some(e => e.id.includes(loadId));
          if (!alreadyHasLoad && group.load) {
            timelineEvents.push({
              id: `shipped-released-${loadId}`,
              type: "load_created",
              title: "Pallets Released",
              description: `${group.count} pallet${group.count !== 1 ? "s" : ""} released in Load ${group.load.load_number} — ${group.totalVolume.toLocaleString()} total volume`,
              timestamp: group.shippedAt,
              status: "approved",
              icon: "check",
              metadata: { load_number: group.load.load_number },
            });

            // Check for delivery dates per destination from shipped_pallets
            const deliveredByDest = new Map<string, string>();
            for (const sp of shippedPallets) {
              if (sp.load_id === loadId && sp.destination && sp.delivery_date) {
                if (!deliveredByDest.has(sp.destination) || sp.delivery_date > deliveredByDest.get(sp.destination)!) {
                  deliveredByDest.set(sp.destination, sp.delivery_date);
                }
              }
            }

            for (const [dest, date] of deliveredByDest) {
              timelineEvents.push({
                id: `shipped-dest-delivered-${loadId}-${dest}`,
                type: "load_delivered",
                title: "Delivered",
                description: `Load ${group.load.load_number} arrived at ${dest}`,
                timestamp: date,
                status: "approved",
                icon: "check",
                metadata: { load_number: group.load.load_number },
              });
            }
          }
        }
      }

      // Sort all events by timestamp
      timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setEvents(timelineEvents);
    } catch (error) {
      console.error("Error fetching activity data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return timestamp;
    }
  };

  const timelineContent = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mb-4" />
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-6">
            {events.map((event) => {
              const Icon = iconMap[event.icon];
              return (
                <div key={event.id} className="relative pl-10">
                  <div className={cn(
                    "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 bg-background",
                    event.status === "approved" && "border-success text-success",
                    event.status === "rejected" && "border-destructive text-destructive",
                    event.status === "pending" && "border-warning text-warning",
                    event.status === "info" && "border-info text-info",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{event.title}</h4>
                          {event.status && event.status !== "info" && (
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", statusColors[event.status])}
                            >
                              {event.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.description}
                        </p>
                        {event.metadata?.reason && (
                          <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-muted-foreground/30 pl-2">
                            "{event.metadata.reason}"
                          </p>
                        )}
                        {event.metadata?.load_number && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" />
                            Load: {event.metadata.load_number}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  if (isInline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Timeline
            {order.is_hot_order && (
              <Badge variant="destructive" className="gap-1">
                <Flame className="h-3 w-3" />
                Hot Order
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timelineContent}
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Timeline - {order.po_number}
            {order.is_hot_order && (
              <Badge variant="destructive" className="gap-1">
                <Flame className="h-3 w-3" />
                Hot Order
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {timelineContent}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

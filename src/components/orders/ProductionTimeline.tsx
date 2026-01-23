import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, isWithinInterval, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Flame, Printer, Settings, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

interface Order {
  id: string;
  po_number: string;
  product_name?: string;
  quantity: number;
  requested_delivery_date: string | null;
  printing_date: string | null;
  conversion_date: string | null;
  estimated_delivery_date: string | null;
  is_hot_order: boolean;
  status: string;
}

interface ProductionTimelineProps {
  orders: Order[];
  weeksToShow?: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-muted",
  accepted: "bg-info/20 border-info/30",
  "in-production": "bg-primary/20 border-primary/30",
  shipped: "bg-warning/20 border-warning/30",
  delivered: "bg-success/20 border-success/30",
};

export function ProductionTimeline({ orders, weeksToShow = 8 }: ProductionTimelineProps) {
  const navigate = useNavigate();

  const weeks = useMemo(() => {
    const today = new Date();
    const result = [];
    
    // Start from 2 weeks ago to show recent history
    for (let i = -2; i < weeksToShow; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      result.push({
        start: weekStart,
        end: weekEnd,
        label: format(weekStart, "MMM d"),
        isCurrent: i === 0,
      });
    }
    return result;
  }, [weeksToShow]);

  const getOrderDates = (order: Order) => {
    const dates: { type: 'printing' | 'conversion' | 'delivery' | 'requested'; date: Date; label: string }[] = [];
    
    if (order.printing_date) {
      dates.push({ type: 'printing', date: parseISO(order.printing_date), label: 'Printing' });
    }
    if (order.conversion_date) {
      dates.push({ type: 'conversion', date: parseISO(order.conversion_date), label: 'Conversion' });
    }
    if (order.estimated_delivery_date) {
      dates.push({ type: 'delivery', date: parseISO(order.estimated_delivery_date), label: 'Est. Delivery' });
    }
    if (order.requested_delivery_date) {
      dates.push({ type: 'requested', date: parseISO(order.requested_delivery_date), label: 'Customer Date' });
    }
    
    return dates;
  };

  const getDateInWeek = (order: Order, weekStart: Date, weekEnd: Date) => {
    const dates = getOrderDates(order);
    return dates.filter(d => isWithinInterval(d.date, { start: weekStart, end: weekEnd }));
  };

  const getOrderTimelineSpan = (order: Order) => {
    const dates = getOrderDates(order);
    if (dates.length === 0) return null;
    
    const sortedDates = dates.sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      start: sortedDates[0].date,
      end: sortedDates[sortedDates.length - 1].date,
      days: differenceInDays(sortedDates[sortedDates.length - 1].date, sortedDates[0].date),
    };
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const span = getOrderTimelineSpan(order);
      if (!span) return false;
      
      const timelineStart = weeks[0].start;
      const timelineEnd = weeks[weeks.length - 1].end;
      
      return (
        isWithinInterval(span.start, { start: timelineStart, end: timelineEnd }) ||
        isWithinInterval(span.end, { start: timelineStart, end: timelineEnd }) ||
        (span.start <= timelineStart && span.end >= timelineEnd)
      );
    });
  }, [orders, weeks]);

  const dateTypeIcons: Record<string, React.ReactNode> = {
    printing: <Printer className="h-3 w-3" />,
    conversion: <Settings className="h-3 w-3" />,
    delivery: <Package className="h-3 w-3" />,
    requested: <Package className="h-3 w-3 text-accent" />,
  };

  const dateTypeColors: Record<string, string> = {
    printing: "bg-info text-info-foreground",
    conversion: "bg-primary text-primary-foreground",
    delivery: "bg-success text-success-foreground",
    requested: "bg-accent text-accent-foreground",
  };

  return (
    <TooltipProvider>
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold text-card-foreground">Production Timeline</h2>
          <p className="text-sm text-muted-foreground">Weekly view of production and delivery dates</p>
          
          <div className="flex gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-info flex items-center justify-center">
                <Printer className="h-2.5 w-2.5 text-info-foreground" />
              </div>
              <span className="text-muted-foreground">Printing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center">
                <Settings className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
              <span className="text-muted-foreground">Conversion</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-success flex items-center justify-center">
                <Package className="h-2.5 w-2.5 text-success-foreground" />
              </div>
              <span className="text-muted-foreground">Est. Delivery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-accent flex items-center justify-center">
                <Package className="h-2.5 w-2.5 text-accent-foreground" />
              </div>
              <span className="text-muted-foreground">Customer Date</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header - Weeks */}
            <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `200px repeat(${weeks.length}, 1fr)` }}>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase border-r">
                Orden
              </div>
              {weeks.map((week, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-2 py-2 text-xs font-medium text-center border-r last:border-r-0",
                    week.isCurrent ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                  )}
                >
                  {week.label}
                </div>
              ))}
            </div>

            {/* Orders */}
            {filteredOrders.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No orders with scheduled dates in this period
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid border-b last:border-b-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: `200px repeat(${weeks.length}, 1fr)` }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  {/* Order Info */}
                  <div className="px-4 py-3 border-r flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-card-foreground">
                        {order.po_number}
                      </span>
                      {order.is_hot_order && (
                        <Flame className="h-3.5 w-3.5 text-accent animate-pulse" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {order.product_name || "Producto no especificado"}
                    </span>
                    <Badge variant="outline" className={cn("w-fit text-[10px] mt-0.5", statusColors[order.status])}>
                      {order.status === 'in-production' ? 'In Production' : 
                       order.status === 'pending' ? 'Pending' :
                       order.status === 'accepted' ? 'Accepted' :
                       order.status === 'shipped' ? 'Shipped' :
                       order.status === 'delivered' ? 'Delivered' : order.status}
                    </Badge>
                  </div>

                  {/* Week Cells */}
                  {weeks.map((week, weekIdx) => {
                    const datesInWeek = getDateInWeek(order, week.start, week.end);
                    
                    return (
                      <div
                        key={weekIdx}
                        className={cn(
                          "px-1 py-2 border-r last:border-r-0 flex flex-wrap items-center justify-center gap-1",
                          week.isCurrent && "bg-primary/5"
                        )}
                      >
                        {datesInWeek.map((dateInfo, idx) => (
                          <Tooltip key={idx}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "h-6 w-6 rounded flex items-center justify-center cursor-pointer hover:scale-110 transition-transform",
                                  dateTypeColors[dateInfo.type]
                                )}
                              >
                                {dateTypeIcons[dateInfo.type]}
                              </div>
                            </TooltipTrigger>
                          <TooltipContent>
                              <p className="font-medium">{dateInfo.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(dateInfo.date, "EEEE, MMMM d")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

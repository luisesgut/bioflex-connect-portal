import { useState } from "react";
import { format, addWeeks, addDays } from "date-fns";
import { CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AcceptOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    po_number: string;
    is_hot_order: boolean;
    product_name: string | null;
  } | null;
  onAccepted: () => void;
}

export function AcceptOrderDialog({
  open,
  onOpenChange,
  order,
  onAccepted,
}: AcceptOrderDialogProps) {
  const { user } = useAuth();
  const [salesOrderNumber, setSalesOrderNumber] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<Date | undefined>(
    order?.is_hot_order ? undefined : addWeeks(new Date(), 4)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens with new order
  useState(() => {
    if (order) {
      setSalesOrderNumber("");
      setEstimatedDeliveryDate(order.is_hot_order ? undefined : addWeeks(new Date(), 4));
    }
  });

  const handleAccept = async () => {
    if (!order || !user) return;

    if (!salesOrderNumber.trim()) {
      toast.error("Please enter your internal Sales Order number");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("purchase_orders")
      .update({
        status: "accepted",
        sales_order_number: salesOrderNumber.trim(),
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        estimated_delivery_date: estimatedDeliveryDate
          ? format(estimatedDeliveryDate, "yyyy-MM-dd")
          : null,
      })
      .eq("id", order.id);

    setIsSubmitting(false);

    if (error) {
      console.error("Error accepting order:", error);
      toast.error("Failed to accept order");
      return;
    }

    toast.success(`Order ${order.po_number} accepted successfully`);
    setSalesOrderNumber("");
    onOpenChange(false);
    onAccepted();
  };

  const deadlineText = order?.is_hot_order
    ? "You have 2 days to confirm delivery date for hot orders"
    : "Default production time is 4 weeks";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Accept Purchase Order
          </DialogTitle>
          <DialogDescription>
            Accept PO <span className="font-mono font-semibold">{order?.po_number}</span>
            {order?.product_name && (
              <span className="block mt-1 text-muted-foreground">
                Product: {order.product_name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="sales-order">
              Internal Sales Order Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sales-order"
              placeholder="Enter your ERP Sales Order #"
              value={salesOrderNumber}
              onChange={(e) => setSalesOrderNumber(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This will be used to track the order in your ERP system
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Estimated Delivery Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !estimatedDeliveryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {estimatedDeliveryDate ? (
                    format(estimatedDeliveryDate, "PPP")
                  ) : (
                    <span>Select delivery date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={estimatedDeliveryDate}
                  onSelect={setEstimatedDeliveryDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">{deadlineText}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={isSubmitting || !salesOrderNumber.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

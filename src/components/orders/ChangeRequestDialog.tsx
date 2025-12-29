import { useState } from "react";
import { Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Order {
  id: string;
  po_number: string;
  quantity: number;
  do_not_delay?: boolean;
}

interface ChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSubmitted: () => void;
}

export function ChangeRequestDialog({
  open,
  onOpenChange,
  order,
  onSubmitted,
}: ChangeRequestDialogProps) {
  const { user } = useAuth();
  const [requestType, setRequestType] = useState<"volume_change" | "cancellation" | "do_not_delay">("volume_change");
  const [newQuantity, setNewQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!order || !user) return;

    if (requestType !== "do_not_delay" && !reason.trim()) {
      toast.error("Please provide a reason for your request");
      return;
    }

    if (requestType === "volume_change") {
      const qty = parseInt(newQuantity.replace(/,/g, ""), 10);
      if (isNaN(qty) || qty <= 0) {
        toast.error("Please enter a valid quantity");
        return;
      }
      if (qty === order.quantity) {
        toast.error("New quantity must be different from current quantity");
        return;
      }
    }

    if (requestType === "do_not_delay" && order.do_not_delay) {
      toast.error("This order is already marked as Do Not Delay");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("order_change_requests").insert({
        purchase_order_id: order.id,
        request_type: requestType,
        current_quantity: order.quantity,
        requested_quantity: requestType === "volume_change" 
          ? parseInt(newQuantity.replace(/,/g, ""), 10) 
          : null,
        reason: reason.trim() || "Requesting Do Not Delay status",
        requested_by: user.id,
      });

      if (error) throw error;

      toast.success("Change request submitted successfully");
      onOpenChange(false);
      onSubmitted();
      
      // Reset form
      setRequestType("volume_change");
      setNewQuantity("");
      setReason("");
    } catch (error) {
      console.error("Error submitting change request:", error);
      toast.error("Failed to submit change request");
    } finally {
      setSubmitting(false);
    }
  };

  const formatQuantity = (value: string) => {
    const num = value.replace(/\D/g, "");
    return num ? parseInt(num, 10).toLocaleString() : "";
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Order Change</DialogTitle>
          <DialogDescription>
            Submit a change request for PO #{order.po_number}. Your request will be reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Request Type</Label>
            <RadioGroup
              value={requestType}
              onValueChange={(val) => setRequestType(val as "volume_change" | "cancellation" | "do_not_delay")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="volume_change" id="volume_change" />
                <Label htmlFor="volume_change" className="font-normal cursor-pointer">
                  Change Volume
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cancellation" id="cancellation" />
                <Label htmlFor="cancellation" className="font-normal cursor-pointer">
                  Cancel Order
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="do_not_delay" id="do_not_delay" disabled={order?.do_not_delay} />
                <Label htmlFor="do_not_delay" className="font-normal cursor-pointer flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  Mark as Do Not Delay
                  {order?.do_not_delay && <span className="text-xs text-muted-foreground">(Already set)</span>}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {requestType === "volume_change" && (
            <div className="space-y-2">
              <Label htmlFor="quantity">New Quantity</Label>
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Current: {order.quantity.toLocaleString()}
                </div>
                <span className="text-muted-foreground">→</span>
                <Input
                  id="quantity"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(formatQuantity(e.target.value))}
                  placeholder="New quantity"
                  className="w-32"
                />
              </div>
            </div>
          )}

          {requestType !== "do_not_delay" && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Change</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  requestType === "cancellation"
                    ? "Please explain why you need to cancel this order..."
                    : "Please explain why you need to change the quantity..."
                }
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

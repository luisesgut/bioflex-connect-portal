import { useState, useEffect } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EditableOrder {
  id: string;
  po_number: string;
  quantity: number;
  price_per_thousand: number | null;
  total_price: number | null;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  printing_date: string | null;
  conversion_date: string | null;
  sales_order_number: string | null;
  notes: string | null;
  is_hot_order: boolean;
  do_not_delay: boolean;
  status: string;
}

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: EditableOrder;
  onSaved: () => void;
}

export function EditOrderDialog({ open, onOpenChange, order, onSaved }: EditOrderDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(order.estimated_delivery_date || "");
  const [notes, setNotes] = useState(order.notes || "");
  const [isHotOrder, setIsHotOrder] = useState(order.is_hot_order);
  const [doNotDelay, setDoNotDelay] = useState(order.do_not_delay);

  useEffect(() => {
    if (open) {
      setEstimatedDeliveryDate(order.estimated_delivery_date || "");
      setNotes(order.notes || "");
      setIsHotOrder(order.is_hot_order);
      setDoNotDelay(order.do_not_delay);
    }
  }, [open, order]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Build changes list for activity log
      const changes: string[] = [];
      const updates: Record<string, unknown> = {};

      if (quantity !== order.quantity) {
        changes.push(`Quantity: ${order.quantity.toLocaleString()} → ${quantity.toLocaleString()}`);
        updates.quantity = quantity;
      }
      if (pricePerThousand !== (order.price_per_thousand ?? 0)) {
        changes.push(`Price/1000: $${(order.price_per_thousand ?? 0).toFixed(2)} → $${pricePerThousand.toFixed(2)}`);
        updates.price_per_thousand = pricePerThousand || null;
      }
      if (totalPrice !== (order.total_price ?? 0)) {
        changes.push(`Total Price: $${(order.total_price ?? 0).toFixed(2)} → $${totalPrice.toFixed(2)}`);
        updates.total_price = totalPrice || null;
      }
      if (requestedDeliveryDate !== (order.requested_delivery_date || "")) {
        changes.push(`Customer Delivery: ${order.requested_delivery_date || "TBD"} → ${requestedDeliveryDate || "TBD"}`);
        updates.requested_delivery_date = requestedDeliveryDate || null;
      }
      if (estimatedDeliveryDate !== (order.estimated_delivery_date || "")) {
        changes.push(`Bioflex Delivery: ${order.estimated_delivery_date || "TBD"} → ${estimatedDeliveryDate || "TBD"}`);
        updates.estimated_delivery_date = estimatedDeliveryDate || null;
      }
      if (printingDate !== (order.printing_date || "")) {
        changes.push(`Printing Date: ${order.printing_date || "TBD"} → ${printingDate || "TBD"}`);
        updates.printing_date = printingDate || null;
      }
      if (conversionDate !== (order.conversion_date || "")) {
        changes.push(`Conversion Date: ${order.conversion_date || "TBD"} → ${conversionDate || "TBD"}`);
        updates.conversion_date = conversionDate || null;
      }
      if (salesOrderNumber !== (order.sales_order_number || "")) {
        changes.push(`Sales Order #: ${order.sales_order_number || "—"} → ${salesOrderNumber || "—"}`);
        updates.sales_order_number = salesOrderNumber || null;
      }
      if (notes !== (order.notes || "")) {
        changes.push("Notes updated");
        updates.notes = notes || null;
      }
      if (isHotOrder !== order.is_hot_order) {
        changes.push(`Hot Order: ${order.is_hot_order ? "Yes" : "No"} → ${isHotOrder ? "Yes" : "No"}`);
        updates.is_hot_order = isHotOrder;
      }
      if (doNotDelay !== order.do_not_delay) {
        changes.push(`Do Not Delay: ${order.do_not_delay ? "Yes" : "No"} → ${doNotDelay ? "Yes" : "No"}`);
        updates.do_not_delay = doNotDelay;
      }

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        onOpenChange(false);
        return;
      }

      // Update the purchase order
      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", order.id);

      if (updateError) throw updateError;

      // Log the changes in po_status_history for the activity timeline
      const { error: historyError } = await supabase
        .from("po_status_history")
        .insert({
          purchase_order_id: order.id,
          old_status: order.status,
          new_status: order.status,
          changed_by: user.id,
          notes: `PO edited: ${changes.join(" | ")}`,
        });

      if (historyError) {
        console.error("Error logging edit to history:", historyError);
        // Don't fail the save for this
      }

      toast.success("Order updated successfully");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit PO — {order.po_number}
          </DialogTitle>
          <DialogDescription>
            Modify the purchase order details. Changes will be logged in the activity timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bioflex Delivery */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-estimated-delivery">Bioflex Delivery</Label>
            <Input
              id="edit-estimated-delivery"
              type="date"
              value={estimatedDeliveryDate}
              onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
            />
          </div>

          {/* Flags */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="edit-hot-order"
                checked={isHotOrder}
                onCheckedChange={setIsHotOrder}
              />
              <Label htmlFor="edit-hot-order">Hot Order</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-do-not-delay"
                checked={doNotDelay}
                onCheckedChange={setDoNotDelay}
              />
              <Label htmlFor="edit-do-not-delay">Do Not Delay</Label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

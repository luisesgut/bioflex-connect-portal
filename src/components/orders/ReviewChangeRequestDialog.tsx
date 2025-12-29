import { useState } from "react";
import { Loader2, ArrowRight, Clock } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChangeRequest {
  id: string;
  purchase_order_id: string;
  request_type: "volume_change" | "cancellation" | "do_not_delay";
  current_quantity: number;
  requested_quantity: number | null;
  reason: string;
  status: string;
  created_at: string;
  po_number?: string;
  product_name?: string;
}

interface ReviewChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChangeRequest | null;
  onReviewed: () => void;
}

export function ReviewChangeRequestDialog({
  open,
  onOpenChange,
  request,
  onReviewed,
}: ReviewChangeRequestDialogProps) {
  const { user } = useAuth();
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleReview = async (approved: boolean) => {
    if (!request || !user) return;

    setProcessing(true);
    try {
      // Update the change request status
      const { error: updateError } = await supabase
        .from("order_change_requests")
        .update({
          status: approved ? "approved" : "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes.trim() || null,
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // If approved, update the purchase order
      if (approved) {
        if (request.request_type === "cancellation") {
          const { error: poError } = await supabase
            .from("purchase_orders")
            .update({ status: "cancelled" })
            .eq("id", request.purchase_order_id);

          if (poError) throw poError;
        } else if (request.request_type === "volume_change" && request.requested_quantity) {
          const { error: poError } = await supabase
            .from("purchase_orders")
            .update({ quantity: request.requested_quantity })
            .eq("id", request.purchase_order_id);

          if (poError) throw poError;
        } else if (request.request_type === "do_not_delay") {
          const { error: poError } = await supabase
            .from("purchase_orders")
            .update({ do_not_delay: true })
            .eq("id", request.purchase_order_id);

          if (poError) throw poError;
        }
      }

      toast.success(approved ? "Request approved" : "Request rejected");
      onOpenChange(false);
      onReviewed();
      setAdminNotes("");
    } catch (error) {
      console.error("Error reviewing change request:", error);
      toast.error("Failed to process request");
    } finally {
      setProcessing(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Change Request</DialogTitle>
          <DialogDescription>
            Review and approve or reject this change request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">PO Number</span>
              <span className="font-mono font-medium">{request.po_number}</span>
            </div>
            {request.product_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Product</span>
                <span className="text-sm font-medium">{request.product_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Request Type</span>
              <Badge 
                variant={request.request_type === "cancellation" ? "destructive" : "secondary"}
                className={request.request_type === "do_not_delay" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : ""}
              >
                {request.request_type === "cancellation" 
                  ? "Cancellation" 
                  : request.request_type === "do_not_delay"
                  ? "Do Not Delay"
                  : "Volume Change"}
              </Badge>
            </div>
            {request.request_type === "do_not_delay" && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Clock className="h-4 w-4" />
                <span>Customer requests this order not be delayed</span>
              </div>
            )}
            {request.request_type === "volume_change" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Quantity Change</span>
                <div className="flex items-center gap-2 text-sm">
                  <span>{request.current_quantity.toLocaleString()}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-primary">
                    {request.requested_quantity?.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Submitted</span>
              <span className="text-sm">
                {new Date(request.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Customer's Reason</Label>
            <div className="rounded-lg border bg-background p-3 text-sm">
              {request.reason}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add any notes about this decision..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleReview(false)}
            disabled={processing}
            className="text-destructive hover:text-destructive"
          >
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject
          </Button>
          <Button onClick={() => handleReview(true)} disabled={processing}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

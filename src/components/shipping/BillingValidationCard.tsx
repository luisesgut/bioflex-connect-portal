import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle, XCircle, Clock, FileDown, FileCheck } from "lucide-react";
import { format } from "date-fns";

interface BillingValidation {
  id: string;
  load_id: string;
  submitted_by: string;
  submitted_at: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
}

interface BillingValidationCardProps {
  loadId: string;
  loadStatus: string;
  isAdmin: boolean;
  isBillingTeam: boolean;
  userId: string;
  onGenerateCustomsDocument: () => void;
  onValidationChange: () => void;
}

export function BillingValidationCard({
  loadId,
  loadStatus,
  isAdmin,
  isBillingTeam,
  userId,
  onGenerateCustomsDocument,
  onValidationChange,
}: BillingValidationCardProps) {
  const [validation, setValidation] = useState<BillingValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState<string | null>(null);

  const fetchValidation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("load_billing_validations")
        .select("*")
        .eq("load_id", loadId)
        .maybeSingle();

      if (error) throw error;
      setValidation(data);

      // Fetch profile names
      const userIds = [data?.submitted_by, data?.reviewed_by].filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        
        (profiles || []).forEach((p: any) => {
          if (p.user_id === data?.submitted_by) setSubmitterName(p.full_name);
          if (p.user_id === data?.reviewed_by) setReviewerName(p.full_name);
        });
      }
    } catch (error) {
      console.error("Error fetching billing validation:", error);
    } finally {
      setLoading(false);
    }
  }, [loadId]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  const handleSubmitForValidation = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("load_billing_validations")
        .insert({
          load_id: loadId,
          submitted_by: userId,
          status: "pending",
        });

      if (error) throw error;
      toast.success("Load sent for billing validation");
      fetchValidation();
      onValidationChange();
    } catch (error) {
      console.error("Error submitting for validation:", error);
      toast.error("Failed to submit for validation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!validation) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("load_billing_validations")
        .update({
          status: reviewAction,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewNotes.trim() || null,
        })
        .eq("id", validation.id);

      if (error) throw error;
      toast.success(`Validation ${reviewAction === "approved" ? "approved" : "rejected"}`);
      setReviewDialogOpen(false);
      setReviewNotes("");
      fetchValidation();
      onValidationChange();
    } catch (error) {
      console.error("Error reviewing validation:", error);
      toast.error("Failed to update validation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    if (!validation) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("load_billing_validations")
        .update({
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          reviewer_notes: null,
          submitted_at: new Date().toISOString(),
          submitted_by: userId,
        })
        .eq("id", validation.id);

      if (error) throw error;
      toast.success("Re-submitted for billing validation");
      fetchValidation();
      onValidationChange();
    } catch (error) {
      console.error("Error re-submitting:", error);
      toast.error("Failed to re-submit");
    } finally {
      setSubmitting(false);
    }
  };

  // Only show for approved loads (released) or later, and for admins or billing team
  const showCard = (loadStatus === "approved" || loadStatus === "pending_release") && (isAdmin || isBillingTeam);
  if (!showCard || loading) return null;

  const statusConfig: Record<string, { icon: any; label: string; color: string }> = {
    pending: { icon: Clock, label: "Pending Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
    approved: { icon: CheckCircle, label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
    rejected: { icon: XCircle, label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Billing Validation
          </CardTitle>
          {validation && (
            <Badge className={statusConfig[validation.status]?.color} variant="secondary">
              {statusConfig[validation.status]?.label || validation.status}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!validation ? (
            // No validation submitted yet
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate the customs document and send this load for billing team validation before marking as In Transit.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onGenerateCustomsDocument}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Customs Document
                </Button>
                {isAdmin && (
                  <Button size="sm" onClick={handleSubmitForValidation} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send to Billing
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Validation exists
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  Submitted by <span className="font-medium text-foreground">{submitterName || "..."}</span>
                  {" "}on {format(new Date(validation.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {validation.reviewed_at && (
                  <p className="text-muted-foreground">
                    {validation.status === "approved" ? "Approved" : "Rejected"} by{" "}
                    <span className="font-medium text-foreground">{reviewerName || "..."}</span>
                    {" "}on {format(new Date(validation.reviewed_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
                {validation.reviewer_notes && (
                  <p className="text-sm mt-2 p-2 rounded bg-muted">
                    <span className="font-medium">Notes:</span> {validation.reviewer_notes}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onGenerateCustomsDocument}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Customs Document
                </Button>
                
                {/* Billing team can approve/reject pending validations */}
                {(isBillingTeam || isAdmin) && validation.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => { setReviewAction("approved"); setReviewDialogOpen(true); }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setReviewAction("rejected"); setReviewDialogOpen(true); }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}

                {/* Admin can resubmit if rejected */}
                {isAdmin && validation.status === "rejected" && (
                  <Button size="sm" onClick={handleResubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Re-submit
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "Approve" : "Reject"} Billing Validation
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approved"
                ? "Confirm that the customs document values are correct."
                : "Provide notes on what needs to be corrected."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Notes {reviewAction === "rejected" ? "(required)" : "(optional)"}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={reviewAction === "rejected" ? "Explain what needs to be corrected..." : "Optional notes..."}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={submitting || (reviewAction === "rejected" && !reviewNotes.trim())}
              variant={reviewAction === "approved" ? "default" : "destructive"}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

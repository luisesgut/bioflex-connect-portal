import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, CheckCircle, XCircle, Clock, FileDown, FileCheck, Eye, Undo2, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { CustomsReviewDialog } from "./CustomsReviewDialog";
import { generateCustomsPDF } from "@/utils/generateCustomsPDF";
import { generateLoadChecklist } from "@/utils/generateLoadChecklist";
import { buildFromReleasedPallets, enrichWithTraceability } from "./CustomsReviewDialog";

interface BillingValidation {
  id: string;
  load_id: string;
  submitted_by: string;
  submitted_at: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  validated_data: any;
}

interface BillingValidationCardProps {
  loadId: string;
  loadStatus: string;
  isAdmin: boolean;
  isBillingTeam: boolean;
  userId: string;
  loadNumber: string;
  shippingDate: string;
  onValidationChange: () => void;
}

export function BillingValidationCard({
  loadId,
  loadStatus,
  isAdmin,
  isBillingTeam,
  userId,
  loadNumber,
  shippingDate,
  onValidationChange,
}: BillingValidationCardProps) {
  const [validation, setValidation] = useState<BillingValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  const fetchValidation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("load_billing_validations")
        .select("*")
        .eq("load_id", loadId)
        .maybeSingle();

      if (error) throw error;
      setValidation(data);

      const userIds = [data?.reviewed_by].filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        (profiles || []).forEach((p: any) => {
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

  const handleUndo = async () => {
    if (!validation) return;
    setUndoing(true);
    try {
      const { error } = await supabase
        .from("load_billing_validations")
        .delete()
        .eq("id", validation.id);

      if (error) throw error;
      toast.success("Billing validation undone");
      setValidation(null);
      setUndoDialogOpen(false);
      onValidationChange();
    } catch (error) {
      console.error("Error undoing validation:", error);
      toast.error("Error undoing validation");
    } finally {
      setUndoing(false);
    }
  };

  const handleSaved = () => {
    fetchValidation();
    onValidationChange();
  };

  const showCard =
    (loadStatus === "approved" || loadStatus === "pending_release") &&
    (isAdmin || isBillingTeam);
  if (!showCard || loading) return null;

  const statusConfig: Record<string, { icon: any; label: string; color: string }> = {
    pending: { icon: Clock, label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
    approved: { icon: CheckCircle, label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
    rejected: { icon: XCircle, label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  };

  const isApproved = validation?.status === "approved";

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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review the export document breakdown and validate the data before marking as In Transit.
              </p>
              <Button size="sm" onClick={() => setReviewDialogOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Review & Validate
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                {validation.reviewed_at && (
                  <p className="text-muted-foreground">
                    {validation.status === "approved" ? "Approved" : "Reviewed"} by{" "}
                    <span className="font-medium text-foreground">{reviewerName || "..."}</span>
                    {" "}on {format(new Date(validation.reviewed_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewDialogOpen(true)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {isApproved ? "View Breakdown" : "Review"}
                </Button>

                {isApproved && validation?.validated_data && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const freshProducts = await buildFromReleasedPallets(loadId);
                        const enriched = await enrichWithTraceability(loadId, freshProducts);
                        const totalPalletCount = enriched.reduce((s: number, p: any) => s + p.totalPallets, 0);
                        const vd = validation?.validated_data;
                        const savedFreight = vd && !Array.isArray(vd) && vd.freightCost != null ? Number(vd.freightCost) : 5000;
                        const savedExchange = vd && !Array.isArray(vd) && vd.exchangeRate != null ? Number(vd.exchangeRate) : 17.5;
                        generateCustomsPDF(
                          { loadNumber, shippingDate },
                          enriched,
                          totalPalletCount,
                          savedFreight,
                          savedExchange
                        );
                        toast.success("PDF downloaded");
                      }}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const freshProducts = await buildFromReleasedPallets(loadId);
                        const enriched = await enrichWithTraceability(loadId, freshProducts);
                        const totalPalletCount = enriched.reduce((s: number, p: any) => s + p.totalPallets, 0);
                        generateLoadChecklist(
                          { loadNumber, shippingDate },
                          enriched,
                          totalPalletCount
                        );
                        toast.success("Checklist downloaded");
                      }}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Floor Checklist
                    </Button>
                  </>
                )}

                {(isAdmin || isBillingTeam) && validation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setUndoDialogOpen(true)}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Undo
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomsReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        loadId={loadId}
        loadNumber={loadNumber}
        shippingDate={shippingDate}
        existingData={validation?.validated_data || null}
        validationId={validation?.id || null}
        userId={userId}
        isReadOnly={isApproved}
        onSaved={handleSaved}
      />

      <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Billing Validation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the validation and any edited data. You can create a new validation afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={undoing}>
              {undoing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

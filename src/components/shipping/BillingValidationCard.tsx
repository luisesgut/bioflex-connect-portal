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
import { Loader2, CheckCircle, XCircle, Clock, FileDown, FileCheck, Eye, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { CustomsReviewDialog, type CustomsProductSummary } from "./CustomsReviewDialog";

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

interface PalletData {
  pt_code: string;
  description: string;
  destination: string | null;
  quantity: number;
  gross_weight: number | null;
  net_weight: number | null;
  pieces: number | null;
  unit: string;
  customer_lot: string | null;
  bfx_order: string | null;
}

interface OrderInfo {
  customer_lot: string;
  sales_order_number: string | null;
  price_per_thousand: number | null;
  pieces_per_pallet: number | null;
  piezas_por_paquete: number | null;
}

interface BillingValidationCardProps {
  loadId: string;
  loadStatus: string;
  isAdmin: boolean;
  isBillingTeam: boolean;
  userId: string;
  pallets: PalletData[];
  orderInfo: Map<string, OrderInfo>;
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
  pallets,
  orderInfo,
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

  const handleUndo = async () => {
    if (!validation) return;
    setUndoing(true);
    try {
      const { error } = await supabase
        .from("load_billing_validations")
        .delete()
        .eq("id", validation.id);

      if (error) throw error;
      toast.success("Validación de facturación deshecha");
      setValidation(null);
      setUndoDialogOpen(false);
      onValidationChange();
    } catch (error) {
      console.error("Error undoing validation:", error);
      toast.error("Error al deshacer la validación");
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
    pending: { icon: Clock, label: "Pendiente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
    approved: { icon: CheckCircle, label: "Aprobado", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
    rejected: { icon: XCircle, label: "Rechazado", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  };

  const existingData: CustomsProductSummary[] | null =
    validation?.validated_data
      ? (validation.validated_data as CustomsProductSummary[])
      : null;

  const isApproved = validation?.status === "approved";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Validación de Facturación
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
                Revisa el desglose del documento de exportación y valida los datos antes de marcar como In Transit.
              </p>
              <Button size="sm" onClick={() => setReviewDialogOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Revisar y Validar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                {validation.reviewed_at && (
                  <p className="text-muted-foreground">
                    {validation.status === "approved" ? "Aprobado" : "Revisado"} por{" "}
                    <span className="font-medium text-foreground">{reviewerName || "..."}</span>
                    {" "}el {format(new Date(validation.reviewed_at), "d MMM yyyy 'a las' h:mm a")}
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
                  {isApproved ? "Ver Desglose" : "Revisar"}
                </Button>

                {isApproved && existingData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Trigger PDF download directly from the dialog
                      setReviewDialogOpen(true);
                    }}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </Button>
                )}

                {/* Undo validation - available for admins and billing team */}
                {(isAdmin || isBillingTeam) && validation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setUndoDialogOpen(true)}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Deshacer
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customs Review Dialog */}
      <CustomsReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        loadId={loadId}
        loadNumber={loadNumber}
        shippingDate={shippingDate}
        pallets={pallets}
        orderInfo={orderInfo}
        existingData={existingData}
        validationId={validation?.id || null}
        userId={userId}
        isReadOnly={isApproved}
        onSaved={handleSaved}
      />

      {/* Undo Confirmation */}
      <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer validación de facturación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará la validación y los datos editados. Podrás volver a crear una nueva validación después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={undoing}>
              {undoing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deshacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

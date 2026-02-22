import { useState, useEffect } from "react";
import { FileEdit, Loader2, AlertCircle, XCircle, CheckCircle2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { ReviewChangeRequestDialog } from "@/components/orders/ReviewChangeRequestDialog";

interface ChangeRequest {
  id: string;
  purchase_order_id: string;
  request_type: "volume_change" | "cancellation";
  current_quantity: number;
  requested_quantity: number | null;
  reason: string;
  status: string;
  created_at: string;
  po_number?: string;
  product_name?: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <AlertCircle className="h-4 w-4" />,
  approved: <CheckCircle2 className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
};

export default function ChangeRequests() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin } = useAdmin();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending">("pending");

  const fetchRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from("order_change_requests")
        .select(`
          id,
          purchase_order_id,
          request_type,
          current_quantity,
          requested_quantity,
          reason,
          status,
          created_at,
          purchase_orders (
            po_number,
            products (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (filter === "pending") {
        query = query.eq("status", "pending");
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedRequests = (data || []).map((req: any) => ({
        id: req.id,
        purchase_order_id: req.purchase_order_id,
        request_type: req.request_type,
        current_quantity: req.current_quantity,
        requested_quantity: req.requested_quantity,
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        po_number: req.purchase_orders?.po_number,
        product_name: req.purchase_orders?.products?.name,
      }));

      setRequests(formattedRequests);
    } catch (error) {
      console.error("Error fetching change requests:", error);
      toast.error("Failed to load change requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user, filter]);

  const handleReview = (request: ChangeRequest) => {
    setSelectedRequest(request);
    setReviewDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('page.changeRequests.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t('page.changeRequests.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Requests Table */}
        {!loading && requests.length > 0 && (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden animate-slide-up">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      PO Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Change
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Submitted
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((request) => (
                    <tr key={request.id} className="transition-colors hover:bg-muted/20">
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono text-sm font-medium text-card-foreground">
                          {request.po_number || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-card-foreground">
                          {request.product_name || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant={request.request_type === "cancellation" ? "destructive" : "secondary"}>
                          {request.request_type === "cancellation" ? "Cancel" : "Volume"}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {request.request_type === "volume_change" ? (
                          <span>
                            {request.current_quantity.toLocaleString()} → {request.requested_quantity?.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Full cancellation</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant="outline" className={cn("gap-1.5 font-medium capitalize", statusStyles[request.status])}>
                          {statusIcons[request.status]}
                          {request.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(request.created_at)}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          {request.status === "pending" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleReview(request)}
                            >
                              Review
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <FileEdit className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No change requests</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "pending" 
                ? "There are no pending change requests" 
                : "No change requests have been submitted yet"}
            </p>
          </div>
        )}

        {/* Review Dialog */}
        <ReviewChangeRequestDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          request={selectedRequest}
          onReviewed={fetchRequests}
        />
      </div>
    </MainLayout>
  );
}

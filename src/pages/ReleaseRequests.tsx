import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Loader2, Eye, Clock, CheckCircle, XCircle, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";

interface ReleaseRequest {
  id: string;
  load_id: string;
  requested_at: string;
  status: "pending" | "approved" | "on_hold" | "shipped";
  response_at: string | null;
  release_number: string | null;
  is_hot_order: boolean;
  load: {
    load_number: string;
    shipping_date: string;
    total_pallets: number;
  };
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  on_hold: <XCircle className="h-4 w-4" />,
  shipped: <Truck className="h-4 w-4" />,
};

export default function ReleaseRequests() {
  const { isAdmin } = useAdmin();
  const [requests, setRequests] = useState<ReleaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("release_requests")
        .select(`
          id,
          load_id,
          requested_at,
          status,
          response_at,
          release_number,
          is_hot_order,
          load:shipping_loads(load_number, shipping_date, total_pallets)
        `)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setRequests(data as any || []);
    } catch (error) {
      console.error("Error fetching release requests:", error);
      toast.error("Failed to load release requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getUrgencyInfo = (request: ReleaseRequest) => {
    if (request.status !== "pending") return null;

    const shippingDate = new Date(request.load.shipping_date);
    const now = new Date();
    const hoursUntilShipping = differenceInHours(shippingDate, now);

    if (hoursUntilShipping < 0) {
      return {
        text: "Past due",
        className: "text-destructive font-semibold",
      };
    } else if (hoursUntilShipping < 24) {
      return {
        text: `${hoursUntilShipping}h until ship`,
        className: "text-yellow-600 font-semibold",
      };
    } else {
      const days = Math.floor(hoursUntilShipping / 24);
      return {
        text: `${days}d until ship`,
        className: "text-muted-foreground",
      };
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const onHoldCount = requests.filter((r) => r.status === "on_hold").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Release Requests</h1>
          <p className="text-muted-foreground">
            Review and respond to shipment release requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">awaiting response</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">ready to ship</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Hold</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onHoldCount}</div>
              <p className="text-xs text-muted-foreground">shipment delayed</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No release requests</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-1">
                Release requests will appear here when loads are ready for customer approval.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Load #</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Ship Date</TableHead>
                  <TableHead className="text-center">Pallets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Release #</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const urgency = getUrgencyInfo(request);
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {request.load.load_number}
                          {request.is_hot_order && (
                            <Badge variant="destructive" className="text-xs">
                              HOT
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(request.requested_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.load.shipping_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-center">
                        {request.load.total_pallets}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusStyles[request.status]} variant="secondary">
                          <span className="mr-1">{statusIcons[request.status]}</span>
                          {request.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{request.release_number || "-"}</TableCell>
                      <TableCell>
                        {urgency && (
                          <span className={urgency.className}>{urgency.text}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/shipping-loads/${request.load_id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

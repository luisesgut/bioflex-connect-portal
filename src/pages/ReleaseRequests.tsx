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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Loader2, Eye, Clock, CheckCircle, XCircle, Truck, Package, MapPin, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import { TransitTrackingTable } from "@/components/shipping/TransitTrackingTable";

interface ReleaseRequest {
  id: string;
  load_id: string;
  requested_at: string;
  status: "pending" | "approved" | "on_hold" | "shipped";
  response_at: string | null;
  release_number: string | null;
  is_hot_order: boolean;
  load: {
    id: string;
    load_number: string;
    shipping_date: string;
    estimated_delivery_date: string | null;
    total_pallets: number;
    status: string;
    eta_cross_border: string | null;
    documents_sent: boolean;
    border_crossed: boolean;
    last_reported_city: string | null;
    transit_notes: string | null;
  };
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  pending_release: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  pending_release: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  on_hold: <XCircle className="h-4 w-4" />,
  shipped: <Truck className="h-4 w-4" />,
  in_transit: <Package className="h-4 w-4" />,
  delivered: <MapPin className="h-4 w-4" />,
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  pending_release: "Pending Release",
  approved: "Released",
  on_hold: "On Hold",
  shipped: "Shipped",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const loadStatusOptions = [
  { value: "pending_release", label: "Pending Release" },
  { value: "approved", label: "Released" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

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
          load:shipping_loads(id, load_number, shipping_date, estimated_delivery_date, total_pallets, status, eta_cross_border, documents_sent, border_crossed, last_reported_city, transit_notes)
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

  const handleStatusChange = async (request: ReleaseRequest, newLoadStatus: string) => {
    try {
      // Map load status to release request status
      type ReleaseStatus = "pending" | "approved" | "on_hold" | "shipped";
      type LoadStatus = "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
      
      const releaseStatusMap: Record<string, ReleaseStatus> = {
        pending_release: "pending",
        approved: "approved",
        in_transit: "shipped",
        delivered: "shipped",
      };

      const newReleaseStatus: ReleaseStatus = releaseStatusMap[newLoadStatus] || "pending";

      // Update load status
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: newLoadStatus as LoadStatus })
        .eq("id", request.load_id);

      if (loadError) throw loadError;

      // Update release request status
      const { error: requestError } = await supabase
        .from("release_requests")
        .update({ 
          status: newReleaseStatus,
          response_at: newReleaseStatus !== "pending" ? new Date().toISOString() : null
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      toast.success(`Status updated to ${newLoadStatus.replace("_", " ")}`);
      fetchRequests();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDateChange = async (loadId: string, field: 'shipping_date' | 'estimated_delivery_date', date: Date) => {
    try {
      const { error } = await supabase
        .from("shipping_loads")
        .update({ [field]: format(date, "yyyy-MM-dd") })
        .eq("id", loadId);

      if (error) throw error;

      toast.success("Date updated successfully");
      fetchRequests();
    } catch (error) {
      console.error("Error updating date:", error);
      toast.error("Failed to update date");
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const onHoldCount = requests.filter((r) => r.status === "on_hold").length;

  // Split requests into categories based on load status
  const pendingLoads = requests.filter((r) => 
    r.load.status === "pending_release" || r.load.status === "approved" || r.load.status === "on_hold"
  );
  const inTransitLoads = requests.filter((r) => r.load.status === "in_transit");
  const deliveredLoads = requests.filter((r) => r.load.status === "delivered");

  const renderTable = (items: ReleaseRequest[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Load #</TableHead>
              <TableHead>Ship Date</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead className="text-center">Pallets</TableHead>
              <TableHead>Load Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((request) => (
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
                <TableCell>
                  {isAdmin ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-auto p-1 font-normal">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {format(new Date(request.load.shipping_date), "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={new Date(request.load.shipping_date)}
                          onSelect={(date) => date && handleDateChange(request.load.id, 'shipping_date', date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    format(new Date(request.load.shipping_date), "MMM d, yyyy")
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-auto p-1 font-normal">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {request.load.estimated_delivery_date 
                            ? format(new Date(request.load.estimated_delivery_date), "MMM d, yyyy")
                            : "Set date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={request.load.estimated_delivery_date ? new Date(request.load.estimated_delivery_date) : undefined}
                          onSelect={(date) => date && handleDateChange(request.load.id, 'estimated_delivery_date', date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    request.load.estimated_delivery_date 
                      ? format(new Date(request.load.estimated_delivery_date), "MMM d, yyyy")
                      : "-"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {request.load.total_pallets}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Select
                      value={request.load.status}
                      onValueChange={(value) => handleStatusChange(request, value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {loadStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusStyles[request.load.status] || statusStyles[request.status]} variant="secondary">
                      <span className="mr-1">{statusIcons[request.load.status] || statusIcons[request.status]}</span>
                      {statusLabels[request.load.status] || statusLabels[request.status] || request.load.status}
                    </Badge>
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
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.releaseRequests.title')}</h1>
          <p className="text-muted-foreground">
            {t('page.releaseRequests.subtitle')}
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

        {/* Loading State */}
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
          <div className="space-y-8">
            {/* Pending Loads Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <h2 className="text-lg font-semibold">Pending Loads</h2>
                <span className="text-sm text-muted-foreground">({pendingLoads.length})</span>
              </div>
              {renderTable(pendingLoads, "No pending loads")}
            </div>

            {/* In Transit Section - Enhanced with Transit Tracking */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold">In Transit</h2>
                <span className="text-sm text-muted-foreground">({inTransitLoads.length})</span>
              </div>
              <TransitTrackingTable
                loads={inTransitLoads}
                isAdmin={isAdmin}
                onRefresh={fetchRequests}
              />
            </div>

            {/* Delivered Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">Delivered</h2>
                <span className="text-sm text-muted-foreground">({deliveredLoads.length})</span>
              </div>
              {renderTable(deliveredLoads, "No delivered loads")}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

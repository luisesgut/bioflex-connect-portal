import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Plus,
  Search,
  Loader2,
  CalendarIcon,
  Eye,
  Send,
  Clock,
  Package,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { useCustomerLocations } from "@/hooks/useCustomerLocations";
import { TransitTrackingTable } from "@/components/shipping/TransitTrackingTable";

interface ShippingLoad {
  id: string;
  load_number: string;
  shipping_date: string;
  estimated_delivery_date: string | null;
  status: "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
  total_pallets: number;
  release_number: string | null;
  notes: string | null;
  created_at: string;
  eta_cross_border: string | null;
  documents_sent: boolean | null;
  border_crossed: boolean | null;
  last_reported_city: string | null;
  transit_notes: string | null;
}

interface ReleaseRequest {
  id: string;
  load_id: string;
  requested_at: string;
  status: "pending" | "approved" | "on_hold" | "shipped";
  response_at: string | null;
  release_number: string | null;
  is_hot_order: boolean;
}

const statusStyles: Record<string, string> = {
  assembling: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  pending_release: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
};

const statusLabels: Record<string, string> = {
  assembling: "Assembling",
  pending_release: "Pending Release",
  approved: "Released",
  on_hold: "On Hold",
  shipped: "Shipped",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const loadStatusOptions = [
  { value: "assembling", label: "Assembling" },
  { value: "pending_release", label: "Pending Release" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

export default function ShippingLoads() {
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getDestinationLabel } = useCustomerLocations();
  const [loads, setLoads] = useState<ShippingLoad[]>([]);
  const [releaseRequests, setReleaseRequests] = useState<ReleaseRequest[]>([]);
  const [destinationDatesMap, setDestinationDatesMap] = useState<Map<string, Array<{ destination: string; actual_date: string | null }>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLoadNumber, setNewLoadNumber] = useState("");
  const [shippingDate, setShippingDate] = useState<Date>();
  const [creating, setCreating] = useState(false);
  const [transitDialogOpen, setTransitDialogOpen] = useState(false);
  const [transitShipDate, setTransitShipDate] = useState<Date | undefined>(undefined);
  const [transitLoadPending, setTransitLoadPending] = useState<ShippingLoad | null>(null);
  const fetchData = useCallback(async () => {
    try {
      const [loadsRes, requestsRes] = await Promise.all([
        supabase
          .from("shipping_loads")
          .select("*")
          .order("shipping_date", { ascending: false }),
        supabase
          .from("release_requests")
          .select("id, load_id, requested_at, status, response_at, release_number, is_hot_order")
          .order("requested_at", { ascending: false }),
      ]);

      if (loadsRes.error) throw loadsRes.error;
      if (requestsRes.error) throw requestsRes.error;

      setLoads(loadsRes.data || []);
      setReleaseRequests(requestsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load shipping data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateLoad = async () => {
    if (!newLoadNumber.trim() || !shippingDate || !user) {
      toast.error("Please fill in all fields");
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from("shipping_loads").insert({
        load_number: newLoadNumber.trim(),
        shipping_date: format(shippingDate, "yyyy-MM-dd"),
        created_by: user.id,
        status: "assembling",
        total_pallets: 0,
      });

      if (error) throw error;

      toast.success("Load created successfully");
      setCreateDialogOpen(false);
      setNewLoadNumber("");
      setShippingDate(undefined);
      fetchData();
    } catch (error: any) {
      console.error("Error creating load:", error);
      if (error.code === "23505") {
        toast.error("A load with this number already exists");
      } else {
        toast.error("Failed to create load");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSendReleaseRequest = async (loadId: string) => {
    if (!user) return;

    try {
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: "pending_release" })
        .eq("id", loadId);

      if (loadError) throw loadError;

      const { error: requestError } = await supabase
        .from("release_requests")
        .insert({
          load_id: loadId,
          requested_by: user.id,
          status: "pending",
        });

      if (requestError) throw requestError;

      toast.success("Release request sent to customer");
      fetchData();
    } catch (error) {
      console.error("Error sending release request:", error);
      toast.error("Failed to send release request");
    }
  };

  const handleStatusChange = async (load: ShippingLoad, newStatus: string) => {
    // If transitioning to in_transit, prompt for ship date first
    if (newStatus === "in_transit") {
      setTransitLoadPending(load);
      setTransitShipDate(new Date(load.shipping_date));
      setTransitDialogOpen(true);
      return;
    }

    await executeStatusChange(load, newStatus);
  };

  const handleConfirmTransit = async () => {
    if (!transitLoadPending || !transitShipDate) return;
    
    const { error: shipDateError } = await supabase
      .from("shipping_loads")
      .update({ shipping_date: format(transitShipDate, "yyyy-MM-dd") })
      .eq("id", transitLoadPending.id);

    if (shipDateError) {
      console.error("Error updating ship date:", shipDateError);
      toast.error("Error updating ship date");
      return;
    }

    await executeStatusChange(transitLoadPending, "in_transit");
    setTransitDialogOpen(false);
    setTransitLoadPending(null);
  };

  const executeStatusChange = async (load: ShippingLoad, newStatus: string) => {
    try {
      type LoadStatus = "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
      type ReleaseStatus = "pending" | "approved" | "on_hold" | "shipped";

      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: newStatus as LoadStatus })
        .eq("id", load.id);

      if (loadError) throw loadError;

      // Update associated release request status
      const releaseStatusMap: Record<string, ReleaseStatus> = {
        pending_release: "pending",
        approved: "approved",
        in_transit: "shipped",
        delivered: "shipped",
      };

      if (releaseStatusMap[newStatus]) {
        const { error: requestError } = await supabase
          .from("release_requests")
          .update({
            status: releaseStatusMap[newStatus],
            response_at: releaseStatusMap[newStatus] !== "pending" ? new Date().toISOString() : null,
          })
          .eq("load_id", load.id);

        if (requestError) {
          console.log("No release request to update or error:", requestError);
        }
      }

      toast.success(`Status updated to ${statusLabels[newStatus]}`);
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };


  // Get release request info for a load
  const getReleaseForLoad = (loadId: string) => {
    return releaseRequests.find((r) => r.load_id === loadId);
  };

  // Filter loads by search
  const filteredLoads = loads.filter(
    (load) =>
      load.load_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.release_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Split loads by status sections
  const assemblingLoads = filteredLoads.filter((l) => l.status === "assembling");
  const pendingLoads = filteredLoads.filter(
    (l) => l.status === "pending_release" || l.status === "approved" || l.status === "on_hold"
  );
  const inTransitLoads = filteredLoads.filter((l) => l.status === "in_transit");
  const deliveredLoads = filteredLoads.filter((l) => l.status === "delivered");

  // Build transit data for TransitTrackingTable
  const transitTrackingData = inTransitLoads.map((load) => {
    const release = getReleaseForLoad(load.id);
    return {
      id: release?.id || load.id,
      load_id: load.id,
      requested_at: release?.requested_at || load.created_at,
      status: release?.status || ("shipped" as const),
      is_hot_order: release?.is_hot_order || false,
      load: {
        id: load.id,
        load_number: load.load_number,
        shipping_date: load.shipping_date,
        estimated_delivery_date: load.estimated_delivery_date,
        total_pallets: load.total_pallets,
        status: load.status,
        eta_cross_border: load.eta_cross_border,
        documents_sent: load.documents_sent || false,
        border_crossed: load.border_crossed || false,
        last_reported_city: load.last_reported_city,
        transit_notes: load.transit_notes,
      },
    };
  });

  // Counts for stats
  const assemblingCount = loads.filter((l) => l.status === "assembling").length;
  const pendingCount = loads.filter(
    (l) => l.status === "pending_release" || l.status === "approved" || l.status === "on_hold"
  ).length;
  const inTransitCount = loads.filter((l) => l.status === "in_transit").length;
  const deliveredCount = loads.filter((l) => l.status === "delivered").length;

  const renderLoadTable = (items: ShippingLoad[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Truck className="h-8 w-8 text-muted-foreground mb-2" />
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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((load) => {
              const release = getReleaseForLoad(load.id);
              return (
                <TableRow key={load.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {load.load_number}
                      {release?.is_hot_order && (
                        <Badge variant="destructive" className="text-xs">
                          HOT
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(load.shipping_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {load.estimated_delivery_date
                      ? format(new Date(load.estimated_delivery_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">{load.total_pallets}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select
                        value={load.status}
                        onValueChange={(value) => handleStatusChange(load, value)}
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
                      <Badge className={statusStyles[load.status]} variant="secondary">
                        {statusLabels[load.status]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/shipping-loads/${load.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {isAdmin && load.status === "assembling" && load.total_pallets > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSendReleaseRequest(load.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('page.shippingLoads.title')}</h1>
            <p className="text-muted-foreground">
              {t('page.shippingLoads.subtitle')}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Load
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className={cn("grid gap-4", isAdmin ? "md:grid-cols-4" : "md:grid-cols-3")}>
          {isAdmin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assembling</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assemblingCount}</div>
                <p className="text-xs text-muted-foreground">loads being assembled</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Release</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inTransitCount}</div>
              <p className="text-xs text-muted-foreground">on the road</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <MapPin className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deliveredCount}</div>
              <p className="text-xs text-muted-foreground">completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by load number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Assembling Section - Admin Only */}
            {isAdmin && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Assembling</h2>
                  <span className="text-sm text-muted-foreground">({assemblingLoads.length})</span>
                </div>
                {renderLoadTable(assemblingLoads, "No loads being assembled")}
              </div>
            )}

            {/* Pending Release Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <h2 className="text-lg font-semibold">Pending Release</h2>
                <span className="text-sm text-muted-foreground">({pendingLoads.length})</span>
              </div>
              {renderLoadTable(pendingLoads, "No pending loads")}
            </div>

            {/* In Transit Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold">In Transit</h2>
                <span className="text-sm text-muted-foreground">({inTransitLoads.length})</span>
              </div>
              <TransitTrackingTable
                loads={transitTrackingData}
                isAdmin={isAdmin}
                onRefresh={fetchData}
              />
            </div>

            {/* Delivered Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">Delivered</h2>
                <span className="text-sm text-muted-foreground">({deliveredLoads.length})</span>
              </div>
              {renderLoadTable(deliveredLoads, "No delivered loads")}
            </div>
          </div>
        )}

        {/* Create Load Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Load</DialogTitle>
              <DialogDescription>
                Create a new shipping load and assign pallets to it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loadNumber">Load Number</Label>
                <Input
                  id="loadNumber"
                  value={newLoadNumber}
                  onChange={(e) => setNewLoadNumber(e.target.value)}
                  placeholder="e.g., LOAD-2024-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !shippingDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {shippingDate ? format(shippingDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={shippingDate}
                      onSelect={setShippingDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLoad} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Load
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transit Ship Date Dialog */}
        <Dialog open={transitDialogOpen} onOpenChange={setTransitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Ship Date</DialogTitle>
              <DialogDescription>
                Confirm or update the ship date for load {transitLoadPending?.load_number} before marking it as In Transit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Ship Date (departure date)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !transitShipDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {transitShipDate ? format(transitShipDate, "PPP") : "Select ship date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={transitShipDate}
                      onSelect={setTransitShipDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransitDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmTransit} disabled={!transitShipDate}>
                Confirm In Transit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

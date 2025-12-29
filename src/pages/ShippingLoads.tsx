import { useState, useEffect, useCallback } from "react";
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
import { Truck, Plus, Search, Loader2, CalendarIcon, Eye, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface ShippingLoad {
  id: string;
  load_number: string;
  shipping_date: string;
  status: "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
  total_pallets: number;
  release_number: string | null;
  notes: string | null;
  created_at: string;
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
  { value: "approved", label: "Released" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

export default function ShippingLoads() {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const [loads, setLoads] = useState<ShippingLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLoadNumber, setNewLoadNumber] = useState("");
  const [shippingDate, setShippingDate] = useState<Date>();
  const [creating, setCreating] = useState(false);

  const fetchLoads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shipping_loads")
        .select("*")
        .order("shipping_date", { ascending: false });

      if (error) throw error;
      setLoads(data || []);
    } catch (error) {
      console.error("Error fetching loads:", error);
      toast.error("Failed to load shipping loads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

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
      fetchLoads();
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
      // Update load status
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: "pending_release" })
        .eq("id", loadId);

      if (loadError) throw loadError;

      // Create release request
      const { error: requestError } = await supabase
        .from("release_requests")
        .insert({
          load_id: loadId,
          requested_by: user.id,
          status: "pending",
        });

      if (requestError) throw requestError;

      toast.success("Release request sent to customer");
      fetchLoads();
    } catch (error) {
      console.error("Error sending release request:", error);
      toast.error("Failed to send release request");
    }
  };

  const handleStatusChange = async (load: ShippingLoad, newStatus: string) => {
    try {
      type LoadStatus = "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
      type ReleaseStatus = "pending" | "approved" | "on_hold" | "shipped";

      // Update load status
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: newStatus as LoadStatus })
        .eq("id", load.id);

      if (loadError) throw loadError;

      // If the load has a release request, update its status too
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
            response_at: releaseStatusMap[newStatus] !== "pending" ? new Date().toISOString() : null
          })
          .eq("load_id", load.id);

        if (requestError) {
          console.log("No release request to update or error:", requestError);
        }
      }

      toast.success(`Status updated to ${statusLabels[newStatus]}`);
      fetchLoads();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const filteredLoads = loads.filter(
    (load) =>
      load.load_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.release_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assemblingCount = loads.filter((l) => l.status === "assembling").length;
  const pendingCount = loads.filter((l) => l.status === "pending_release").length;
  const approvedCount = loads.filter((l) => l.status === "approved").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shipping Loads</h1>
            <p className="text-muted-foreground">
              Manage truck loads and release requests
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
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assembling</CardTitle>
              <Truck className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assemblingCount}</div>
              <p className="text-xs text-muted-foreground">loads being assembled</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Release</CardTitle>
              <Truck className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">awaiting customer approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Ship</CardTitle>
              <Truck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">approved for shipping</p>
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

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLoads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No loads found</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-1">
                {searchQuery
                  ? "No loads match your search criteria"
                  : "Create a new load to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Load #</TableHead>
                  <TableHead>Est. Delivery</TableHead>
                  <TableHead className="text-center">Pallets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.map((load) => (
                  <TableRow key={load.id}>
                    <TableCell className="font-medium">{load.load_number}</TableCell>
                    <TableCell>
                      {format(new Date(load.shipping_date), "MMM d, yyyy")}
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
                    <TableCell className="text-muted-foreground">
                      {format(new Date(load.created_at), "MMM d, yyyy")}
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
                ))}
              </TableBody>
            </Table>
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
      </div>
    </MainLayout>
  );
}

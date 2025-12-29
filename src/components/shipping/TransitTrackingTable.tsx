import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarIcon,
  Eye,
  FileText,
  Truck,
  MapPin,
  MessageSquare,
  History,
  Plus,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface LoadPalletDestination {
  destination: string;
  delivery_date: string | null;
  quantity: number;
  is_delivered: boolean;
}

interface TransitLoad {
  id: string;
  load_id: string;
  requested_at: string;
  status: "pending" | "approved" | "on_hold" | "shipped";
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
  destinations?: LoadPalletDestination[];
}

interface TransitUpdate {
  id: string;
  load_id: string;
  eta_cross_border: string | null;
  last_reported_city: string | null;
  notes: string | null;
  created_at: string;
}

interface TransitTrackingTableProps {
  loads: TransitLoad[];
  isAdmin: boolean;
  onRefresh: () => void;
}

const loadStatusOptions = [
  { value: "pending_release", label: "Pending Release" },
  { value: "approved", label: "Released" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

export function TransitTrackingTable({
  loads,
  isAdmin,
  onRefresh,
}: TransitTrackingTableProps) {
  const { user } = useAuth();
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<TransitLoad | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [transitHistory, setTransitHistory] = useState<TransitUpdate[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Update form state
  const [updateForm, setUpdateForm] = useState({
    eta_cross_border: "",
    documents_sent: false,
    border_crossed: false,
    last_reported_city: "",
    transit_notes: "",
  });

  const handleOpenUpdateDialog = (load: TransitLoad) => {
    setSelectedLoad(load);
    setUpdateForm({
      eta_cross_border: load.load.eta_cross_border || "",
      documents_sent: load.load.documents_sent || false,
      border_crossed: load.load.border_crossed || false,
      last_reported_city: load.load.last_reported_city || "",
      transit_notes: load.load.transit_notes || "",
    });
    setUpdateDialogOpen(true);
  };

  const handleSaveUpdate = async () => {
    if (!selectedLoad || !user) return;
    setSaving(true);

    try {
      // Update shipping_loads with transit info
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({
          eta_cross_border: updateForm.eta_cross_border || null,
          documents_sent: updateForm.documents_sent,
          border_crossed: updateForm.border_crossed,
          last_reported_city: updateForm.last_reported_city || null,
          transit_notes: updateForm.transit_notes || null,
        })
        .eq("id", selectedLoad.load.id);

      if (loadError) throw loadError;

      // Add to transit_updates history
      const { error: historyError } = await supabase
        .from("transit_updates")
        .insert({
          load_id: selectedLoad.load.id,
          updated_by: user.id,
          eta_cross_border: updateForm.eta_cross_border || null,
          last_reported_city: updateForm.last_reported_city || null,
          notes: updateForm.transit_notes || null,
        });

      if (historyError) throw historyError;

      toast.success("Transit update saved successfully");
      setUpdateDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error saving transit update:", error);
      toast.error("Failed to save transit update");
    } finally {
      setSaving(false);
    }
  };

  const handleViewHistory = async (load: TransitLoad) => {
    setSelectedLoad(load);
    setLoadingHistory(true);
    setHistoryDialogOpen(true);

    try {
      const { data, error } = await supabase
        .from("transit_updates")
        .select("*")
        .eq("load_id", load.load.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransitHistory(data || []);
    } catch (error) {
      console.error("Error fetching transit history:", error);
      toast.error("Failed to load transit history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStatusChange = async (load: TransitLoad, newLoadStatus: string) => {
    try {
      type ReleaseStatus = "pending" | "approved" | "on_hold" | "shipped";
      type LoadStatus = "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
      
      const releaseStatusMap: Record<string, ReleaseStatus> = {
        pending_release: "pending",
        approved: "approved",
        in_transit: "shipped",
        delivered: "shipped",
      };

      const newReleaseStatus: ReleaseStatus = releaseStatusMap[newLoadStatus] || "pending";

      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: newLoadStatus as LoadStatus })
        .eq("id", load.load_id);

      if (loadError) throw loadError;

      const { error: requestError } = await supabase
        .from("release_requests")
        .update({ 
          status: newReleaseStatus,
          response_at: newReleaseStatus !== "pending" ? new Date().toISOString() : null
        })
        .eq("id", load.id);

      if (requestError) throw requestError;

      toast.success(`Status updated to ${newLoadStatus.replace("_", " ")}`);
      onRefresh();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDateChange = async (loadId: string, field: string, date: Date) => {
    try {
      const { error } = await supabase
        .from("shipping_loads")
        .update({ [field]: format(date, "yyyy-MM-dd") })
        .eq("id", loadId);

      if (error) throw error;

      toast.success("Date updated successfully");
      onRefresh();
    } catch (error) {
      console.error("Error updating date:", error);
      toast.error("Failed to update date");
    }
  };

  const getDaysInTransit = (shippingDate: string) => {
    return differenceInDays(new Date(), new Date(shippingDate));
  };

  if (loads.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Truck className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No loads in transit</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Load #</TableHead>
              <TableHead>Ship Date</TableHead>
              <TableHead>ETA Cross Border</TableHead>
              <TableHead className="text-center">Docs Sent</TableHead>
              <TableHead className="text-center">Border Crossed</TableHead>
              <TableHead>Destinations & ETAs</TableHead>
              <TableHead>Last Reported City</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-center">Days in Transit</TableHead>
              {isAdmin && <TableHead>Status</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loads.map((request) => (
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
                  {format(new Date(request.load.shipping_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-auto p-1 font-normal">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {request.load.eta_cross_border 
                            ? format(new Date(request.load.eta_cross_border), "MMM d")
                            : "Set ETA"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={request.load.eta_cross_border ? new Date(request.load.eta_cross_border) : undefined}
                          onSelect={(date) => date && handleDateChange(request.load.id, 'eta_cross_border', date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    request.load.eta_cross_border 
                      ? format(new Date(request.load.eta_cross_border), "MMM d")
                      : "-"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isAdmin ? (
                    <Checkbox
                      checked={request.load.documents_sent}
                      onCheckedChange={async (checked) => {
                        try {
                          await supabase
                            .from("shipping_loads")
                            .update({ documents_sent: !!checked })
                            .eq("id", request.load.id);
                          onRefresh();
                        } catch (error) {
                          toast.error("Failed to update");
                        }
                      }}
                    />
                  ) : (
                    request.load.documents_sent ? "Y" : "N"
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isAdmin ? (
                    <Checkbox
                      checked={request.load.border_crossed}
                      onCheckedChange={async (checked) => {
                        try {
                          await supabase
                            .from("shipping_loads")
                            .update({ border_crossed: !!checked })
                            .eq("id", request.load.id);
                          onRefresh();
                        } catch (error) {
                          toast.error("Failed to update");
                        }
                      }}
                    />
                  ) : (
                    request.load.border_crossed ? "Y" : "N"
                  )}
                </TableCell>
                <TableCell>
                  {request.destinations && request.destinations.length > 0 ? (
                    <div className="text-xs space-y-0.5">
                      {request.destinations.map((dest, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="capitalize font-medium">{dest.destination}:</span>
                          <span>{dest.delivery_date ? format(new Date(dest.delivery_date), "M/d") : "TBD"}</span>
                          {dest.is_delivered && (
                            <Badge variant="outline" className="text-xs h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                              ✓
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-24">
                            {request.load.last_reported_city || "-"}
                          </span>
                        </div>
                      </TooltipTrigger>
                      {request.load.last_reported_city && (
                        <TooltipContent>
                          <p>{request.load.last_reported_city}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-32 text-sm">
                            {request.load.transit_notes || "-"}
                          </span>
                        </div>
                      </TooltipTrigger>
                      {request.load.transit_notes && (
                        <TooltipContent className="max-w-xs">
                          <p>{request.load.transit_notes}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-mono">
                    {getDaysInTransit(request.load.shipping_date)}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Select
                      value={request.load.status}
                      onValueChange={(value) => handleStatusChange(request, value)}
                    >
                      <SelectTrigger className="w-[140px]">
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
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenUpdateDialog(request)}
                        title="Add Update"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewHistory(request)}
                      title="View History"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/shipping-loads/${request.load_id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Transit Status</DialogTitle>
            <DialogDescription>
              Add a transit update for load {selectedLoad?.load.load_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ETA Cross Border</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {updateForm.eta_cross_border
                      ? format(new Date(updateForm.eta_cross_border), "PPP")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={updateForm.eta_cross_border ? new Date(updateForm.eta_cross_border) : undefined}
                    onSelect={(date) =>
                      setUpdateForm((prev) => ({
                        ...prev,
                        eta_cross_border: date ? format(date, "yyyy-MM-dd") : "",
                      }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateForm.documents_sent}
                  onCheckedChange={(checked) =>
                    setUpdateForm((prev) => ({ ...prev, documents_sent: !!checked }))
                  }
                />
                Documents Sent
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateForm.border_crossed}
                  onCheckedChange={(checked) =>
                    setUpdateForm((prev) => ({ ...prev, border_crossed: !!checked }))
                  }
                />
                Border Crossed
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Last Reported City</label>
              <Input
                placeholder="e.g., Mexicali, Jalisco"
                value={updateForm.last_reported_city}
                onChange={(e) =>
                  setUpdateForm((prev) => ({ ...prev, last_reported_city: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="e.g., Expecting to cross next Monday morning"
                value={updateForm.transit_notes}
                onChange={(e) =>
                  setUpdateForm((prev) => ({ ...prev, transit_notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transit Update History</DialogTitle>
            <DialogDescription>
              Update history for load {selectedLoad?.load.load_number}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transitHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No update history yet
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {transitHistory.map((update) => (
                  <div key={update.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(update.created_at), "PPp")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {update.eta_cross_border && (
                        <div>
                          <span className="text-muted-foreground">ETA Border:</span>{" "}
                          {format(new Date(update.eta_cross_border), "MMM d, yyyy")}
                        </div>
                      )}
                      {update.last_reported_city && (
                        <div>
                          <span className="text-muted-foreground">City:</span>{" "}
                          {update.last_reported_city}
                        </div>
                      )}
                    </div>
                    {update.notes && (
                      <p className="text-sm bg-muted/50 rounded p-2">{update.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

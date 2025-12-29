import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Truck,
  Plus,
  Loader2,
  Check,
  X,
  Package,
  MapPin,
  FileText,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface LoadPallet {
  id: string;
  pallet_id: string;
  destination: string | null;
  quantity: number;
  pallet: {
    pt_code: string;
    description: string;
    traceability: string;
    bfx_order: string | null;
  };
}

interface ShippingLoad {
  id: string;
  load_number: string;
  shipping_date: string;
  status: "assembling" | "pending_release" | "approved" | "on_hold" | "shipped";
  total_pallets: number;
  release_number: string | null;
  release_pdf_url: string | null;
  notes: string | null;
}

interface ReleaseRequest {
  id: string;
  status: "pending" | "approved" | "on_hold" | "shipped";
  requested_at: string;
  response_at: string | null;
  release_number: string | null;
  release_pdf_url: string | null;
  customer_notes: string | null;
}

interface AvailablePallet {
  id: string;
  pt_code: string;
  description: string;
  stock: number;
  traceability: string;
}

const statusStyles: Record<string, string> = {
  assembling: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  pending_release: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const destinations = [
  { value: "salinas", label: "Salinas, CA" },
  { value: "bakersfield", label: "Bakersfield, CA" },
  { value: "coachella", label: "Coachella, CA" },
  { value: "yuma", label: "Yuma, AZ" },
];

export default function LoadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const [load, setLoad] = useState<ShippingLoad | null>(null);
  const [pallets, setPallets] = useState<LoadPallet[]>([]);
  const [releaseRequest, setReleaseRequest] = useState<ReleaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [availablePallets, setAvailablePallets] = useState<AvailablePallet[]>([]);
  const [addPalletDialogOpen, setAddPalletDialogOpen] = useState(false);
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [selectedPalletId, setSelectedPalletId] = useState("");
  const [palletQuantity, setPalletQuantity] = useState("");
  const [responseAction, setResponseAction] = useState<"approve" | "hold">("approve");
  const [releaseNumber, setReleaseNumber] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchLoadData = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch load
      const { data: loadData, error: loadError } = await supabase
        .from("shipping_loads")
        .select("*")
        .eq("id", id)
        .single();

      if (loadError) throw loadError;
      setLoad(loadData);

      // Fetch load pallets
      const { data: palletsData, error: palletsError } = await supabase
        .from("load_pallets")
        .select(`
          id,
          pallet_id,
          destination,
          quantity,
          pallet:inventory_pallets(pt_code, description, traceability, bfx_order)
        `)
        .eq("load_id", id);

      if (palletsError) throw palletsError;
      setPallets(palletsData as any || []);

      // Fetch release request
      const { data: requestData } = await supabase
        .from("release_requests")
        .select("*")
        .eq("load_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setReleaseRequest(requestData);

      // Fetch pallets already in loads
      const { data: assignedPallets } = await supabase
        .from("load_pallets")
        .select("pallet_id");

      const assignedPalletIds = (assignedPallets || []).map((p) => p.pallet_id);

      // Fetch available pallets excluding those already in any load
      const { data: availableData } = await supabase
        .from("inventory_pallets")
        .select("id, pt_code, description, stock, traceability")
        .eq("status", "available");

      // Filter out pallets already assigned to any load
      const filteredPallets = (availableData || []).filter(
        (p) => !assignedPalletIds.includes(p.id)
      );

      setAvailablePallets(filteredPallets);
    } catch (error) {
      console.error("Error fetching load data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoadData();
  }, [fetchLoadData]);

  const handleAddPallet = async () => {
    if (!selectedPalletId || !palletQuantity || !id) {
      toast.error("Please select a pallet and enter quantity");
      return;
    }

    try {
      // Add pallet to load
      const { error: insertError } = await supabase.from("load_pallets").insert({
        load_id: id,
        pallet_id: selectedPalletId,
        quantity: parseFloat(palletQuantity),
      });

      if (insertError) throw insertError;

      // Update pallet status
      await supabase
        .from("inventory_pallets")
        .update({ status: "assigned" })
        .eq("id", selectedPalletId);

      // Update load total
      const newTotal = (load?.total_pallets || 0) + 1;
      await supabase
        .from("shipping_loads")
        .update({ total_pallets: newTotal })
        .eq("id", id);

      toast.success("Pallet added to load");
      setAddPalletDialogOpen(false);
      setSelectedPalletId("");
      setPalletQuantity("");
      fetchLoadData();
    } catch (error: any) {
      console.error("Error adding pallet:", error);
      if (error.code === "23505") {
        toast.error("This pallet is already in the load");
      } else {
        toast.error("Failed to add pallet");
      }
    }
  };

  const handleUpdateDestination = async (palletId: string, destination: string) => {
    try {
      const { error } = await supabase
        .from("load_pallets")
        .update({ destination: destination as any })
        .eq("id", palletId);

      if (error) throw error;
      toast.success("Destination updated");
      fetchLoadData();
    } catch (error) {
      console.error("Error updating destination:", error);
      toast.error("Failed to update destination");
    }
  };

  const handleRespondToRelease = async () => {
    if (!releaseRequest || !user) return;

    try {
      const newStatus = responseAction === "approve" ? "approved" : "on_hold";

      // Update release request
      const { error: requestError } = await supabase
        .from("release_requests")
        .update({
          status: newStatus,
          response_at: new Date().toISOString(),
          responded_by: user.id,
          release_number: responseAction === "approve" ? releaseNumber : null,
          customer_notes: customerNotes || null,
        })
        .eq("id", releaseRequest.id);

      if (requestError) throw requestError;

      // Update load status
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({
          status: newStatus,
          release_number: responseAction === "approve" ? releaseNumber : null,
        })
        .eq("id", id);

      if (loadError) throw loadError;

      toast.success(
        responseAction === "approve"
          ? "Release approved"
          : "Load placed on hold"
      );
      setRespondDialogOpen(false);
      setReleaseNumber("");
      setCustomerNotes("");
      fetchLoadData();
    } catch (error) {
      console.error("Error responding to release:", error);
      toast.error("Failed to update release request");
    }
  };

  const handleReleasePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !releaseRequest) return;

    setUploading(true);
    try {
      const fileName = `${releaseRequest.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("release-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("release-documents")
        .getPublicUrl(fileName);

      await supabase
        .from("release_requests")
        .update({ release_pdf_url: urlData.publicUrl })
        .eq("id", releaseRequest.id);

      toast.success("Release PDF uploaded");
      fetchLoadData();
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast.error("Failed to upload PDF");
    } finally {
      setUploading(false);
    }
  };

  const handleMarkAsShipped = async () => {
    if (!id) return;

    try {
      // Update load status
      await supabase
        .from("shipping_loads")
        .update({ status: "shipped" })
        .eq("id", id);

      // Update release request status
      if (releaseRequest) {
        await supabase
          .from("release_requests")
          .update({ status: "shipped" })
          .eq("id", releaseRequest.id);
      }

      // Update all pallets to shipped
      const palletIds = pallets.map((p) => p.pallet_id);
      await supabase
        .from("inventory_pallets")
        .update({ status: "shipped" })
        .in("id", palletIds);

      toast.success("Load marked as shipped");
      fetchLoadData();
    } catch (error) {
      console.error("Error marking as shipped:", error);
      toast.error("Failed to update load status");
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!load) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Load not found</h2>
          <Button variant="link" onClick={() => navigate("/shipping-loads")}>
            Back to loads
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shipping-loads")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{load.load_number}</h1>
              <Badge className={statusStyles[load.status]} variant="secondary">
                {load.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Shipping: {format(new Date(load.shipping_date), "MMMM d, yyyy")}
            </p>
          </div>
          {isAdmin && load.status === "approved" && (
            <Button onClick={handleMarkAsShipped}>
              <Truck className="mr-2 h-4 w-4" />
              Mark as Shipped
            </Button>
          )}
        </div>

        {/* Release Request Card */}
        {(releaseRequest || load.status === "pending_release") && (
          <Card className={releaseRequest?.status === "pending" ? "border-yellow-500" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Release Request
              </CardTitle>
              <CardDescription>
                {releaseRequest?.status === "pending"
                  ? "Awaiting customer response"
                  : releaseRequest?.status === "approved"
                  ? `Approved with release #${releaseRequest.release_number}`
                  : releaseRequest?.status === "on_hold"
                  ? "Customer has placed this load on hold"
                  : "Released and shipped"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {releaseRequest?.status === "pending" && (
                  <Button onClick={() => setRespondDialogOpen(true)}>
                    Respond to Request
                  </Button>
                )}
                {releaseRequest?.release_pdf_url && (
                  <Button variant="outline" asChild>
                    <a href={releaseRequest.release_pdf_url} target="_blank" rel="noreferrer">
                      View Release PDF
                    </a>
                  </Button>
                )}
                {releaseRequest?.status === "approved" && !releaseRequest.release_pdf_url && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handleReleasePdfUpload}
                      disabled={uploading}
                      className="max-w-xs"
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                )}
              </div>
              {releaseRequest?.customer_notes && (
                <p className="mt-4 text-sm text-muted-foreground">
                  <strong>Customer Notes:</strong> {releaseRequest.customer_notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Load Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pallets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pallets.length}</div>
              <p className="text-xs text-muted-foreground">
                {pallets.length >= 24 && pallets.length <= 30
                  ? "Full load"
                  : pallets.length < 24
                  ? `${24 - pallets.length} more needed for full load`
                  : "Over capacity"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Destinations Assigned</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pallets.filter((p) => p.destination).length} / {pallets.length}
              </div>
              <p className="text-xs text-muted-foreground">pallets with destination</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Release #</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{load.release_number || "-"}</div>
              <p className="text-xs text-muted-foreground">from customer</p>
            </CardContent>
          </Card>
        </div>

        {/* Pallets Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pallets in Load</CardTitle>
              <CardDescription>
                Assign destinations to each pallet for delivery
              </CardDescription>
            </div>
            {isAdmin && load.status === "assembling" && (
              <Button onClick={() => setAddPalletDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Pallet
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pallets.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pallets added yet</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PT Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Traceability</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Destination</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pallets.map((pallet) => (
                      <TableRow key={pallet.id}>
                        <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {pallet.pallet.description}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {pallet.pallet.traceability}
                        </TableCell>
                        <TableCell className="text-right">{pallet.quantity}</TableCell>
                        <TableCell>
                          {releaseRequest?.status === "approved" || isAdmin ? (
                            <Select
                              value={pallet.destination || ""}
                              onValueChange={(val) => handleUpdateDestination(pallet.id, val)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select destination" />
                              </SelectTrigger>
                              <SelectContent>
                                {destinations.map((dest) => (
                                  <SelectItem key={dest.value} value={dest.value}>
                                    {dest.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">
                              {pallet.destination
                                ? destinations.find((d) => d.value === pallet.destination)?.label
                                : "Pending approval"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Pallet Dialog */}
        <Dialog open={addPalletDialogOpen} onOpenChange={setAddPalletDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pallet to Load</DialogTitle>
              <DialogDescription>
                Select an available pallet from inventory to add to this load.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Pallet</Label>
                <Select value={selectedPalletId} onValueChange={setSelectedPalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePallets.map((pallet) => (
                      <SelectItem key={pallet.id} value={pallet.id}>
                        {pallet.pt_code} - {pallet.description.slice(0, 30)}... ({pallet.stock} {pallet.traceability})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={palletQuantity}
                  onChange={(e) => setPalletQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPalletDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPallet}>Add Pallet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Respond to Release Dialog */}
        <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Respond to Release Request</DialogTitle>
              <DialogDescription>
                Approve the shipment and provide a release number, or place on hold.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={responseAction === "approve" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setResponseAction("approve")}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant={responseAction === "hold" ? "destructive" : "outline"}
                  className="flex-1"
                  onClick={() => setResponseAction("hold")}
                >
                  <X className="mr-2 h-4 w-4" />
                  Hold
                </Button>
              </div>
              {responseAction === "approve" && (
                <div className="space-y-2">
                  <Label htmlFor="releaseNumber">Release Number</Label>
                  <Input
                    id="releaseNumber"
                    value={releaseNumber}
                    onChange={(e) => setReleaseNumber(e.target.value)}
                    placeholder="e.g., REL-2024-001"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRespondDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRespondToRelease}
                variant={responseAction === "hold" ? "destructive" : "default"}
              >
                {responseAction === "approve" ? "Approve Release" : "Place on Hold"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

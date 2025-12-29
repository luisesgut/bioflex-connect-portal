import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Search,
  ChevronDown,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Send,
  Trash2,
  CalendarIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface InventoryFilters {
  fecha: string[];
  pt_code: string[];
  description: string[];
  traceability: string[];
  bfx_order: string[];
  unit: string[];
}

interface LoadPallet {
  id: string;
  pallet_id: string;
  destination: string | null;
  quantity: number;
  release_number: string | null;
  release_pdf_url: string | null;
  is_on_hold: boolean;
  status: "pending" | "ship" | "hold";
  release_date: string | null;
  pallet: {
    pt_code: string;
    description: string;
    customer_lot: string | null;
    bfx_order: string | null;
    release_date: string | null;
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
  fecha: string;
  bfx_order: string | null;
  unit: string;
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
  { value: "tbd", label: "TBD" },
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
  const [selectedPalletIds, setSelectedPalletIds] = useState<Set<string>>(new Set());
  const [inventorySearch, setInventorySearch] = useState("");
  const [addingPallets, setAddingPallets] = useState(false);
  const [inventoryFilters, setInventoryFilters] = useState<InventoryFilters>({
    fecha: [],
    pt_code: [],
    description: [],
    traceability: [],
    bfx_order: [],
    unit: [],
  });
  const [dateSortOrder, setDateSortOrder] = useState<"asc" | "desc" | null>("desc");
  const [sendingRelease, setSendingRelease] = useState(false);
  const [deletingLoad, setDeletingLoad] = useState(false);
  const [deletingHoldPallets, setDeletingHoldPallets] = useState(false);
  const [selectedPalletsToDelete, setSelectedPalletsToDelete] = useState<Set<string>>(new Set());
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
          release_number,
          release_pdf_url,
          is_on_hold,
          pallet:inventory_pallets(pt_code, description, customer_lot, bfx_order, release_date)
        `)
        .eq("load_id", id);

      if (palletsError) throw palletsError;
      // Map release_date from pallet to load pallet level for easier access
      const mappedPallets = (palletsData as any || []).map((p: any) => ({
        ...p,
        release_date: p.pallet?.release_date || null,
      }));
      setPallets(mappedPallets);

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
        .select("id, pt_code, description, stock, traceability, fecha, bfx_order, unit")
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

  // Get unique values for filter options
  const uniqueDates = useMemo(() => [...new Set(availablePallets.map(p => format(new Date(p.fecha), "MM/dd/yyyy")))].sort(), [availablePallets]);
  const uniquePtCodes = useMemo(() => [...new Set(availablePallets.map(p => p.pt_code))].filter(Boolean).sort(), [availablePallets]);
  const uniqueDescriptions = useMemo(() => [...new Set(availablePallets.map(p => p.description))].filter(Boolean).sort(), [availablePallets]);
  const uniqueTraceability = useMemo(() => [...new Set(availablePallets.map(p => p.traceability))].filter(Boolean).sort(), [availablePallets]);
  const uniqueBfxOrders = useMemo(() => [...new Set(availablePallets.map(p => p.bfx_order || "-"))].sort(), [availablePallets]);
  const uniqueUnits = useMemo(() => [...new Set(availablePallets.map(p => p.unit))].filter(Boolean).sort(), [availablePallets]);

  // Filter toggle function
  const toggleInventoryFilter = (filterKey: keyof InventoryFilters, value: string) => {
    setInventoryFilters(prev => {
      const current = prev[filterKey];
      if (current.includes(value)) {
        return { ...prev, [filterKey]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [filterKey]: [...current, value] };
      }
    });
  };

  const clearColumnFilter = (filterKey: keyof InventoryFilters) => {
    setInventoryFilters(prev => ({ ...prev, [filterKey]: [] }));
  };

  const clearAllInventoryFilters = () => {
    setInventoryFilters({
      fecha: [],
      pt_code: [],
      description: [],
      traceability: [],
      bfx_order: [],
      unit: [],
    });
    setInventorySearch("");
  };

  const hasActiveFilters = Object.values(inventoryFilters).some(arr => arr.length > 0) || inventorySearch.length > 0;

  // Column Filter Header Component
  const ColumnFilterHeader = ({ 
    label, 
    filterKey, 
    options,
    className = ""
  }: { 
    label: string; 
    filterKey: keyof InventoryFilters; 
    options: string[];
    className?: string;
  }) => {
    const activeFilters = inventoryFilters[filterKey];
    const isFiltered = activeFilters.length > 0;
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <TableHead className={className}>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 hover:text-primary transition-colors ${isFiltered ? 'text-primary font-bold' : ''}`}>
              {label}
              {isFiltered && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilters.length}</Badge>}
              <ChevronDown className={`h-3 w-3 ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <div className="p-2 border-b">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="p-2 border-b flex justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => setInventoryFilters(prev => ({ ...prev, [filterKey]: filteredOptions }))}
              >
                Select All
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => clearColumnFilter(filterKey)}
              >
                Clear
              </Button>
            </div>
            <ScrollArea className="h-48">
              <div className="p-2 space-y-1">
                {filteredOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No options</p>
                ) : (
                  filteredOptions.map(option => (
                    <label 
                      key={option} 
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox 
                        checked={activeFilters.includes(option)}
                        onCheckedChange={() => toggleInventoryFilter(filterKey, option)}
                      />
                      <span className="truncate">{option}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </TableHead>
    );
  };

  // Date Column Header with Sort and Filter
  const DateColumnHeader = () => {
    const activeFilters = inventoryFilters.fecha;
    const isFiltered = activeFilters.length > 0;
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredOptions = uniqueDates.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleSort = () => {
      setDateSortOrder(prev => {
        if (prev === "desc") return "asc";
        if (prev === "asc") return null;
        return "desc";
      });
    };

    const SortIcon = dateSortOrder === "desc" ? ArrowDown : dateSortOrder === "asc" ? ArrowUp : ArrowUpDown;

    return (
      <TableHead>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button className={`inline-flex items-center gap-1 hover:text-primary transition-colors ${isFiltered ? 'text-primary font-bold' : ''}`}>
                Production Date
                {isFiltered && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilters.length}</Badge>}
                <ChevronDown className={`h-3 w-3 ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="p-2 border-b flex justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setInventoryFilters(prev => ({ ...prev, fecha: filteredOptions }))}
                >
                  Select All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => clearColumnFilter("fecha")}
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-48">
                <div className="p-2 space-y-1">
                  {filteredOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No options</p>
                  ) : (
                    filteredOptions.map(option => (
                      <label 
                        key={option} 
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                      >
                        <Checkbox 
                          checked={activeFilters.includes(option)}
                          onCheckedChange={() => toggleInventoryFilter("fecha", option)}
                        />
                        <span className="truncate">{option}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <button 
            onClick={toggleSort}
            className={`p-1 rounded hover:bg-muted transition-colors ${dateSortOrder ? 'text-primary' : 'text-muted-foreground'}`}
            title={dateSortOrder === "desc" ? "Sorted: Newest first" : dateSortOrder === "asc" ? "Sorted: Oldest first" : "Click to sort"}
          >
            <SortIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableHead>
    );
  };

  // Filter and sort available pallets
  const filteredAvailablePallets = useMemo(() => {
    let result = availablePallets;

    // Apply text search
    if (inventorySearch.trim()) {
      const search = inventorySearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.pt_code.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.traceability.toLowerCase().includes(search) ||
          (p.bfx_order && p.bfx_order.toLowerCase().includes(search))
      );
    }

    // Apply column filters
    const dateStr = (p: AvailablePallet) => format(new Date(p.fecha), "MM/dd/yyyy");
    if (inventoryFilters.fecha.length > 0) {
      result = result.filter(p => inventoryFilters.fecha.includes(dateStr(p)));
    }
    if (inventoryFilters.pt_code.length > 0) {
      result = result.filter(p => inventoryFilters.pt_code.includes(p.pt_code));
    }
    if (inventoryFilters.description.length > 0) {
      result = result.filter(p => inventoryFilters.description.includes(p.description));
    }
    if (inventoryFilters.traceability.length > 0) {
      result = result.filter(p => inventoryFilters.traceability.includes(p.traceability));
    }
    if (inventoryFilters.bfx_order.length > 0) {
      result = result.filter(p => inventoryFilters.bfx_order.includes(p.bfx_order || "-"));
    }
    if (inventoryFilters.unit.length > 0) {
      result = result.filter(p => inventoryFilters.unit.includes(p.unit));
    }

    // Apply date sorting
    if (dateSortOrder) {
      result = [...result].sort((a, b) => {
        const dateA = new Date(a.fecha).getTime();
        const dateB = new Date(b.fecha).getTime();
        return dateSortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    }

    return result;
  }, [availablePallets, inventorySearch, inventoryFilters, dateSortOrder]);

  const handleTogglePallet = (palletId: string) => {
    setSelectedPalletIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(palletId)) {
        newSet.delete(palletId);
      } else {
        newSet.add(palletId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPalletIds.size === filteredAvailablePallets.length) {
      setSelectedPalletIds(new Set());
    } else {
      setSelectedPalletIds(new Set(filteredAvailablePallets.map((p) => p.id)));
    }
  };

  const handleAddSelectedPallets = async () => {
    if (selectedPalletIds.size === 0 || !id) {
      toast.error("Please select at least one pallet");
      return;
    }

    setAddingPallets(true);
    try {
      const palletsToAdd = availablePallets.filter((p) => selectedPalletIds.has(p.id));

      // Insert all pallets to load with TBD as default destination
      const insertData = palletsToAdd.map((p) => ({
        load_id: id,
        pallet_id: p.id,
        quantity: p.stock,
        destination: "tbd" as const,
      }));

      const { error: insertError } = await supabase.from("load_pallets").insert(insertData);
      if (insertError) throw insertError;

      // Update pallets status to assigned
      const palletIds = palletsToAdd.map((p) => p.id);
      await supabase
        .from("inventory_pallets")
        .update({ status: "assigned" })
        .in("id", palletIds);

      // Update load total
      const newTotal = (load?.total_pallets || 0) + palletsToAdd.length;
      await supabase.from("shipping_loads").update({ total_pallets: newTotal }).eq("id", id);

      toast.success(`${palletsToAdd.length} pallet(s) added to load`);
      setSelectedPalletIds(new Set());
      fetchLoadData();
    } catch (error: any) {
      console.error("Error adding pallets:", error);
      if (error.code === "23505") {
        toast.error("Some pallets are already in the load");
      } else {
        toast.error("Failed to add pallets");
      }
    } finally {
      setAddingPallets(false);
    }
  };

  const handleAddPallet = async () => {
    if (!selectedPalletId || !palletQuantity || !id) {
      toast.error("Please select a pallet and enter quantity");
      return;
    }

    try {
      // Add pallet to load with TBD as default destination
      const { error: insertError } = await supabase.from("load_pallets").insert({
        load_id: id,
        pallet_id: selectedPalletId,
        quantity: parseFloat(palletQuantity),
        destination: "tbd" as const,
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
      // When setting a destination, also clear the on_hold status
      const { error } = await supabase
        .from("load_pallets")
        .update({ destination: destination as any, is_on_hold: false })
        .eq("id", palletId);

      if (error) throw error;
      toast.success("Destination updated");
      fetchLoadData();
    } catch (error) {
      console.error("Error updating destination:", error);
      toast.error("Failed to update destination");
    }
  };

  const handleTogglePalletHold = async (palletId: string, palletInventoryId: string, isOnHold: boolean, releaseDate?: Date | null) => {
    try {
      const { error } = await supabase
        .from("load_pallets")
        .update({ is_on_hold: isOnHold })
        .eq("id", palletId);

      if (error) throw error;

      // If putting on hold and a release date is provided, update inventory pallet
      if (isOnHold && releaseDate) {
        const { error: invError } = await supabase
          .from("inventory_pallets")
          .update({ release_date: releaseDate.toISOString().split("T")[0] })
          .eq("id", palletInventoryId);
        
        if (invError) throw invError;
      } else if (!isOnHold) {
        // If releasing from hold, clear the release date
        await supabase
          .from("inventory_pallets")
          .update({ release_date: null })
          .eq("id", palletInventoryId);
      }

      toast.success(isOnHold ? "Pallet placed on hold" : "Pallet released from hold");
      fetchLoadData();
    } catch (error) {
      console.error("Error toggling pallet hold:", error);
      toast.error("Failed to update hold status");
    }
  };

  const handleUpdatePalletReleaseNumber = async (palletId: string, releaseNum: string) => {
    try {
      const { error } = await supabase
        .from("load_pallets")
        .update({ release_number: releaseNum || null })
        .eq("id", palletId);

      if (error) throw error;
      toast.success("Release number updated");
      fetchLoadData();
    } catch (error) {
      console.error("Error updating release number:", error);
      toast.error("Failed to update release number");
    }
  };

  const handlePalletReleasePdfUpload = async (palletId: string, file: File) => {
    try {
      const fileName = `pallets/${palletId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("release-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("release-documents")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("load_pallets")
        .update({ release_pdf_url: urlData.publicUrl })
        .eq("id", palletId);

      if (updateError) throw updateError;

      toast.success("Release PDF uploaded");
      fetchLoadData();
    } catch (error) {
      console.error("Error uploading pallet PDF:", error);
      toast.error("Failed to upload PDF");
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

  const handleSendReleaseRequest = async () => {
    if (!id || !user || pallets.length === 0) {
      toast.error("Please add pallets to the load before sending a release request");
      return;
    }

    setSendingRelease(true);
    try {
      // Create release request
      const { error: requestError } = await supabase.from("release_requests").insert({
        load_id: id,
        requested_by: user.id,
        status: "pending",
      });

      if (requestError) throw requestError;

      // Update load status to pending_release
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: "pending_release" })
        .eq("id", id);

      if (loadError) throw loadError;

      toast.success("Release request sent to customer");
      fetchLoadData();
    } catch (error) {
      console.error("Error sending release request:", error);
      toast.error("Failed to send release request");
    } finally {
      setSendingRelease(false);
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

  const handleDeleteLoad = async () => {
    if (!id) return;

    setDeletingLoad(true);
    try {
      // Get all pallet IDs from this load
      const palletIds = pallets.map((p) => p.pallet_id);

      // Delete load pallets first (foreign key constraint)
      const { error: palletsError } = await supabase
        .from("load_pallets")
        .delete()
        .eq("load_id", id);

      if (palletsError) throw palletsError;

      // Delete any release requests for this load
      await supabase
        .from("release_requests")
        .delete()
        .eq("load_id", id);

      // Delete the load
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .delete()
        .eq("id", id);

      if (loadError) throw loadError;

      // Reset inventory pallet statuses back to available
      if (palletIds.length > 0) {
        await supabase
          .from("inventory_pallets")
          .update({ status: "available" })
          .in("id", palletIds);
      }

      toast.success("Load deleted successfully");
      navigate("/shipping-loads");
    } catch (error) {
      console.error("Error deleting load:", error);
      toast.error("Failed to delete load");
    } finally {
      setDeletingLoad(false);
    }
  };

  const handleDeleteHoldPallets = async () => {
    const holdPallets = pallets.filter((p) => p.is_on_hold);
    if (holdPallets.length === 0) {
      toast.error("No pallets on hold to delete");
      return;
    }

    setDeletingHoldPallets(true);
    try {
      const holdPalletIds = holdPallets.map((p) => p.id);
      const inventoryPalletIds = holdPallets.map((p) => p.pallet_id);

      // Delete load pallets that are on hold
      const { error: deleteError } = await supabase
        .from("load_pallets")
        .delete()
        .in("id", holdPalletIds);

      if (deleteError) throw deleteError;

      // Reset inventory pallet statuses back to available
      await supabase
        .from("inventory_pallets")
        .update({ status: "available" })
        .in("id", inventoryPalletIds);

      // Update load total
      const newTotal = Math.max(0, (load?.total_pallets || 0) - holdPallets.length);
      await supabase
        .from("shipping_loads")
        .update({ total_pallets: newTotal })
        .eq("id", id);

      toast.success(`${holdPallets.length} on-hold pallet(s) removed from load`);
      fetchLoadData();
    } catch (error) {
      console.error("Error deleting hold pallets:", error);
      toast.error("Failed to remove on-hold pallets");
    } finally {
      setDeletingHoldPallets(false);
    }
  };

  const handleDeleteSelectedPallets = async () => {
    if (selectedPalletsToDelete.size === 0) {
      toast.error("No pallets selected to delete");
      return;
    }

    setDeletingHoldPallets(true);
    try {
      const palletsToDelete = pallets.filter((p) => selectedPalletsToDelete.has(p.id));
      const loadPalletIds = palletsToDelete.map((p) => p.id);
      const inventoryPalletIds = palletsToDelete.map((p) => p.pallet_id);

      // Delete selected load pallets
      const { error: deleteError } = await supabase
        .from("load_pallets")
        .delete()
        .in("id", loadPalletIds);

      if (deleteError) throw deleteError;

      // Reset inventory pallet statuses back to available
      await supabase
        .from("inventory_pallets")
        .update({ status: "available", release_date: null })
        .in("id", inventoryPalletIds);

      // Update load total
      const newTotal = Math.max(0, (load?.total_pallets || 0) - palletsToDelete.length);
      await supabase
        .from("shipping_loads")
        .update({ total_pallets: newTotal })
        .eq("id", id);

      toast.success(`${palletsToDelete.length} pallet(s) removed from load`);
      setSelectedPalletsToDelete(new Set());
      fetchLoadData();
    } catch (error) {
      console.error("Error deleting pallets:", error);
      toast.error("Failed to remove pallets");
    } finally {
      setDeletingHoldPallets(false);
    }
  };

  const togglePalletToDelete = (palletId: string) => {
    setSelectedPalletsToDelete((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(palletId)) {
        newSet.delete(palletId);
      } else {
        newSet.add(palletId);
      }
      return newSet;
    });
  };

  const toggleAllPalletsToDelete = () => {
    if (selectedPalletsToDelete.size === pallets.length) {
      setSelectedPalletsToDelete(new Set());
    } else {
      setSelectedPalletsToDelete(new Set(pallets.map((p) => p.id)));
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
          <div className="flex items-center gap-2">
            {isAdmin && load.status === "assembling" && pallets.length > 0 && (
              <Button onClick={handleSendReleaseRequest} disabled={sendingRelease}>
                {sendingRelease ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Release Request
              </Button>
            )}
            {isAdmin && load.status === "approved" && (
              <Button onClick={handleMarkAsShipped}>
                <Truck className="mr-2 h-4 w-4" />
                Mark as Shipped
              </Button>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deletingLoad}>
                    {deletingLoad ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete Load
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Load?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the load "{load.load_number}" and remove all {pallets.length} pallet(s) from it. 
                      The pallets will be returned to available inventory. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteLoad} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Load
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Pallets in Load</CardTitle>
              <CardDescription>
                {load.status === "assembling" 
                  ? "Select pallets from the inventory below to add to this load"
                  : isAdmin 
                    ? "Customer will assign status to each pallet"
                    : "Select Ship or Hold for each pallet"}
              </CardDescription>
            </div>
            {isAdmin && pallets.length > 0 && (
              <div className="flex items-center gap-2">
                {selectedPalletsToDelete.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={deletingHoldPallets}>
                        {deletingHoldPallets ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Delete Selected ({selectedPalletsToDelete.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Selected Pallets?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {selectedPalletsToDelete.size} pallet(s) from this load. 
                          They will be returned to available inventory. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelectedPallets} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete Pallets
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
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
                      {isAdmin && (
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedPalletsToDelete.size === pallets.length && pallets.length > 0}
                            onCheckedChange={toggleAllPalletsToDelete}
                          />
                        </TableHead>
                      )}
                      {isAdmin && <TableHead>PT Code</TableHead>}
                      <TableHead>Description</TableHead>
                      <TableHead>Customer PO</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Status</TableHead>
                      {!isAdmin && <TableHead>Release Date</TableHead>}
                      <TableHead>Destination</TableHead>
                      <TableHead>Release #</TableHead>
                      <TableHead>Release PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pallets.map((pallet) => {
                      const palletStatus = pallet.is_on_hold ? "hold" : (releaseRequest?.status === "pending" ? "pending" : "ship");
                      return (
                      <TableRow key={pallet.id} className={pallet.is_on_hold ? "bg-red-50 dark:bg-red-950/20" : ""}>
                        {isAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={selectedPalletsToDelete.has(pallet.id)}
                              onCheckedChange={() => togglePalletToDelete(pallet.id)}
                            />
                          </TableCell>
                        )}
                        {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                        <TableCell className="max-w-[200px] truncate">
                          {pallet.pallet.description}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {pallet.pallet.customer_lot || "-"}
                        </TableCell>
                        <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                        <TableCell>
                          {/* Only customers can change status when release is pending */}
                          {releaseRequest?.status === "pending" && !isAdmin ? (
                            palletStatus === "hold" ? (
                              <div className="flex items-center gap-2">
                                <Select
                                  value="hold"
                                  onValueChange={(val) => {
                                    if (val === "ship") {
                                      handleTogglePalletHold(pallet.id, pallet.pallet_id, false);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[120px] border-red-500 text-red-600">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ship">
                                      <span className="flex items-center gap-1">
                                        <Check className="h-3 w-3 text-green-600" />
                                        Ship
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="hold">
                                      <span className="flex items-center gap-1">
                                        <X className="h-3 w-3 text-red-600" />
                                        Hold
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {pallet.release_date && (
                                  <span className="text-xs text-muted-foreground">
                                    Until {format(new Date(pallet.release_date), "MMM d")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Popover>
                                <Select
                                  value={palletStatus}
                                  onValueChange={(val) => {
                                    if (val === "ship") {
                                      handleTogglePalletHold(pallet.id, pallet.pallet_id, false);
                                    }
                                  }}
                                >
                                  <SelectTrigger className={`w-[120px] ${
                                    palletStatus === "pending" 
                                      ? "border-yellow-500 text-yellow-600" 
                                      : "border-green-500 text-green-600"
                                  }`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending" disabled>
                                      <span className="flex items-center gap-1 text-yellow-600">
                                        Pending
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="ship">
                                      <span className="flex items-center gap-1">
                                        <Check className="h-3 w-3 text-green-600" />
                                        Ship
                                      </span>
                                    </SelectItem>
                                    <PopoverTrigger asChild>
                                      <div 
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="flex items-center gap-1">
                                          <X className="h-3 w-3 text-red-600" />
                                          Hold
                                        </span>
                                      </div>
                                    </PopoverTrigger>
                                  </SelectContent>
                                </Select>
                                <PopoverContent className="w-auto p-4 pointer-events-auto" align="start">
                                  <div className="space-y-3">
                                    <p className="text-sm font-medium">When will this pallet be released?</p>
                                    <Calendar
                                      mode="single"
                                      selected={pallet.release_date ? new Date(pallet.release_date) : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          handleTogglePalletHold(pallet.id, pallet.pallet_id, true, date);
                                        }
                                      }}
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )
                          ) : (
                            /* Admin sees read-only status */
                            <Badge 
                              variant={palletStatus === "hold" ? "destructive" : palletStatus === "pending" ? "outline" : "default"}
                              className={palletStatus === "pending" ? "border-yellow-500 text-yellow-600" : palletStatus === "ship" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}
                            >
                              {palletStatus === "hold" ? "On Hold" : palletStatus === "pending" ? "Pending" : "Ship"}
                              {palletStatus === "hold" && pallet.release_date && (
                                <span className="ml-1 text-xs">({format(new Date(pallet.release_date), "MMM d")})</span>
                              )}
                            </Badge>
                          )}
                        </TableCell>
                        {!isAdmin && (
                          <TableCell>
                            {pallet.is_on_hold && pallet.release_date ? (
                              <span className="text-sm">{format(new Date(pallet.release_date), "MMM d, yyyy")}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          {pallet.is_on_hold ? (
                            <span className="text-muted-foreground italic">N/A (on hold)</span>
                          ) : releaseRequest?.status === "pending" || releaseRequest?.status === "approved" || isAdmin ? (
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
                                : "Pending"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pallet.is_on_hold ? (
                            <span className="text-muted-foreground">-</span>
                          ) : releaseRequest?.status === "pending" || releaseRequest?.status === "approved" ? (
                            <Input
                              placeholder="Release #"
                              defaultValue={pallet.release_number || ""}
                              className="w-[120px]"
                              onBlur={(e) => {
                                if (e.target.value !== (pallet.release_number || "")) {
                                  handleUpdatePalletReleaseNumber(pallet.id, e.target.value);
                                }
                              }}
                            />
                          ) : (
                            <span className="text-muted-foreground">
                              {pallet.release_number || "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pallet.is_on_hold ? (
                            <span className="text-muted-foreground">-</span>
                          ) : releaseRequest?.status === "pending" || releaseRequest?.status === "approved" ? (
                            <div className="flex items-center gap-2">
                              {pallet.release_pdf_url ? (
                                <a
                                  href={pallet.release_pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <FileText className="h-4 w-4" />
                                  View
                                </a>
                              ) : null}
                              <label className="cursor-pointer">
                                <Input
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handlePalletReleasePdfUpload(pallet.id, file);
                                    }
                                  }}
                                />
                                <span className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                  <Upload className="h-3 w-3" />
                                  {pallet.release_pdf_url ? "Replace" : "Upload"}
                                </span>
                              </label>
                            </div>
                          ) : (
                            pallet.release_pdf_url ? (
                              <a
                                href={pallet.release_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <FileText className="h-4 w-4" />
                                View
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Inventory Table - Only shown when assembling */}
        {isAdmin && load.status === "assembling" && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Available Inventory</CardTitle>
                  <CardDescription>
                    Select pallets to add to this load ({availablePallets.length} available, {selectedPalletIds.size} selected)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search inventory..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="pl-8 w-[200px]"
                    />
                  </div>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearAllInventoryFilters}>
                      <X className="mr-1 h-3 w-3" />
                      Clear Filters
                    </Button>
                  )}
                  <Button
                    onClick={handleAddSelectedPallets}
                    disabled={selectedPalletIds.size === 0 || addingPallets}
                  >
                    {addingPallets ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add Selected ({selectedPalletIds.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAvailablePallets.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {inventorySearch || hasActiveFilters ? "No pallets match your filters" : "No available pallets"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={
                                filteredAvailablePallets.length > 0 &&
                                selectedPalletIds.size === filteredAvailablePallets.length
                              }
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <DateColumnHeader />
                          <ColumnFilterHeader label="PT Code" filterKey="pt_code" options={uniquePtCodes} />
                          <ColumnFilterHeader label="Description" filterKey="description" options={uniqueDescriptions} />
                          <TableHead className="text-right">Stock</TableHead>
                          <ColumnFilterHeader label="BFX Order" filterKey="bfx_order" options={uniqueBfxOrders} />
                          <ColumnFilterHeader label="Unit" filterKey="unit" options={uniqueUnits} />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAvailablePallets.map((pallet) => (
                          <TableRow
                            key={pallet.id}
                            className={selectedPalletIds.has(pallet.id) ? "bg-muted/50" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedPalletIds.has(pallet.id)}
                                onCheckedChange={() => handleTogglePallet(pallet.id)}
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(pallet.fecha), "MM/dd/yyyy")}
                            </TableCell>
                            <TableCell className="font-mono">{pallet.pt_code}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {pallet.description}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {pallet.stock.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm">{pallet.bfx_order || "-"}</TableCell>
                            <TableCell className="text-sm">{pallet.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Pallet Dialog - kept as fallback */}
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

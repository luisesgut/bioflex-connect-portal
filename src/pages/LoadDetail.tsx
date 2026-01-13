import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";
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
  FileDown,
  AlertTriangle,
  CheckCircle,
  Info,
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
import { generateCustomsDocument } from "@/utils/generateCustomsDocument";

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
    unit: string;
    traceability: string;
    fecha: string;
    gross_weight: number | null;
    net_weight: number | null;
    pieces: number | null;
  };
}

interface ShippingLoad {
  id: string;
  load_number: string;
  shipping_date: string;
  status: "assembling" | "pending_release" | "approved" | "on_hold" | "shipped" | "in_transit" | "delivered";
  total_pallets: number;
  release_number: string | null;
  release_pdf_url: string | null;
  notes: string | null;
}

interface DeliveryDateEntry {
  destination: string;
  date: Date | null;
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
  pieces_per_pallet?: number | null;
}

interface ActivePOWithInventory {
  po_number: string;
  product_pt_code: string;
  product_description: string;
  total_quantity: number;
  pieces_per_pallet: number | null;
  inventory_pallets: number;
  inventory_volume: number;
}

const statusStyles: Record<string, string> = {
  assembling: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  pending_release: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
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
  const [selectedPalletId, setSelectedPalletId] = useState("");
  const [palletQuantity, setPalletQuantity] = useState("");
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
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [deliveryDates, setDeliveryDates] = useState<DeliveryDateEntry[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [inTransitConfirmOpen, setInTransitConfirmOpen] = useState(false);
  const [activePOsWithInventory, setActivePOsWithInventory] = useState<ActivePOWithInventory[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, { pieces_per_pallet: number | null }>>(new Map());
  const [selectedPalletsForRelease, setSelectedPalletsForRelease] = useState<Set<string>>(new Set());
  const [releaseUploadDialogOpen, setReleaseUploadDialogOpen] = useState(false);
  const [processingRelease, setProcessingRelease] = useState(false);
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
          pallet:inventory_pallets(pt_code, description, customer_lot, bfx_order, release_date, unit, traceability, fecha, gross_weight, net_weight, pieces)
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

      // Fetch active POs with their product PT codes
      const { data: activePOs } = await supabase
        .from("purchase_orders")
        .select(`
          po_number,
          quantity,
          product:products(codigo_producto, name, pieces_per_pallet)
        `)
        .in("status", ["pending", "confirmed", "in_production"]);

      // Build products map for pieces_per_pallet validation
      const prodMap = new Map<string, { pieces_per_pallet: number | null }>();
      (activePOs || []).forEach((po: any) => {
        if (po.product?.codigo_producto) {
          prodMap.set(po.product.codigo_producto, {
            pieces_per_pallet: po.product.pieces_per_pallet || null
          });
        }
      });
      setProductsMap(prodMap);

      // Match POs with available inventory by PT code
      const poInventoryData: ActivePOWithInventory[] = [];
      (activePOs || []).forEach((po: any) => {
        if (!po.product?.codigo_producto) return;
        
        const ptCode = po.product.codigo_producto;
        const matchingPallets = filteredPallets.filter(p => p.pt_code === ptCode);
        
        if (matchingPallets.length > 0) {
          poInventoryData.push({
            po_number: po.po_number,
            product_pt_code: ptCode,
            product_description: po.product.name || "",
            total_quantity: po.quantity,
            pieces_per_pallet: po.product.pieces_per_pallet,
            inventory_pallets: matchingPallets.length,
            inventory_volume: matchingPallets.reduce((sum, p) => sum + p.stock, 0)
          });
        }
      });
      setActivePOsWithInventory(poInventoryData);

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

  const handleTogglePalletHold = async (
    palletId: string,
    palletInventoryId: string,
    isOnHold: boolean,
    releaseDate?: Date | null
  ) => {
    try {
      const { error } = await supabase
        .from("load_pallets")
        .update({ is_on_hold: isOnHold })
        .eq("id", palletId);

      if (error) throw error;

      // If putting on hold and a release date is provided, update inventory pallet
      if (isOnHold) {
        if (releaseDate) {
          const { error: invError } = await supabase
            .from("inventory_pallets")
            .update({ release_date: releaseDate.toISOString().split("T")[0] })
            .eq("id", palletInventoryId);

          if (invError) {
            console.error("Error updating inventory release date:", invError);
            throw invError;
          }
        }

        toast.success("Pallet placed on hold");
      } else {
        // If shipping, set release date to load's shipping date
        if (load?.shipping_date) {
          const { error: invError } = await supabase
            .from("inventory_pallets")
            .update({ release_date: load.shipping_date })
            .eq("id", palletInventoryId);

          if (invError) {
            console.error("Error updating inventory release date for shipping:", invError);
            throw invError;
          }
        }

        toast.success("Pallet marked for shipping");
      }

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

  const handleLoadReleasePdfUpload = async (file: File) => {
    if (!id) return;
    
    try {
      const fileName = `loads/${id}/release_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("release-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("release-documents")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("shipping_loads")
        .update({ release_pdf_url: urlData.publicUrl })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Release authorization PDF uploaded");
      fetchLoadData();
    } catch (error) {
      console.error("Error uploading load release PDF:", error);
      toast.error("Failed to upload PDF");
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

  // Get unique destinations from pallets for delivery date dialog
  const uniqueDestinations = useMemo(() => {
    const destinations = pallets
      .filter((p) => p.destination && p.destination !== "tbd" && !p.is_on_hold)
      .map((p) => p.destination as string);
    return [...new Set(destinations)];
  }, [pallets]);

  // Separate pallets into released (has release PDF) and pending (no release PDF) for assembly view
  const releasedPallets = useMemo(() => 
    pallets.filter((p) => p.release_pdf_url), 
    [pallets]
  );
  
  const pendingPallets = useMemo(() => 
    pallets.filter((p) => !p.release_pdf_url), 
    [pallets]
  );

  // Toggle selection for release workflow
  const togglePalletForRelease = (palletId: string) => {
    setSelectedPalletsForRelease((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(palletId)) {
        newSet.delete(palletId);
      } else {
        newSet.add(palletId);
      }
      return newSet;
    });
  };

  const toggleAllPendingPalletsForRelease = () => {
    if (selectedPalletsForRelease.size === pendingPallets.length) {
      setSelectedPalletsForRelease(new Set());
    } else {
      setSelectedPalletsForRelease(new Set(pendingPallets.map((p) => p.id)));
    }
  };

  // Handle batch release PDF upload
  const handleBatchReleasePdfUpload = async (file: File) => {
    if (selectedPalletsForRelease.size === 0) {
      toast.error("Please select pallets to release");
      return;
    }

    setProcessingRelease(true);
    try {
      // Upload the PDF once
      const fileName = `batch-releases/${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("release-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("release-documents")
        .getPublicUrl(fileName);

      // Update all selected pallets with the same PDF URL
      const palletIds = Array.from(selectedPalletsForRelease);
      const { error: updateError } = await supabase
        .from("load_pallets")
        .update({ release_pdf_url: urlData.publicUrl })
        .in("id", palletIds);

      if (updateError) throw updateError;

      toast.success(`${palletIds.length} pallet(s) released with document`);
      setSelectedPalletsForRelease(new Set());
      setReleaseUploadDialogOpen(false);
      fetchLoadData();
    } catch (error) {
      console.error("Error processing batch release:", error);
      toast.error("Failed to process release");
    } finally {
      setProcessingRelease(false);
    }
  };

  // Validation helper for in_transit transition
  const validateForInTransit = (): { valid: boolean; message: string } => {
    if (pallets.length === 0) {
      return { valid: false, message: "Cannot transition to In Transit: No pallets in load" };
    }

    const palletsNotShip = pallets.filter((p) => p.is_on_hold || (!p.is_on_hold && p.destination === null));
    const palletsWithoutDestination = pallets.filter((p) => !p.is_on_hold && (!p.destination || p.destination === "tbd"));
    const palletsOnHold = pallets.filter((p) => p.is_on_hold);

    if (palletsOnHold.length > 0) {
      return { 
        valid: false, 
        message: `Cannot transition to In Transit: ${palletsOnHold.length} pallet(s) are still on hold. All pallets must be set to "Ship" status.` 
      };
    }

    if (palletsWithoutDestination.length > 0) {
      return { 
        valid: false, 
        message: `Cannot transition to In Transit: ${palletsWithoutDestination.length} pallet(s) do not have a valid destination selected.` 
      };
    }

    return { valid: true, message: "" };
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "delivered") {
      // Initialize delivery dates for each destination
      const initialDates = uniqueDestinations.map((dest) => ({
        destination: dest,
        date: null as Date | null,
      }));
      setDeliveryDates(initialDates);
      setPendingStatus(newStatus);
      setStatusDialogOpen(true);
    } else if (newStatus === "in_transit") {
      // Validate before showing confirmation
      const validation = validateForInTransit();
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }
      // Show confirmation dialog for in_transit status
      setInTransitConfirmOpen(true);
    } else {
      // For other statuses, update directly
      handleUpdateLoadStatus(newStatus);
    }
  };

  const handleConfirmInTransit = () => {
    // Double-check validation before proceeding
    const validation = validateForInTransit();
    if (!validation.valid) {
      toast.error(validation.message);
      setInTransitConfirmOpen(false);
      return;
    }
    setInTransitConfirmOpen(false);
    handleUpdateLoadStatus("in_transit");
  };

  const handleUpdateLoadStatus = async (newStatus: string, deliveryDatesData?: DeliveryDateEntry[]) => {
    if (!id) return;

    setUpdatingStatus(true);
    try {
      // Update load status
      const { error: loadError } = await supabase
        .from("shipping_loads")
        .update({ status: newStatus as any })
        .eq("id", id);

      if (loadError) throw loadError;

      // When transitioning to in_transit, record pallets to shipped_pallets table
      if (newStatus === "in_transit") {
        const palletsToShip = pallets.filter((p) => !p.is_on_hold);
        
        if (palletsToShip.length > 0) {
          const shippedRecords = palletsToShip.map((p) => ({
            original_pallet_id: p.pallet_id,
            load_pallet_id: p.id,
            load_id: id,
            pt_code: p.pallet.pt_code,
            description: p.pallet.description,
            customer_lot: p.pallet.customer_lot,
            bfx_order: p.pallet.bfx_order,
            quantity: p.quantity,
            unit: p.pallet.unit,
            traceability: p.pallet.traceability,
            fecha: p.pallet.fecha,
            destination: p.destination,
            shipped_at: new Date().toISOString(),
          }));

          const { error: shippedError } = await supabase
            .from("shipped_pallets")
            .insert(shippedRecords);

          if (shippedError) {
            console.error("Error recording shipped pallets:", shippedError);
            // Don't throw, just log - the status change is more important
          }
        }
      }

      // If delivered, update pallet delivery dates and inventory status
      if (newStatus === "delivered" && deliveryDatesData) {
        for (const entry of deliveryDatesData) {
          if (entry.date) {
            // Update load_pallets with delivery date
            const palletIdsForDest = pallets
              .filter((p) => p.destination === entry.destination && !p.is_on_hold)
              .map((p) => p.id);

            if (palletIdsForDest.length > 0) {
              await supabase
                .from("load_pallets")
                .update({ delivery_date: entry.date.toISOString().split("T")[0] })
                .in("id", palletIdsForDest);

              // Also update shipped_pallets with delivery date
              await supabase
                .from("shipped_pallets")
                .update({ delivery_date: entry.date.toISOString().split("T")[0] })
                .in("load_pallet_id", palletIdsForDest);
            }
          }
        }

        // Update all non-hold pallets to shipped status in inventory
        const palletIds = pallets.filter((p) => !p.is_on_hold).map((p) => p.pallet_id);
        if (palletIds.length > 0) {
          await supabase
            .from("inventory_pallets")
            .update({ status: "shipped" })
            .in("id", palletIds);
        }
      }

      toast.success(`Load status updated to ${statusLabels[newStatus] || newStatus}`);
      setStatusDialogOpen(false);
      setPendingStatus(null);
      fetchLoadData();
    } catch (error) {
      console.error("Error updating load status:", error);
      toast.error("Failed to update load status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmDelivery = () => {
    // Check all destinations have dates
    const missingDates = deliveryDates.filter((d) => !d.date);
    if (missingDates.length > 0) {
      toast.error("Please select delivery dates for all destinations");
      return;
    }
    handleUpdateLoadStatus("delivered", deliveryDates);
  };

  const handleGenerateCustomsDocument = async () => {
    if (!load || pallets.length === 0) {
      toast.error("No pallets in load to generate document");
      return;
    }

    try {
      // Get unique customer_lots from pallets
      const customerLots = [...new Set(
        pallets
          .map(p => p.pallet.customer_lot)
          .filter((lot): lot is string => !!lot)
      )];

      // Fetch order info for each customer_lot
      const { data: ordersData } = await supabase
        .from("purchase_orders")
        .select(`
          po_number,
          sales_order_number,
          price_per_thousand,
          product:products(pieces_per_pallet, piezas_por_paquete)
        `)
        .in("po_number", customerLots);

      // Build order info map
      const orderInfoMap = new Map<string, {
        customer_lot: string;
        sales_order_number: string | null;
        price_per_thousand: number | null;
        pieces_per_pallet: number | null;
        piezas_por_paquete: number | null;
      }>();

      (ordersData || []).forEach((order: any) => {
        orderInfoMap.set(order.po_number, {
          customer_lot: order.po_number,
          sales_order_number: order.sales_order_number,
          price_per_thousand: order.price_per_thousand,
          pieces_per_pallet: order.product?.pieces_per_pallet || null,
          piezas_por_paquete: order.product?.piezas_por_paquete || null,
        });
      });

      // Convert pallets to required format
      const palletData = pallets.filter(p => !p.is_on_hold).map(p => ({
        pt_code: p.pallet.pt_code,
        description: p.pallet.description,
        destination: p.destination,
        quantity: p.quantity,
        gross_weight: p.pallet.gross_weight,
        net_weight: p.pallet.net_weight,
        pieces: p.pallet.pieces,
        unit: p.pallet.unit,
        customer_lot: p.pallet.customer_lot,
        bfx_order: p.pallet.bfx_order,
      }));

      generateCustomsDocument(
        {
          loadNumber: load.load_number,
          shippingDate: load.shipping_date,
          releaseNumber: load.release_number,
        },
        palletData,
        orderInfoMap
      );

      toast.success("Customs document generated successfully");
    } catch (error) {
      console.error("Error generating customs document:", error);
      toast.error("Failed to generate customs document");
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
                {statusLabels[load.status] || load.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Shipping: {format(new Date(load.shipping_date), "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Admin Status Change Dropdown */}
            {isAdmin && load.status !== "assembling" && load.status !== "delivered" && (
              <Select
                value={load.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {load.status === "pending_release" && (
                    <SelectItem value="approved">Released</SelectItem>
                  )}
                  {(load.status === "pending_release" || load.status === "approved") && (
                    <SelectItem value="in_transit">In Transit</SelectItem>
                  )}
                  {(load.status === "pending_release" || load.status === "approved" || load.status === "in_transit") && (
                    <SelectItem value="delivered">Delivered</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {isAdmin && load.status === "assembling" && pallets.length > 0 && (
              <Button onClick={handleSendReleaseRequest} disabled={sendingRelease}>
                {sendingRelease ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send for Release
              </Button>
            )}
            {/* Generate Customs Document Button - visible for in_transit or delivered status */}
            {isAdmin && (load.status === "in_transit" || load.status === "delivered") && pallets.length > 0 && (
              <Button variant="outline" onClick={handleGenerateCustomsDocument}>
                <FileDown className="mr-2 h-4 w-4" />
                Customs Document
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

        {/* Customer Release PDF Upload - Shown when release is pending */}
        {releaseRequest?.status === "pending" && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-lg">Customer Release Approval</CardTitle>
              </div>
              <CardDescription>
                Upload the release authorization PDF sent by the customer to approve the shipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {load.release_pdf_url ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={load.release_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-2"
                    >
                      <FileText className="h-5 w-5" />
                      View Release PDF
                    </a>
                    <label className="cursor-pointer">
                      <Input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLoadReleasePdfUpload(file);
                        }}
                      />
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary cursor-pointer">
                        <Upload className="h-4 w-4" />
                        Replace
                      </span>
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLoadReleasePdfUpload(file);
                      }}
                    />
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Release PDF
                      </span>
                    </Button>
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pallets Section - Assembly mode shows Released/Pending split, other modes show regular table */}
        {load.status === "assembling" && pallets.length > 0 ? (
          <>
            {/* Released Pallets Table */}
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <CardTitle>Released Pallets ({releasedPallets.length})</CardTitle>
                  </div>
                  <CardDescription>
                    Pallets with release authorization documents attached
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {releasedPallets.length === 0 ? (
                  <div className="text-center py-6">
                    <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-sm">No pallets released yet</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {isAdmin && <TableHead>PT Code</TableHead>}
                          <TableHead>Description</TableHead>
                          <TableHead>Customer PO</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Release PDF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {releasedPallets.map((pallet) => (
                          <TableRow key={pallet.id} className="bg-green-50/50 dark:bg-green-950/20">
                            {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                            <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                            <TableCell className="font-mono text-xs">{pallet.pallet.customer_lot || "-"}</TableCell>
                            <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                            <TableCell>
                              <a
                                href={pallet.release_pdf_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <FileText className="h-4 w-4" />
                                View
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Pallets Table */}
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <CardTitle>Pending Pallets ({pendingPallets.length})</CardTitle>
                  </div>
                  <CardDescription>
                    Pallets awaiting release authorization - select pallets and upload release document to move them to released
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPalletsForRelease.size > 0 && (
                    <Button 
                      onClick={() => setReleaseUploadDialogOpen(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Release ({selectedPalletsForRelease.size})
                    </Button>
                  )}
                  {isAdmin && selectedPalletsToDelete.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={deletingHoldPallets}>
                          {deletingHoldPallets ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete ({selectedPalletsToDelete.size})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Pallets?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {selectedPalletsToDelete.size} pallet(s) from this load. 
                            They will be returned to available inventory.
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
              </CardHeader>
              <CardContent>
                {pendingPallets.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground text-sm">All pallets have been released!</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={pendingPallets.length > 0 && selectedPalletsForRelease.size === pendingPallets.length}
                              onCheckedChange={toggleAllPendingPalletsForRelease}
                            />
                          </TableHead>
                          {isAdmin && (
                            <TableHead className="w-[40px]">
                              <span className="text-xs text-destructive">Del</span>
                            </TableHead>
                          )}
                          {isAdmin && <TableHead>PT Code</TableHead>}
                          <TableHead>Description</TableHead>
                          <TableHead>Customer PO</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPallets.map((pallet) => (
                          <TableRow key={pallet.id} className={selectedPalletsForRelease.has(pallet.id) ? "bg-yellow-50 dark:bg-yellow-950/30" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPalletsForRelease.has(pallet.id)}
                                onCheckedChange={() => togglePalletForRelease(pallet.id)}
                              />
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedPalletsToDelete.has(pallet.id)}
                                  onCheckedChange={() => togglePalletToDelete(pallet.id)}
                                  className="border-destructive data-[state=checked]:bg-destructive"
                                />
                              </TableCell>
                            )}
                            {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                            <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                            <TableCell className="font-mono text-xs">{pallet.pallet.customer_lot || "-"}</TableCell>
                            <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          /* Regular Pallets Table for non-assembling states */
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Pallets in Load</CardTitle>
                <CardDescription>
                  {isAdmin 
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
                        const hasChosenToShip = !pallet.is_on_hold && pallet.pallet.release_date === load?.shipping_date;
                        const palletStatus = pallet.is_on_hold ? "hold" : (hasChosenToShip ? "ship" : "pending");
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
                            {releaseRequest?.status === "pending" && !isAdmin ? (
                              <Select
                                value={palletStatus}
                                onValueChange={(val) => {
                                  if (val === "ship") {
                                    handleTogglePalletHold(pallet.id, pallet.pallet_id, false);
                                  }
                                  if (val === "hold") {
                                    handleTogglePalletHold(pallet.id, pallet.pallet_id, true);
                                  }
                                }}
                              >
                                <SelectTrigger
                                  className={`w-[120px] ${
                                    palletStatus === "hold"
                                      ? "border-destructive text-destructive"
                                      : palletStatus === "pending"
                                        ? "border-yellow-500 text-yellow-600"
                                        : "border-green-500 text-green-600"
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending" disabled>
                                    <span className="flex items-center gap-1 text-yellow-600">Pending</span>
                                  </SelectItem>
                                  <SelectItem value="ship">
                                    <span className="flex items-center gap-1">
                                      <Check className="h-3 w-3 text-green-600" />
                                      Ship
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="hold">
                                    <span className="flex items-center gap-1">
                                      <X className="h-3 w-3 text-destructive" />
                                      Hold
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant={
                                  palletStatus === "hold"
                                    ? "destructive"
                                    : palletStatus === "pending"
                                      ? "outline"
                                      : "default"
                                }
                                className={
                                  palletStatus === "pending"
                                    ? "border-yellow-500 text-yellow-600"
                                    : palletStatus === "ship"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                      : ""
                                }
                              >
                                {palletStatus === "hold" ? "On Hold" : palletStatus === "pending" ? "Pending" : "Ship"}
                                {palletStatus === "hold" && pallet.pallet.release_date && (
                                  <span className="ml-1 text-xs">({format(new Date(pallet.pallet.release_date), "MMM d")})</span>
                                )}
                              </Badge>
                            )}
                          </TableCell>
                          {!isAdmin && (
                            <TableCell>
                              {pallet.is_on_hold && releaseRequest?.status === "pending" ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "w-[160px] justify-start text-left font-normal",
                                        !pallet.pallet.release_date && "text-muted-foreground"
                                      )}
                                    >
                                      {pallet.pallet.release_date
                                        ? format(new Date(pallet.pallet.release_date), "MMM d, yyyy")
                                        : "Select release date"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={
                                        pallet.pallet.release_date
                                          ? new Date(pallet.pallet.release_date)
                                          : undefined
                                      }
                                      onSelect={(date) => {
                                        if (date) handleTogglePalletHold(pallet.id, pallet.pallet_id, true, date);
                                      }}
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                      className={cn("p-3 pointer-events-auto")}
                                    />
                                  </PopoverContent>
                                </Popover>
                              ) : pallet.is_on_hold && pallet.pallet.release_date ? (
                                <span className="text-sm">{format(new Date(pallet.pallet.release_date), "MMM d, yyyy")}</span>
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
        )}

        {/* Active POs with Available Inventory - Shown for all views when inventory available */}
        {activePOsWithInventory.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Active POs with Available Inventory</CardTitle>
              </div>
              <CardDescription>
                These active Purchase Orders have matching materials available in inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      {isAdmin && <TableHead>PT Code</TableHead>}
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">PO Qty</TableHead>
                      <TableHead className="text-center">Pallets Available</TableHead>
                      <TableHead className="text-right">Volume Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePOsWithInventory.map((po) => (
                      <TableRow key={po.po_number}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        {isAdmin && <TableCell className="font-mono text-sm">{po.product_pt_code}</TableCell>}
                        <TableCell className="max-w-[200px] truncate">{po.product_description}</TableCell>
                        <TableCell className="text-right">{po.total_quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{po.inventory_pallets}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {po.inventory_volume.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Inventory Table - Shown for admins when not in_transit or delivered */}
        {isAdmin && load.status !== "delivered" && load.status !== "in_transit" && (
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
                          <TableHead className="text-center">Vol. OK</TableHead>
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
                            <TableCell className="text-center">
                              {(() => {
                                const productInfo = productsMap.get(pallet.pt_code);
                                if (!productInfo?.pieces_per_pallet) {
                                  return <span className="text-muted-foreground">-</span>;
                                }
                                const meetsVolume = pallet.stock >= productInfo.pieces_per_pallet;
                                return meetsVolume ? (
                                  <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                ) : (
                                  <span title={`Expected: ${productInfo.pieces_per_pallet.toLocaleString()}`}>
                                    <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                                  </span>
                                );
                              })()}
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

        {/* Delivery Date Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delivery</DialogTitle>
              <DialogDescription>
                Enter the delivery date for each destination in this load.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {deliveryDates.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No destinations assigned to pallets in this load.
                </p>
              ) : (
                deliveryDates.map((entry, index) => (
                  <div key={entry.destination} className="space-y-2">
                    <Label className="capitalize">{entry.destination}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !entry.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {entry.date ? format(entry.date, "PPP") : "Select delivery date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={entry.date || undefined}
                          onSelect={(date) => {
                            setDeliveryDates((prev) =>
                              prev.map((d, i) =>
                                i === index ? { ...d, date: date || null } : d
                              )
                            );
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelivery}
                disabled={updatingStatus || deliveryDates.length === 0}
              >
                {updatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* In Transit Confirmation Dialog */}
        <AlertDialog open={inTransitConfirmOpen} onOpenChange={setInTransitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change Status to In Transit?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block text-destructive font-medium">
                  ⚠️ Warning: Once the load is marked as "In Transit", you will no longer be able to add pallets to this load.
                </span>
                <span className="block">
                  Are you sure you want to proceed?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmInTransit}>
                Confirm In Transit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Release Upload Dialog */}
        <Dialog open={releaseUploadDialogOpen} onOpenChange={setReleaseUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Release Authorization</DialogTitle>
              <DialogDescription>
                Upload the customer release authorization PDF to mark {selectedPalletsForRelease.size} pallet(s) as released.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Selected Pallets ({selectedPalletsForRelease.size})</h4>
                <ScrollArea className="h-32">
                  <ul className="space-y-1 text-sm">
                    {pendingPallets
                      .filter((p) => selectedPalletsForRelease.has(p.id))
                      .map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span className="truncate max-w-[200px]">{p.pallet.description}</span>
                          <span className="text-muted-foreground">{p.quantity.toLocaleString()}</span>
                        </li>
                      ))}
                  </ul>
                </ScrollArea>
              </div>
              <div>
                <Label htmlFor="release-pdf">Release Authorization PDF</Label>
                <Input
                  id="release-pdf"
                  type="file"
                  accept=".pdf"
                  className="mt-2"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleBatchReleasePdfUpload(file);
                    }
                  }}
                  disabled={processingRelease}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReleaseUploadDialogOpen(false)} disabled={processingRelease}>
                Cancel
              </Button>
              <Button disabled className="pointer-events-none opacity-50">
                {processingRelease ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Select file above to release"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

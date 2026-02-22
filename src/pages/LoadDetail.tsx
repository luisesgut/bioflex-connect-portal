import { useState, useEffect, useCallback, useMemo } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
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
  Plus,
  Loader2,
  X,
  Package,
  MapPin,
  FileText,
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
  Pause,
  Scale,
  Undo2,
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
import { LoadPOSummary } from "@/components/shipping/LoadPOSummary";
import { LoadComments } from "@/components/shipping/LoadComments";
import { ReleaseValidationDialog } from "@/components/shipping/ReleaseValidationDialog";

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
  estimated_delivery_date: string | null;
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
  const [deletingPallets, setDeletingPallets] = useState(false);
  const [selectedPalletsToDelete, setSelectedPalletsToDelete] = useState<Set<string>>(new Set());
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [deliveryDates, setDeliveryDates] = useState<DeliveryDateEntry[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [inTransitConfirmOpen, setInTransitConfirmOpen] = useState(false);
  const [inTransitShipDate, setInTransitShipDate] = useState<Date | undefined>(undefined);
  const [activePOsWithInventory, setActivePOsWithInventory] = useState<ActivePOWithInventory[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, { pieces_per_pallet: number | null }>>(new Map());
  const [selectedPalletsForRelease, setSelectedPalletsForRelease] = useState<Set<string>>(new Set());
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [ptCodeToPOMap, setPtCodeToPOMap] = useState<Map<string, string>>(new Map());
  const [selectedReleasedPallets, setSelectedReleasedPallets] = useState<Set<string>>(new Set());
  const [selectedOnHoldPallets, setSelectedOnHoldPallets] = useState<Set<string>>(new Set());
  const [revertingPallets, setRevertingPallets] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [palletsToReplace, setPalletsToReplace] = useState<Set<string>>(new Set());
  const [replaceSelectedPalletIds, setReplaceSelectedPalletIds] = useState<Set<string>>(new Set());
  const [replacingPallets, setReplacingPallets] = useState(false);
  const [replaceInventorySearch, setReplaceInventorySearch] = useState("");

  // Resolve Customer PO: prefer customer_lot from inventory, fallback to PO match by pt_code
  const resolveCustomerPO = (pallet: LoadPallet): string => {
    if (pallet.pallet.customer_lot) return pallet.pallet.customer_lot;
    return ptCodeToPOMap.get(pallet.pallet.pt_code) || "-";
  };

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
      setPallets((palletsData as any) || []);

      // Fetch release request
      const { data: requestData } = await supabase
        .from("release_requests")
        .select("*")
        .eq("load_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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
          product:products(codigo_producto, pt_code, name, pieces_per_pallet)
        `)
        .in("status", ["pending", "confirmed", "accepted", "in_production"]);

      // Build products map for pieces_per_pallet validation
      const prodMap = new Map<string, { pieces_per_pallet: number | null }>();
      (activePOs || []).forEach((po: any) => {
        const ptCode = po.product?.codigo_producto || po.product?.pt_code;
        if (ptCode) {
          prodMap.set(ptCode, {
            pieces_per_pallet: po.product.pieces_per_pallet || null
          });
        }
      });
      setProductsMap(prodMap);

      // Match POs with available inventory by PT code (show all active POs)
      const poInventoryData: ActivePOWithInventory[] = [];
      (activePOs || []).forEach((po: any) => {
        const ptCode = po.product?.codigo_producto || po.product?.pt_code || "";
        const matchingPallets = ptCode ? filteredPallets.filter(p => p.pt_code === ptCode) : [];
        
        poInventoryData.push({
          po_number: po.po_number,
          product_pt_code: ptCode,
          product_description: po.product?.name || "",
          total_quantity: po.quantity,
          pieces_per_pallet: po.product?.pieces_per_pallet || null,
          inventory_pallets: matchingPallets.length,
          inventory_volume: matchingPallets.reduce((sum, p) => sum + p.stock, 0)
        });
      });
      setActivePOsWithInventory(poInventoryData);

      // Build pt_code -> po_number map for Customer PO fallback
      const ptToPO = new Map<string, string>();
      (activePOs || []).forEach((po: any) => {
        const ptCode = po.product?.codigo_producto || po.product?.pt_code;
        if (ptCode && !ptToPO.has(ptCode)) {
          ptToPO.set(ptCode, po.po_number);
        }
      });
      setPtCodeToPOMap(ptToPO);

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

  // Sort pallets by Customer PO (grouped), then by quantity descending within each group
  const sortByPOAndQuantity = useCallback((palletList: LoadPallet[]): LoadPallet[] => {
    return [...palletList].sort((a, b) => {
      const poA = resolveCustomerPO(a);
      const poB = resolveCustomerPO(b);
      if (poA !== poB) return poA.localeCompare(poB);
      return b.quantity - a.quantity;
    });
  }, [ptCodeToPOMap]);

  // Check if a pallet is the first of a new PO group
  const isFirstOfGroup = useCallback((sortedList: LoadPallet[], index: number): boolean => {
    if (index === 0) return false;
    const currentPO = resolveCustomerPO(sortedList[index]);
    const prevPO = resolveCustomerPO(sortedList[index - 1]);
    return currentPO !== prevPO;
  }, [ptCodeToPOMap]);

  // Computed values for pallet categories
  const releasedPallets = useMemo(() => 
    sortByPOAndQuantity(pallets.filter((p) => p.release_number || p.release_pdf_url)), 
    [pallets, sortByPOAndQuantity]
  );
  
  const onHoldPallets = useMemo(() => 
    sortByPOAndQuantity(pallets.filter((p) => p.is_on_hold && !p.release_number && !p.release_pdf_url)), 
    [pallets, sortByPOAndQuantity]
  );
  
  const pendingReleasePallets = useMemo(() => 
    sortByPOAndQuantity(pallets.filter((p) => !p.release_number && !p.release_pdf_url && !p.is_on_hold)), 
    [pallets, sortByPOAndQuantity]
  );

  const sortedAllPallets = useMemo(() => sortByPOAndQuantity(pallets), [pallets, sortByPOAndQuantity]);

  // Calculate total gross weight
  const totalGrossWeight = useMemo(() => {
    return pallets.reduce((sum, p) => sum + (p.pallet.gross_weight || 0), 0);
  }, [pallets]);

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

  const handleDeleteSelectedPallets = async () => {
    if (selectedPalletsToDelete.size === 0) {
      toast.error("No pallets selected to delete");
      return;
    }

    setDeletingPallets(true);
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
      setDeletingPallets(false);
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

  const toggleAllPalletsToDelete = (palletList: LoadPallet[]) => {
    const allSelected = palletList.every((p) => selectedPalletsToDelete.has(p.id));
    if (allSelected) {
      const newSet = new Set(selectedPalletsToDelete);
      palletList.forEach((p) => newSet.delete(p.id));
      setSelectedPalletsToDelete(newSet);
    } else {
      const newSet = new Set(selectedPalletsToDelete);
      palletList.forEach((p) => newSet.add(p.id));
      setSelectedPalletsToDelete(newSet);
    }
  };

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
    if (selectedPalletsForRelease.size === pendingReleasePallets.length) {
      setSelectedPalletsForRelease(new Set());
    } else {
      setSelectedPalletsForRelease(new Set(pendingReleasePallets.map((p) => p.id)));
    }
  };

  // Toggle selection for released pallets (revert)
  const toggleReleasedPallet = (palletId: string) => {
    setSelectedReleasedPallets((prev) => {
      const newSet = new Set(prev);
      newSet.has(palletId) ? newSet.delete(palletId) : newSet.add(palletId);
      return newSet;
    });
  };

  const toggleAllReleasedPallets = () => {
    if (selectedReleasedPallets.size === releasedPallets.length) {
      setSelectedReleasedPallets(new Set());
    } else {
      setSelectedReleasedPallets(new Set(releasedPallets.map((p) => p.id)));
    }
  };

  // Toggle selection for on-hold pallets
  const toggleOnHoldPallet = (palletId: string) => {
    setSelectedOnHoldPallets((prev) => {
      const newSet = new Set(prev);
      newSet.has(palletId) ? newSet.delete(palletId) : newSet.add(palletId);
      return newSet;
    });
  };

  const toggleAllOnHoldPallets = () => {
    if (selectedOnHoldPallets.size === onHoldPallets.length) {
      setSelectedOnHoldPallets(new Set());
    } else {
      setSelectedOnHoldPallets(new Set(onHoldPallets.map((p) => p.id)));
    }
  };

  // Revert released pallets back to pending
  const handleRevertToPending = async () => {
    if (selectedReleasedPallets.size === 0) return;
    setRevertingPallets(true);
    try {
      const palletIds = Array.from(selectedReleasedPallets);
      const { error } = await supabase
        .from("load_pallets")
        .update({ release_number: null, release_pdf_url: null, destination: "tbd", is_on_hold: false })
        .in("id", palletIds);

      if (error) throw error;
      toast.success(`${palletIds.length} pallet(s) reverted to pending`);
      setSelectedReleasedPallets(new Set());
      fetchLoadData();
    } catch (error) {
      console.error("Error reverting pallets:", error);
      toast.error("Failed to revert pallets");
    } finally {
      setRevertingPallets(false);
    }
  };

  // Revert on-hold pallets back to pending
  const handleRevertOnHoldToPending = async () => {
    if (selectedOnHoldPallets.size === 0) return;
    setRevertingPallets(true);
    try {
      const palletIds = Array.from(selectedOnHoldPallets);
      const { error } = await supabase
        .from("load_pallets")
        .update({ is_on_hold: false })
        .in("id", palletIds);

      if (error) throw error;
      toast.success(`${palletIds.length} pallet(s) moved back to pending`);
      setSelectedOnHoldPallets(new Set());
      fetchLoadData();
    } catch (error) {
      console.error("Error reverting on-hold pallets:", error);
      toast.error("Failed to revert pallets");
    } finally {
      setRevertingPallets(false);
    }
  };

  // Delete pallets from pending or on-hold during release phase
  const handleDeleteReleasePhasePallets = async (palletIds: Set<string>) => {
    if (palletIds.size === 0) return;
    setDeletingPallets(true);
    try {
      const palletsToRemove = pallets.filter((p) => palletIds.has(p.id));
      const loadPalletIds = palletsToRemove.map((p) => p.id);
      const inventoryPalletIds = palletsToRemove.map((p) => p.pallet_id);

      const { error: deleteError } = await supabase
        .from("load_pallets")
        .delete()
        .in("id", loadPalletIds);

      if (deleteError) throw deleteError;

      await supabase
        .from("inventory_pallets")
        .update({ status: "available", release_date: null })
        .in("id", inventoryPalletIds);

      const newTotal = Math.max(0, (load?.total_pallets || 0) - palletsToRemove.length);
      await supabase.from("shipping_loads").update({ total_pallets: newTotal }).eq("id", id);

      toast.success(`${palletsToRemove.length} pallet(s) removed from load`);
      setSelectedPalletsForRelease(new Set());
      setSelectedOnHoldPallets(new Set());
      fetchLoadData();
    } catch (error) {
      console.error("Error deleting pallets:", error);
      toast.error("Failed to remove pallets");
    } finally {
      setDeletingPallets(false);
    }
  };

  // Handle opening replace dialog (without deleting on-hold pallets first)
  const handleOpenReplaceDialog = () => {
    setPalletsToReplace(new Set(selectedOnHoldPallets));
    setReplaceSelectedPalletIds(new Set());
    setReplaceInventorySearch("");
    setReplaceDialogOpen(true);
  };

  // Filter available pallets for replace dialog
  const replaceFilteredPallets = useMemo(() => {
    let result = availablePallets;
    if (replaceInventorySearch.trim()) {
      const search = replaceInventorySearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.pt_code.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.traceability.toLowerCase().includes(search) ||
          (p.bfx_order && p.bfx_order.toLowerCase().includes(search))
      );
    }
    return result;
  }, [availablePallets, replaceInventorySearch]);

  // Active POs with stock for replace dialog
  const replacePOSummary = useMemo(() => {
    return activePOsWithInventory
      .filter((po) => po.inventory_pallets > 0)
      .sort((a, b) => b.inventory_pallets - a.inventory_pallets);
  }, [activePOsWithInventory]);

  // Confirm replacement: add new pallets, then remove on-hold ones
  const handleConfirmReplace = async () => {
    if (replaceSelectedPalletIds.size === 0 || !id) {
      toast.error("Please select at least one replacement pallet");
      return;
    }

    setReplacingPallets(true);
    try {
      // 1. Add replacement pallets
      const palletsToAdd = availablePallets.filter((p) => replaceSelectedPalletIds.has(p.id));
      const insertData = palletsToAdd.map((p) => ({
        load_id: id,
        pallet_id: p.id,
        quantity: p.stock,
        destination: "tbd" as const,
      }));

      const { error: insertError } = await supabase.from("load_pallets").insert(insertData);
      if (insertError) throw insertError;

      await supabase
        .from("inventory_pallets")
        .update({ status: "assigned" })
        .in("id", palletsToAdd.map((p) => p.id));

      // 2. Now remove on-hold pallets
      const onHoldToRemove = pallets.filter((p) => palletsToReplace.has(p.id));
      const loadPalletIds = onHoldToRemove.map((p) => p.id);
      const inventoryPalletIds = onHoldToRemove.map((p) => p.pallet_id);

      const { error: deleteError } = await supabase
        .from("load_pallets")
        .delete()
        .in("id", loadPalletIds);

      if (deleteError) throw deleteError;

      await supabase
        .from("inventory_pallets")
        .update({ status: "available", release_date: null })
        .in("id", inventoryPalletIds);

      // 3. Update total pallets count (added - removed)
      const netChange = palletsToAdd.length - onHoldToRemove.length;
      const newTotal = Math.max(0, (load?.total_pallets || 0) + netChange);
      await supabase.from("shipping_loads").update({ total_pallets: newTotal }).eq("id", id);

      toast.success(`Replaced ${onHoldToRemove.length} pallet(s) with ${palletsToAdd.length} new pallet(s)`);
      setReplaceDialogOpen(false);
      setSelectedOnHoldPallets(new Set());
      setPalletsToReplace(new Set());
      setReplaceSelectedPalletIds(new Set());
      fetchLoadData();
    } catch (error: any) {
      console.error("Error replacing pallets:", error);
      if (error.code === "23505") {
        toast.error("Some pallets are already in the load");
      } else {
        toast.error("Failed to replace pallets");
      }
    } finally {
      setReplacingPallets(false);
    }
  };

  // Get unique destinations from pallets for delivery date dialog
  const uniqueDestinations = useMemo(() => {
    const dests = pallets
      .filter((p) => p.destination && p.destination !== "tbd" && !p.is_on_hold)
      .map((p) => p.destination as string);
    return [...new Set(dests)];
  }, [pallets]);

  // Validation helper for in_transit transition
  const validateForInTransit = (): { valid: boolean; message: string } => {
    if (pallets.length === 0) {
      return { valid: false, message: "Cannot transition to In Transit: No pallets in load" };
    }

    const palletsOnHold = pallets.filter((p) => p.is_on_hold);
    const palletsWithoutDestination = pallets.filter((p) => !p.is_on_hold && (!p.destination || p.destination === "tbd"));

    if (palletsOnHold.length > 0) {
      return { 
        valid: false, 
        message: `Cannot transition to In Transit: ${palletsOnHold.length} pallet(s) are still on hold.` 
      };
    }

    if (palletsWithoutDestination.length > 0) {
      return { 
        valid: false, 
        message: `Cannot transition to In Transit: ${palletsWithoutDestination.length} pallet(s) do not have a valid destination.` 
      };
    }

    return { valid: true, message: "" };
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "pending_release" && pallets.length === 0) {
      toast.error("Please add pallets to the load before changing to Pending Release");
      return;
    }

    if (newStatus === "delivered") {
      const initialDates = uniqueDestinations.map((dest) => ({
        destination: dest,
        date: null as Date | null,
      }));
      setDeliveryDates(initialDates);
      setPendingStatus(newStatus);
      setStatusDialogOpen(true);
    } else if (newStatus === "in_transit") {
      const validation = validateForInTransit();
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }
      setInTransitShipDate(new Date(load!.shipping_date));
      setInTransitConfirmOpen(true);
    } else if (newStatus === "pending_release" && user) {
      // Create release request if transitioning to pending_release and none exists
      try {
        const { data: existing } = await supabase
          .from("release_requests")
          .select("id")
          .eq("load_id", id!)
          .limit(1)
          .maybeSingle();

        if (!existing) {
          await supabase.from("release_requests").insert({
            load_id: id!,
            requested_by: user.id,
            status: "pending",
          });
        }
      } catch (error) {
        console.error("Error creating release request:", error);
      }
      handleUpdateLoadStatus(newStatus);
    } else {
      handleUpdateLoadStatus(newStatus);
    }
  };

  const handleConfirmInTransit = async () => {
    const validation = validateForInTransit();
    if (!validation.valid) {
      toast.error(validation.message);
      setInTransitConfirmOpen(false);
      return;
    }
    // Update ship date if changed
    if (inTransitShipDate && id) {
      try {
        await supabase
          .from("shipping_loads")
          .update({ shipping_date: format(inTransitShipDate, "yyyy-MM-dd") })
          .eq("id", id);
      } catch (error) {
        console.error("Error updating ship date:", error);
      }
    }
    setInTransitConfirmOpen(false);
    handleUpdateLoadStatus("in_transit");
  };

  const handleUpdateLoadStatus = async (newStatus: string, deliveryDatesData?: DeliveryDateEntry[]) => {
    if (!id) return;

    setUpdatingStatus(true);
    try {
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
          }
        }
      }

      // If delivered, update pallet delivery dates and inventory status
      if (newStatus === "delivered" && deliveryDatesData) {
        for (const entry of deliveryDatesData) {
          if (entry.date) {
            const palletIdsForDest = pallets
              .filter((p) => p.destination === entry.destination && !p.is_on_hold)
              .map((p) => p.id);

            if (palletIdsForDest.length > 0) {
              await supabase
                .from("load_pallets")
                .update({ delivery_date: entry.date.toISOString().split("T")[0] })
                .in("id", palletIdsForDest);

              await supabase
                .from("shipped_pallets")
                .update({ delivery_date: entry.date.toISOString().split("T")[0] })
                .in("load_pallet_id", palletIdsForDest);
            }
          }
        }

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
      const customerLots = [...new Set(
        pallets
          .map(p => p.pallet.customer_lot)
          .filter((lot): lot is string => !!lot)
      )];

      const { data: ordersData } = await supabase
        .from("purchase_orders")
        .select(`
          po_number,
          sales_order_number,
          price_per_thousand,
          product:products(pieces_per_pallet, piezas_por_paquete)
        `)
        .in("po_number", customerLots);

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

  // Get selected pallets for release dialog
  const selectedPalletsForReleaseData = useMemo(() => {
    return pendingReleasePallets.filter((p) => selectedPalletsForRelease.has(p.id));
  }, [pendingReleasePallets, selectedPalletsForRelease]);

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

  const isReleasePhase = load.status === "pending_release" || load.status === "approved";
  const canEditPallets = load.status !== "in_transit" && load.status !== "delivered";

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
              {load.estimated_delivery_date && (
                <> • ETA: {format(new Date(load.estimated_delivery_date), "MMMM d, yyyy")}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Admin Status Change Dropdown */}
            {isAdmin && load.status !== "delivered" && (
              <Select
                value={load.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assembling">Assembling</SelectItem>
                  <SelectItem value="pending_release">Pending Release</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            )}
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
                      This will permanently delete load {load.load_number} and return all pallets to inventory.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteLoad} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Load Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
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
                  ? `${24 - pallets.length} more for full load`
                  : "Over capacity"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Weight</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGrossWeight.toLocaleString()} kg</div>
              <p className="text-xs text-muted-foreground">
                {totalGrossWeight > 20000 ? (
                  <span className="text-destructive">Over weight limit!</span>
                ) : (
                  `${(20000 - totalGrossWeight).toLocaleString()} kg capacity remaining`
                )}
              </p>
            </CardContent>
          </Card>
          {isReleasePhase && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pallet Status</CardTitle>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-green-100 text-green-800">{releasedPallets.length} Released</Badge>
                    <Badge className="bg-yellow-100 text-yellow-800">{pendingReleasePallets.length} Pending</Badge>
                    <Badge className="bg-red-100 text-red-800">{onHoldPallets.length} On Hold</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Destinations</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {(() => {
                    const destLabels: Record<string, string> = {
                      yuma: "Yuma, AZ",
                      salinas: "Salinas, CA",
                      bakersfield: "Bakersfield, CA",
                      coachella: "Coachella, CA",
                    };
                    const destinations = [...new Set(
                      pallets
                        .filter((p) => p.destination && p.destination !== "tbd")
                        .map((p) => destLabels[p.destination!] || p.destination!)
                    )];
                    return destinations.length > 0 ? (
                      <ul className="space-y-1">
                        {destinations.map((dest) => (
                          <li key={dest} className="text-sm font-medium flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {dest}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No destinations assigned</p>
                    );
                  })()}
                </CardContent>
              </Card>
            </>
          )}
          {!isReleasePhase && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Destinations</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {pallets.filter((p) => p.destination && p.destination !== "tbd").length} / {pallets.length}
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
            </>
          )}
        </div>

        {/* PO Summary for pallets in load */}
        {pallets.length > 0 && (
          <LoadPOSummary pallets={pallets} isAdmin={isAdmin} ptCodeToPOMap={ptCodeToPOMap} />
        )}

        {/* Release Phase - Split Pallet Views */}
        {isReleasePhase && (
          <>
            {/* Released Pallets */}
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <CardTitle>Released Pallets ({releasedPallets.length})</CardTitle>
                  </div>
                  <CardDescription>
                    Pallets that have been approved for shipping
                  </CardDescription>
                </div>
                {isAdmin && selectedReleasedPallets.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={revertingPallets}>
                        {revertingPallets ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="mr-2 h-4 w-4" />
                        )}
                        Revert to Pending ({selectedReleasedPallets.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revert to Pending?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear the release number, PDF and destination for {selectedReleasedPallets.size} pallet(s) and move them back to pending.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevertToPending}>
                          Revert
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
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
                          {isAdmin && (
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={releasedPallets.length > 0 && selectedReleasedPallets.size === releasedPallets.length}
                                onCheckedChange={toggleAllReleasedPallets}
                              />
                            </TableHead>
                          )}
                          {isAdmin && <TableHead>PT Code</TableHead>}
                          <TableHead>Description</TableHead>
                          <TableHead>Customer PO</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Release #</TableHead>
                          <TableHead>Release PDF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {releasedPallets.map((pallet, index) => (
                          <TableRow key={pallet.id} className={cn(
                            "bg-green-50/50 dark:bg-green-950/20",
                            isFirstOfGroup(releasedPallets, index) && "border-t-2 border-t-border"
                          )}>
                            {isAdmin && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedReleasedPallets.has(pallet.id)}
                                  onCheckedChange={() => toggleReleasedPallet(pallet.id)}
                                />
                              </TableCell>
                            )}
                            {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                            <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                            <TableCell className="font-mono text-xs">{resolveCustomerPO(pallet)}</TableCell>
                            <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                            <TableCell>
                              {(() => {
                                const dest = destinations.find((d) => d.value === pallet.destination);
                                return dest ? dest.label : (pallet.destination || "TBD");
                              })()}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{pallet.release_number || "-"}</TableCell>
                            <TableCell>
                              {pallet.release_pdf_url ? (
                                <button
                                  onClick={() => openStorageFile(pallet.release_pdf_url, 'release-documents')}
                                  className="text-primary hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                                >
                                  <FileText className="h-4 w-4" />
                                  View
                                </button>
                              ) : (
                                "-"
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

            {/* Pending Release Pallets */}
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <CardTitle>Pending Release ({pendingReleasePallets.length})</CardTitle>
                  </div>
                  <CardDescription>
                    Select pallets and upload release document to approve them
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && selectedPalletsForRelease.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={deletingPallets}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove ({selectedPalletsForRelease.size})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Selected Pallets?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {selectedPalletsForRelease.size} pallet(s) from this load and return them to inventory.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteReleasePhasePallets(selectedPalletsForRelease)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {selectedPalletsForRelease.size > 0 && (
                    <Button 
                      onClick={() => setReleaseDialogOpen(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Process ({selectedPalletsForRelease.size})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingReleasePallets.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground text-sm">All pallets have been processed!</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={pendingReleasePallets.length > 0 && selectedPalletsForRelease.size === pendingReleasePallets.length}
                              onCheckedChange={toggleAllPendingPalletsForRelease}
                            />
                          </TableHead>
                          {isAdmin && <TableHead>PT Code</TableHead>}
                          <TableHead>Description</TableHead>
                          <TableHead>Customer PO</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingReleasePallets.map((pallet, index) => (
                          <TableRow 
                            key={pallet.id} 
                            className={cn(
                              selectedPalletsForRelease.has(pallet.id) ? "bg-yellow-50 dark:bg-yellow-950/30" : "",
                              isFirstOfGroup(pendingReleasePallets, index) && "border-t-2 border-t-border"
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedPalletsForRelease.has(pallet.id)}
                                onCheckedChange={() => togglePalletForRelease(pallet.id)}
                              />
                            </TableCell>
                            {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                            <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                            <TableCell className="font-mono text-xs">{resolveCustomerPO(pallet)}</TableCell>
                            <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* On Hold Pallets */}
            {onHoldPallets.length > 0 && (
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pause className="h-5 w-5 text-red-600" />
                      <CardTitle>On Hold ({onHoldPallets.length})</CardTitle>
                    </div>
                    <CardDescription>
                      Pallets that have been placed on hold
                    </CardDescription>
                  </div>
                  {isAdmin && selectedOnHoldPallets.size > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={revertingPallets}>
                            {revertingPallets ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Undo2 className="mr-2 h-4 w-4" />
                            )}
                            To Pending ({selectedOnHoldPallets.size})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revert to Pending?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will move {selectedOnHoldPallets.size} pallet(s) back to the Pending Release section.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRevertOnHoldToPending}>
                              Revert
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" size="sm" onClick={handleOpenReplaceDialog}>
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        Replace ({selectedOnHoldPallets.size})
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={deletingPallets}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove ({selectedOnHoldPallets.size})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Selected Pallets?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {selectedOnHoldPallets.size} pallet(s) from this load and return them to inventory.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteReleasePhasePallets(selectedOnHoldPallets)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {isAdmin && (
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={onHoldPallets.length > 0 && selectedOnHoldPallets.size === onHoldPallets.length}
                                onCheckedChange={toggleAllOnHoldPallets}
                              />
                            </TableHead>
                          )}
                          {isAdmin && <TableHead>PT Code</TableHead>}
                          <TableHead>Description</TableHead>
                          <TableHead>Customer PO</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {onHoldPallets.map((pallet, index) => (
                          <TableRow key={pallet.id} className={cn(
                            "bg-red-50/50 dark:bg-red-950/20",
                            isFirstOfGroup(onHoldPallets, index) && "border-t-2 border-t-border"
                          )}>
                            {isAdmin && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedOnHoldPallets.has(pallet.id)}
                                  onCheckedChange={() => toggleOnHoldPallet(pallet.id)}
                                />
                              </TableCell>
                            )}
                            {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                            <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                            <TableCell className="font-mono text-xs">{resolveCustomerPO(pallet)}</TableCell>
                            <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments Section */}
            <LoadComments loadId={id!} userId={user?.id} isAdmin={isAdmin} />
          </>
        )}

        {/* Assembly Phase - Pallets in Load */}
        {load.status === "assembling" && pallets.length > 0 && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Pallets in Load</CardTitle>
                <CardDescription>
                  Pallets selected for this load
                </CardDescription>
              </div>
              {isAdmin && selectedPalletsToDelete.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deletingPallets}>
                      {deletingPallets ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Remove ({selectedPalletsToDelete.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Selected Pallets?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove {selectedPalletsToDelete.size} pallet(s) from this load.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelectedPallets} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedPalletsToDelete.size === pallets.length && pallets.length > 0}
                            onCheckedChange={() => toggleAllPalletsToDelete(pallets)}
                          />
                        </TableHead>
                      )}
                      {isAdmin && <TableHead>PT Code</TableHead>}
                      <TableHead>Description</TableHead>
                      <TableHead>Customer PO</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAllPallets.map((pallet, index) => (
                      <TableRow key={pallet.id} className={cn(
                        isFirstOfGroup(sortedAllPallets, index) && "border-t-2 border-t-border"
                      )}>
                        {isAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={selectedPalletsToDelete.has(pallet.id)}
                              onCheckedChange={() => togglePalletToDelete(pallet.id)}
                            />
                          </TableCell>
                        )}
                        {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                        <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                        <TableCell className="font-mono text-xs">{resolveCustomerPO(pallet)}</TableCell>
                        <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* In Transit / Delivered - Simple Pallet List */}
        {(load.status === "in_transit" || load.status === "delivered") && pallets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pallets in Load</CardTitle>
              <CardDescription>
                {load.status === "delivered" ? "Delivered pallets" : "Pallets currently in transit"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && <TableHead>PT Code</TableHead>}
                      <TableHead>Description</TableHead>
                      <TableHead>Customer PO</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Release #</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAllPallets.map((pallet, index) => (
                      <TableRow key={pallet.id} className={cn(
                        isFirstOfGroup(sortedAllPallets, index) && "border-t-2 border-t-border"
                      )}>
                        {isAdmin && <TableCell className="font-mono">{pallet.pallet.pt_code}</TableCell>}
                        <TableCell className="max-w-[200px] truncate">{pallet.pallet.description}</TableCell>
                        <TableCell className="font-mono text-xs">{resolveCustomerPO(pallet)}</TableCell>
                        <TableCell className="text-right">{pallet.quantity.toLocaleString()}</TableCell>
                        <TableCell>
                          {destinations.find((d) => d.value === pallet.destination)?.label || "TBD"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{pallet.release_number || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active POs with Available Inventory - Always show during assembling */}
        {isAdmin && load.status === "assembling" && activePOsWithInventory.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Active POs with Available Inventory</CardTitle>
              </div>
              <CardDescription>
                Active Purchase Orders and their matching materials in inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>PT Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">PO Qty</TableHead>
                      <TableHead className="text-center">Pallets Available</TableHead>
                      <TableHead className="text-right">Volume Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePOsWithInventory
                      .filter((po) => po.inventory_pallets > 0)
                      .sort((a, b) => b.inventory_pallets - a.inventory_pallets)
                      .map((po) => (
                        <TableRow key={po.po_number}>
                          <TableCell className="font-medium">{po.po_number}</TableCell>
                          <TableCell className="font-mono text-sm">{po.product_pt_code || "-"}</TableCell>
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

        {/* Available Inventory Table - Shown for admins during assembly */}
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
                          <TableHead className="text-center">Vol. OK</TableHead>
                          <ColumnFilterHeader label="Sales Order" filterKey="bfx_order" options={uniqueBfxOrders} />
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

        {/* Replace Pallets Dialog - full inventory view */}
        <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Replace On-Hold Pallets</DialogTitle>
              <DialogDescription>
                Replacing {palletsToReplace.size} on-hold pallet(s). Select replacement pallets from available inventory below. On-hold pallets will only be removed after replacements are confirmed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto space-y-4">
              {/* Active POs Summary */}
              {replacePOSummary.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Active POs with Available Stock
                  </h4>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO #</TableHead>
                          <TableHead>PT Code</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Pallets</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {replacePOSummary.map((po) => (
                          <TableRow key={po.po_number}>
                            <TableCell className="font-medium">{po.po_number}</TableCell>
                            <TableCell className="font-mono text-sm">{po.product_pt_code || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{po.product_description}</TableCell>
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
                </div>
              )}

              {/* Available Pallets List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Available Pallets ({availablePallets.length})</h4>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pallets..."
                      value={replaceInventorySearch}
                      onChange={(e) => setReplaceInventorySearch(e.target.value)}
                      className="pl-8 w-[220px] h-8"
                    />
                  </div>
                </div>
                <div className="rounded-md border">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={replaceFilteredPallets.length > 0 && replaceSelectedPalletIds.size === replaceFilteredPallets.length}
                              onCheckedChange={() => {
                                if (replaceSelectedPalletIds.size === replaceFilteredPallets.length) {
                                  setReplaceSelectedPalletIds(new Set());
                                } else {
                                  setReplaceSelectedPalletIds(new Set(replaceFilteredPallets.map((p) => p.id)));
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>PT Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead>Sales Order</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {replaceFilteredPallets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                              No available pallets found
                            </TableCell>
                          </TableRow>
                        ) : (
                          replaceFilteredPallets.map((pallet) => (
                            <TableRow
                              key={pallet.id}
                              className={replaceSelectedPalletIds.has(pallet.id) ? "bg-muted/50" : ""}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={replaceSelectedPalletIds.has(pallet.id)}
                                  onCheckedChange={() => {
                                    setReplaceSelectedPalletIds((prev) => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(pallet.id)) {
                                        newSet.delete(pallet.id);
                                      } else {
                                        newSet.add(pallet.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-sm">{format(new Date(pallet.fecha), "MM/dd/yyyy")}</TableCell>
                              <TableCell className="font-mono">{pallet.pt_code}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{pallet.description}</TableCell>
                              <TableCell className="text-right font-medium">{pallet.stock.toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{pallet.bfx_order || "-"}</TableCell>
                              <TableCell className="text-sm">{pallet.unit}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReplaceDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmReplace} disabled={replaceSelectedPalletIds.size === 0 || replacingPallets}>
                {replacingPallets ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                )}
                Replace with {replaceSelectedPalletIds.size} Pallet(s)
              </Button>
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
        <Dialog open={inTransitConfirmOpen} onOpenChange={setInTransitConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Status to In Transit?</DialogTitle>
              <DialogDescription className="space-y-2">
                <span className="block text-destructive font-medium">
                  ⚠️ Warning: Once the load is marked as "In Transit", you will no longer be able to modify pallets.
                </span>
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
                        !inTransitShipDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {inTransitShipDate ? format(inTransitShipDate, "PPP") : "Select ship date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={inTransitShipDate}
                      onSelect={setInTransitShipDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInTransitConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmInTransit} disabled={!inTransitShipDate || updatingStatus}>
                {updatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm In Transit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Release Validation Dialog */}
        <ReleaseValidationDialog
          open={releaseDialogOpen}
          onOpenChange={setReleaseDialogOpen}
          selectedPallets={selectedPalletsForReleaseData}
          loadId={id!}
          onComplete={() => {
            setSelectedPalletsForRelease(new Set());
            fetchLoadData();
          }}
        />
      </div>
    </MainLayout>
  );
}

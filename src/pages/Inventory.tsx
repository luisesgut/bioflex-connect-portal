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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Package, Loader2, ChevronDown, X, ArrowUpDown, ArrowDown, ArrowUp, RefreshCw, Clock, AlertTriangle, Ghost } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { syncSapInventoryFromEndpoint } from "@/utils/sapInventorySync";
import { CreateVirtualPalletDialog } from "@/components/inventory/CreateVirtualPalletDialog";

interface SAPInventoryItem {
  id: string;
  fecha: string;
  pt_code: string;
  description: string;
  stock: number;
  unit: string;
  gross_weight: number | null;
  net_weight: number | null;
  traceability: string;
  bfx_order: string | null;
  pieces: number | null;
  pallet_type: string | null;
  status: string;
  synced_at: string;
  is_virtual?: boolean;
}

interface InventoryFilters {
  fecha: string[];
  pt_code: string[];
  description: string[];
  unit: string[];
  traceability: string[];
  bfx_order: string[];
  status: string[];
}

const statusStyles: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  assigned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

export default function Inventory() {
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const [inventory, setInventory] = useState<SAPInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [sapUnavailable, setSapUnavailable] = useState(false);
  const [createVirtualOpen, setCreateVirtualOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<InventoryFilters>({
    fecha: [],
    pt_code: [],
    description: [],
    unit: [],
    traceability: [],
    bfx_order: [],
    status: [],
  });
  const [dateSortOrder, setDateSortOrder] = useState<"asc" | "desc" | null>("desc");

  const loadFromDB = useCallback(async () => {
    try {
      // Fetch SAP inventory and real assigned pallets in parallel
      const [sapResult, virtualResult, assignedResult] = await Promise.all([
        supabase
          .from("sap_inventory")
          .select("*")
          .order("pt_code", { ascending: true }),
        supabase
          .from("inventory_pallets")
          .select("*")
          .eq("is_virtual", true),
        supabase
          .from("load_pallets")
          .select("pallet_id, inventory_pallets!inner(traceability, pt_code)")
      ]);

      if (sapResult.error) throw sapResult.error;

      // Build a set of traceability+pt_code combos that are truly assigned to loads
      const assignedKeys = new Set<string>();
      (assignedResult.data || []).forEach((lp: any) => {
        const inv = lp.inventory_pallets;
        if (inv) {
          assignedKeys.add(`${inv.traceability}||${inv.pt_code}`);
        }
      });

      const sapItems: SAPInventoryItem[] = (sapResult.data || []).map((d: any) => {
        // Determine real status: assigned only if this pallet is actually in a load
        const key = `${d.traceability || ""}||${d.pt_code || ""}`;
        const realStatus = assignedKeys.has(key) ? "assigned" : "available";

        return {
          id: d.id,
          fecha: d.fecha,
          pt_code: d.pt_code || "",
          description: d.description || "",
          stock: d.stock || 0,
          unit: d.unit || "MIL",
          gross_weight: d.gross_weight,
          net_weight: d.net_weight,
          traceability: d.traceability || "",
          bfx_order: d.bfx_order,
          pieces: d.pieces,
          pallet_type: d.pallet_type,
          status: realStatus,
          synced_at: d.synced_at,
          is_virtual: false,
        };
      });

      const virtualItems: SAPInventoryItem[] = (virtualResult.data || []).map((d: any) => ({
        id: d.id,
        fecha: d.fecha,
        pt_code: d.pt_code || "",
        description: d.description || "",
        stock: d.stock || 0,
        unit: d.unit || "MIL",
        gross_weight: d.gross_weight,
        net_weight: d.net_weight,
        traceability: d.traceability || "",
        bfx_order: d.bfx_order,
        pieces: d.pieces,
        pallet_type: d.pallet_type,
        status: d.status || "available",
        synced_at: d.created_at,
        is_virtual: true,
      }));

      setInventory([...virtualItems, ...sapItems]);

      if (sapItems.length > 0) {
        setLastSyncTime(sapItems[0].synced_at);
      }
    } catch (error) {
      console.error("Error loading inventory from DB:", error);
    }
  }, []);

  const syncSAPInventory = useCallback(async () => {
    setSyncing(true);
    setSapUnavailable(false);

    try {
      const data = await syncSapInventoryFromEndpoint();
      setLastSyncTime(data.synced_at);
      setSapUnavailable(false);
      toast.success(`Inventario sincronizado: ${data.count} registros`);
      await loadFromDB();
    } catch (err) {
      console.error("SAP sync exception:", err);
      setSapUnavailable(true);
      toast.warning("SAP no disponible — mostrando último snapshot");
      await loadFromDB();
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [loadFromDB]);

  useEffect(() => {
    if (isAdmin) {
      syncSAPInventory();
      return;
    }

    loadFromDB().finally(() => setLoading(false));
  }, [isAdmin, syncSAPInventory, loadFromDB]);

  // Filter toggle function
  const toggleFilter = (filterKey: keyof InventoryFilters, value: string) => {
    setFilters(prev => {
      const current = prev[filterKey];
      if (current.includes(value)) {
        return { ...prev, [filterKey]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [filterKey]: [...current, value] };
      }
    });
  };

  const clearColumnFilter = (filterKey: keyof InventoryFilters) => {
    setFilters(prev => ({ ...prev, [filterKey]: [] }));
  };

  const clearAllFilters = () => {
    setFilters({
      fecha: [],
      pt_code: [],
      description: [],
      unit: [],
      traceability: [],
      bfx_order: [],
      status: [],
    });
    setSearchQuery("");
  };

  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0) || searchQuery.length > 0;

  // Get unique values for filter options
  const uniqueDates = [...new Set(inventory.map(i => new Date(i.fecha).toLocaleDateString()))].sort();
  const uniquePtCodes = [...new Set(inventory.map(i => i.pt_code))].filter(Boolean).sort();
  const uniqueDescriptions = [...new Set(inventory.map(i => i.description))].filter(Boolean).sort();
  const uniqueUnits = [...new Set(inventory.map(i => i.unit))].filter(Boolean).sort();
  const uniqueTraceability = [...new Set(inventory.map(i => i.traceability))].filter(Boolean).sort();
  const uniqueBfxOrders = [...new Set(inventory.map(i => i.bfx_order || "-"))].sort();
  const uniqueStatuses = [...new Set(inventory.map(i => i.status))].sort();

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
    const activeFilters = filters[filterKey];
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
                onClick={() => setFilters(prev => ({ ...prev, [filterKey]: filteredOptions }))}
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
                        onCheckedChange={() => toggleFilter(filterKey, option)}
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
    const activeFilters = filters.fecha;
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
                  onClick={() => setFilters(prev => ({ ...prev, fecha: filteredOptions }))}
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
                          onCheckedChange={() => toggleFilter("fecha", option)}
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

  // Apply filters to inventory
  const filteredInventory = inventory
    .filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.pt_code.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.traceability.toLowerCase().includes(query) ||
          item.bfx_order?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      const dateStr = new Date(item.fecha).toLocaleDateString();
      if (filters.fecha.length > 0 && !filters.fecha.includes(dateStr)) return false;
      if (filters.pt_code.length > 0 && !filters.pt_code.includes(item.pt_code)) return false;
      if (filters.description.length > 0 && !filters.description.includes(item.description)) return false;
      if (filters.unit.length > 0 && !filters.unit.includes(item.unit)) return false;
      if (filters.traceability.length > 0 && !filters.traceability.includes(item.traceability)) return false;
      if (filters.bfx_order.length > 0 && !filters.bfx_order.includes(item.bfx_order || "-")) return false;
      if (filters.status.length > 0 && !filters.status.includes(item.status)) return false;

      return true;
    })
    .sort((a, b) => {
      // Virtual pallets always first
      if (a.is_virtual && !b.is_virtual) return -1;
      if (!a.is_virtual && b.is_virtual) return 1;
      // Then date sort
      if (!dateSortOrder) return 0;
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return dateSortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const availableCount = filteredInventory.filter((i) => i.status === "available").length;
  const assignedCount = filteredInventory.filter((i) => i.status === "assigned").length;
  const virtualCount = filteredInventory.filter((i) => i.is_virtual).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Sync Banner */}
        {syncing && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-300">
              Sincronizando con SAP...
            </AlertDescription>
          </Alert>
        )}

        {sapUnavailable && !syncing && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-300">
              SAP no disponible — mostrando último snapshot guardado
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('page.inventory.title')}</h1>
            <p className="text-muted-foreground">
              Inventario SAP en tiempo real
              {virtualCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                  • {virtualCount} virtual{virtualCount > 1 ? "es" : ""}
                </span>
              )}
            </p>
            {lastSyncTime && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Última sincronización: {new Date(lastSyncTime).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateVirtualOpen(true)}
              >
                <Ghost className="mr-2 h-4 w-4" />
                + Virtual
              </Button>
              <Button
                variant="outline"
                onClick={() => syncSAPInventory()}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sincronizar SAP
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableCount}</div>
              <p className="text-xs text-muted-foreground">pallets in stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <Package className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedCount}</div>
              <p className="text-xs text-muted-foreground">assigned to delivery</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Clear Filters */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PT code, description, traceability..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No inventory found</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-1">
                {searchQuery
                  ? "No pallets match your search criteria"
                  : "No se encontraron registros de inventario SAP"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <DateColumnHeader />
                  <ColumnFilterHeader label="PT Code" filterKey="pt_code" options={uniquePtCodes} />
                  <ColumnFilterHeader label="Description" filterKey="description" options={uniqueDescriptions} />
                  <TableHead className="text-right">Stock</TableHead>
                  <ColumnFilterHeader label="Traceability" filterKey="traceability" options={uniqueTraceability} />
                  <ColumnFilterHeader label="Sales Order" filterKey="bfx_order" options={uniqueBfxOrders} />
                  <TableHead className="text-right">Pieces</TableHead>
                  <ColumnFilterHeader label="Status" filterKey="status" options={uniqueStatuses} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => (
                  <TableRow key={item.id} className={item.is_virtual ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(item.fecha).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-1.5">
                        {item.pt_code}
                        {item.is_virtual && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                            <Ghost className="h-3 w-3 mr-0.5" />
                            Virtual
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.description}>
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.stock.toLocaleString()} {item.unit}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.traceability}</TableCell>
                    <TableCell>{item.bfx_order || "-"}</TableCell>
                    <TableCell className="text-right">{item.pieces || "-"}</TableCell>
                    <TableCell>
                      <Badge className={statusStyles[item.status] || ""} variant="secondary">
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Virtual Pallet Dialog */}
        <CreateVirtualPalletDialog
          open={createVirtualOpen}
          onOpenChange={setCreateVirtualOpen}
          onCreated={loadFromDB}
        />
      </div>
    </MainLayout>
  );
}

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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Search, Package, Loader2, FileSpreadsheet, Trash2, Calendar, ChevronDown, X, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface InventoryPallet {
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
  customer_lot: string | null;
  pieces: number | null;
  pallet_type: string | null;
  status: "available" | "assigned" | "shipped";
  created_at: string;
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
  const [inventory, setInventory] = useState<InventoryPallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [latestUploadDate, setLatestUploadDate] = useState<string | null>(null);
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

  const fetchInventory = useCallback(async () => {
    try {
      // Get the latest upload timestamp for display
      const { data: latestRecord, error: latestError } = await supabase
        .from("inventory_pallets")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;

      if (latestRecord) {
        setLatestUploadDate(latestRecord.created_at);
      } else {
        setLatestUploadDate(null);
      }

      // Fetch all current inventory
      const { data, error } = await supabase
        .from("inventory_pallets")
        .select("*")
        .order("pt_code", { ascending: true });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const parseExcelDate = (excelDate: any): string => {
    if (!excelDate) return new Date().toISOString().split("T")[0];
    // If it's a number (Excel serial date)
    if (typeof excelDate === "number") {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    // If it's a string, try to parse it
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  };

  const getUnitFromPalletType = (palletType: string): string => {
    const type = (palletType || "").toUpperCase();
    if (type === "CASES") return "bags";
    if (type === "ROLLS") return "Impressions";
    return "MIL";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const pallets = jsonData.map((row: any) => {
        const palletType = row["Pallet"] || "CASES";
        const stockValue = parseFloat(row["Stock"]) || 0;
        
        return {
          fecha: parseExcelDate(row["Production Date"]),
          pt_code: row["PT"] || row["Codigo"] || "",
          description: row["Descripción"] || "",
          stock: stockValue * 1000, // Multiply by 1000 as values are in thousands
          unit: getUnitFromPalletType(palletType),
          gross_weight: parseFloat(row["Peso bruto"]) || null,
          net_weight: parseFloat(row["Peso neto"]) || null,
          traceability: row["Trazabilidad"] || "",
          bfx_order: row["Sales Order"] || null,
          customer_lot: row["Customer PO Number"] || null,
          pieces: parseInt(row["Piezas"]) || null,
          pallet_type: palletType,
          status: "available" as const,
        };
      });

      // Delete all existing available inventory before inserting new data
      const { error: deleteError } = await supabase
        .from("inventory_pallets")
        .delete()
        .eq("status", "available");

      if (deleteError) throw deleteError;

      const { error } = await supabase.from("inventory_pallets").insert(pallets);

      if (error) throw error;

      toast.success(`Successfully uploaded ${pallets.length} inventory records (replaced previous inventory)`);
      setUploadDialogOpen(false);
      fetchInventory();
    } catch (error) {
      console.error("Error uploading inventory:", error);
      toast.error("Failed to upload inventory file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePallet = async (id: string) => {
    try {
      const { error } = await supabase.from("inventory_pallets").delete().eq("id", id);
      if (error) throw error;
      toast.success("Pallet deleted");
      fetchInventory();
    } catch (error) {
      console.error("Error deleting pallet:", error);
      toast.error("Failed to delete pallet");
    }
  };

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
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.pt_code.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.traceability.toLowerCase().includes(query) ||
          item.bfx_order?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Column filters
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
      if (!dateSortOrder) return 0;
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return dateSortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const availableCount = filteredInventory.filter((i) => i.status === "available").length;
  const assignedCount = filteredInventory.filter((i) => i.status === "assigned").length;
  const shippedCount = filteredInventory.filter((i) => i.status === "shipped").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground">
              Manage production inventory and pallets
            </p>
            {latestUploadDate && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Last updated: {new Date(latestUploadDate).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          {isAdmin && (
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Inventory
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Inventory File</DialogTitle>
                  <DialogDescription>
                    Upload an Excel file (.xlsx) with your daily inventory data.
                    Expected columns: Production Date, Codigo, Descripción, Stock, Peso bruto, Peso neto, Trazabilidad, Sales Order, Customer PO Number, Piezas, Pallet
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="max-w-xs mx-auto"
                    />
                  </div>
                  {uploading && (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing file...</span>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
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
              <p className="text-xs text-muted-foreground">assigned to loads</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shipped</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shippedCount}</div>
              <p className="text-xs text-muted-foreground">pallets shipped</p>
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
                  : "Upload your daily inventory file to get started"}
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
                  <ColumnFilterHeader label="BFX Order" filterKey="bfx_order" options={uniqueBfxOrders} />
                  <TableHead className="text-right">Pieces</TableHead>
                  <ColumnFilterHeader label="Status" filterKey="status" options={uniqueStatuses} />
                  {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(item.fecha).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.pt_code}</TableCell>
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
                      <Badge className={statusStyles[item.status]} variant="secondary">
                        {item.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePallet(item.id)}
                          disabled={item.status !== "available"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

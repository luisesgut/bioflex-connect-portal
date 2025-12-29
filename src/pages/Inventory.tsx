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
import { Upload, Search, Package, Loader2, FileSpreadsheet, Trash2 } from "lucide-react";
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

  const fetchInventory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_pallets")
        .select("*")
        .order("fecha", { ascending: false });

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
          pt_code: row["Codigo"] || "",
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

      const { error } = await supabase.from("inventory_pallets").insert(pallets);

      if (error) throw error;

      toast.success(`Successfully uploaded ${pallets.length} inventory records`);
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

  const filteredInventory = inventory.filter(
    (item) =>
      item.pt_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.traceability.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.bfx_order?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableCount = inventory.filter((i) => i.status === "available").length;
  const assignedCount = inventory.filter((i) => i.status === "assigned").length;
  const shippedCount = inventory.filter((i) => i.status === "shipped").length;

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

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by PT code, description, traceability..."
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
                  <TableHead>Date</TableHead>
                  <TableHead>PT Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Traceability</TableHead>
                  <TableHead>BFX Order</TableHead>
                  <TableHead className="text-right">Pieces</TableHead>
                  <TableHead>Status</TableHead>
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

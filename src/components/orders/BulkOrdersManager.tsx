import { useState, useRef } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkOrdersManagerProps {
  onUpdated: () => void;
}

export function BulkOrdersManager({ onUpdated }: BulkOrdersManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          quantity,
          total_price,
          status,
          is_hot_order,
          requested_delivery_date,
          estimated_delivery_date,
          sales_order_number,
          notes,
          created_at,
          products (name, sku)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Create CSV content
      const headers = [
        "ID",
        "PO Number",
        "Product SKU",
        "Product Name",
        "Quantity",
        "Total Price",
        "Status",
        "Is Hot Order",
        "Requested Delivery Date",
        "Estimated Delivery Date",
        "Sales Order Number",
        "Notes",
        "Created At",
      ];

      const rows = (data || []).map((order: any) => [
        order.id,
        order.po_number,
        order.products?.sku || "",
        order.products?.name || "",
        order.quantity,
        order.total_price || "",
        order.status,
        order.is_hot_order ? "Yes" : "No",
        order.requested_delivery_date || "",
        order.estimated_delivery_date || "",
        order.sales_order_number || "",
        order.notes || "",
        order.created_at,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `purchase_orders_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("Purchase orders exported successfully");
    } catch (error) {
      console.error("Error downloading orders:", error);
      toast.error("Failed to download orders");
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row");
      }

      // Parse header
      const headers = parseCSVLine(lines[0]);
      const idIndex = headers.findIndex((h) => h.toLowerCase() === "id");
      const statusIndex = headers.findIndex((h) => h.toLowerCase() === "status");
      const hotOrderIndex = headers.findIndex((h) => h.toLowerCase() === "is hot order");
      const estDeliveryIndex = headers.findIndex((h) => h.toLowerCase() === "estimated delivery date");
      const salesOrderIndex = headers.findIndex((h) => h.toLowerCase() === "sales order number");
      const notesIndex = headers.findIndex((h) => h.toLowerCase() === "notes");

      if (idIndex === -1) {
        throw new Error("CSV must contain an 'ID' column");
      }

      // Parse data rows and update
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const id = values[idIndex]?.trim();
        
        if (!id) continue;

        const updateData: Record<string, any> = {};
        
        if (statusIndex !== -1 && values[statusIndex]?.trim()) {
          updateData.status = values[statusIndex].trim().toLowerCase();
        }
        if (hotOrderIndex !== -1 && values[hotOrderIndex]?.trim()) {
          updateData.is_hot_order = values[hotOrderIndex].trim().toLowerCase() === "yes";
        }
        if (estDeliveryIndex !== -1 && values[estDeliveryIndex]?.trim()) {
          updateData.estimated_delivery_date = values[estDeliveryIndex].trim();
        }
        if (salesOrderIndex !== -1 && values[salesOrderIndex]?.trim()) {
          updateData.sales_order_number = values[salesOrderIndex].trim();
        }
        if (notesIndex !== -1) {
          updateData.notes = values[notesIndex]?.trim() || null;
        }

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from("purchase_orders")
            .update(updateData)
            .eq("id", id);

          if (error) {
            console.error(`Error updating order ${id}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      toast.success(`Updated ${successCount} orders${errorCount > 0 ? `, ${errorCount} failed` : ""}`);
      onUpdated();
      setUploadDialogOpen(false);
    } catch (error: any) {
      console.error("Error uploading orders:", error);
      toast.error(error.message || "Failed to upload orders");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Helper to parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setUploadDialogOpen(true)}
      >
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Orders</DialogTitle>
            <DialogDescription>
              Upload a CSV file to update multiple orders at once. The file must include an "ID" column.
              Editable columns: Status, Is Hot Order, Estimated Delivery Date, Sales Order Number, Notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Uploading..." : "Click to select CSV file"}
                </span>
              </label>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Download existing orders first to get the correct format</li>
                <li>Only modify the columns you want to update</li>
                <li>Status values: pending, submitted, accepted, in-production, shipped, delivered</li>
                <li>Is Hot Order values: Yes or No</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

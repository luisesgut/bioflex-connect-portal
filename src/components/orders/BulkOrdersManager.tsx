import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkOrdersManagerProps {
  onUpdated: () => void;
}

export function BulkOrdersManager({ onUpdated }: BulkOrdersManagerProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          quantity,
          price_per_thousand,
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
        "Price Per Thousand",
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
        order.price_per_thousand || "",
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

    </div>
  );
}

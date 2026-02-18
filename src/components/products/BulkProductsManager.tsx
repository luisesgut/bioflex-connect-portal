import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Product {
  id: string;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  tipo_empaque: string | null;
  pt_code: string | null;
  pieces_per_pallet: number | null;
  print_card: string | null;
  print_card_url: string | null;
  customer_tech_spec_url: string | null;
  dp_sales_csr_names: string | null;
  activa: boolean | null;
}

interface BulkProductsManagerProps {
  products: Product[];
  onImported: () => void;
}

const EXPORT_COLUMNS = [
  { key: "id", label: "ID (do not modify)" },
  { key: "customer_item", label: "Item Code" },
  { key: "item_description", label: "Item Description" },
  { key: "customer", label: "Final Customer" },
  { key: "item_type", label: "Item Type" },
  { key: "tipo_empaque", label: "Tipo Empaque" },
  { key: "pt_code", label: "PT Number" },
  { key: "pieces_per_pallet", label: "Pieces/Pallet" },
  { key: "print_card", label: "PC Number" },
  { key: "print_card_url", label: "PC PDF URL" },
  { key: "customer_tech_spec_url", label: "Customer Spec URL" },
  { key: "dp_sales_csr_names", label: "DP Sales/CSR" },
  { key: "activa", label: "Active (TRUE/FALSE)" },
] as const;

export function BulkProductsManager({ products, onImported }: BulkProductsManagerProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    const rows = products.map((p) =>
      EXPORT_COLUMNS.reduce((acc, col) => {
        const val = p[col.key as keyof Product];
        acc[col.label] = val === null || val === undefined ? "" : String(val);
        return acc;
      }, {} as Record<string, string>)
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");

    // Auto-fit columns
    const colWidths = EXPORT_COLUMNS.map((col) => ({
      wch: Math.max(col.label.length, 15),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exported", description: `${products.length} products exported to Excel.` });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      let updated = 0;
      let errors = 0;

      for (const row of rows) {
        const id = row["ID (do not modify)"];
        if (!id) { errors++; continue; }

        const updateData: Record<string, unknown> = {};
        for (const col of EXPORT_COLUMNS) {
          if (col.key === "id") continue;
          const val = row[col.label];
          if (val === undefined) continue;

          if (col.key === "pieces_per_pallet") {
            updateData[col.key] = val ? Number(val) : null;
          } else if (col.key === "activa") {
            updateData[col.key] = val?.toUpperCase() === "TRUE";
          } else {
            updateData[col.key] = val || null;
          }
        }

        const { error } = await supabase.from("products").update(updateData).eq("id", id);
        if (error) { errors++; } else { updated++; }
      }

      toast({
        title: "Import complete",
        description: `${updated} products updated${errors > 0 ? `, ${errors} errors` : ""}.`,
        variant: errors > 0 ? "destructive" : "default",
      });
      onImported();
    } catch (err) {
      toast({ title: "Import failed", description: "Could not parse the Excel file.", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
        <Download className="h-4 w-4" />
        Export Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-1">
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {importing ? "Importing..." : "Import Excel"}
      </Button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
    </div>
  );
}

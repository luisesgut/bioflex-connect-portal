import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Info, DollarSign, FileText, Download } from "lucide-react";
import * as XLSX from "xlsx";

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
    unit: string;
    gross_weight: number | null;
    net_weight: number | null;
  };
}

interface POSummary {
  customer_lot: string;
  pt_code: string;
  description: string;
  pallet_count: number;
  total_quantity: number;
  released_count: number;
  pending_count: number;
  on_hold_count: number;
  subtotal: number | null;
  release_numbers: Set<string>;
  prev_shipped: number;
}

interface PODocuments {
  pc_number: string | null;
}

interface LoadPOSummaryProps {
  pallets: LoadPallet[];
  isAdmin: boolean;
  title?: string;
  ptCodeToPOMap?: Map<string, string>;
  bfxOrderToPOMap?: Map<string, string>;
  poPriceMap?: Map<string, number>;
  loadStatus?: string;
  poTotalsMap?: Map<string, { total_quantity: number; shipped_quantity: number }>;
  poDocumentsMap?: Map<string, PODocuments>;
  onOpenStorageFile?: (storedValue: string | null | undefined, defaultBucket?: string) => void;
  loadNumber?: string;
}

export function LoadPOSummary({
  pallets,
  isAdmin,
  title = "POs in this Load",
  ptCodeToPOMap,
  bfxOrderToPOMap,
  poPriceMap,
  loadStatus,
  poTotalsMap,
  poDocumentsMap,
  onOpenStorageFile,
  loadNumber,
}: LoadPOSummaryProps) {
  const showSubtotals = isAdmin && poPriceMap && poPriceMap.size > 0;
  const showPoTotals = isAdmin && poTotalsMap && poTotalsMap.size > 0;

  const poSummary = useMemo(() => {
    const poMap = new Map<string, POSummary>();
    
    pallets.forEach((pallet) => {
      const key = pallet.pallet.customer_lot || (pallet.pallet.bfx_order && bfxOrderToPOMap?.get(pallet.pallet.bfx_order)) || ptCodeToPOMap?.get(pallet.pallet.pt_code) || "unassigned";
      const existing = poMap.get(key);
      
      const isReleased = !!pallet.release_number || !!pallet.release_pdf_url;
      const isOnHold = pallet.is_on_hold;
      const isPending = !isReleased && !isOnHold;

      const price = poPriceMap?.get(key);
      const quantityInThousands = pallet.pallet.unit === "MIL" ? pallet.quantity : pallet.quantity / 1000;
      const palletSubtotal = price ? quantityInThousands * price : 0;
      const displayQuantity = pallet.pallet.unit === "MIL" ? pallet.quantity * 1000 : pallet.quantity;
      
      if (existing) {
        existing.pallet_count++;
        existing.total_quantity += displayQuantity;
        if (isReleased) existing.released_count++;
        if (isPending) existing.pending_count++;
        if (isOnHold) existing.on_hold_count++;
        if (existing.subtotal !== null) {
          existing.subtotal += palletSubtotal;
        }
        if (pallet.release_number) existing.release_numbers.add(pallet.release_number);
      } else {
        const releaseSet = new Set<string>();
        if (pallet.release_number) releaseSet.add(pallet.release_number);
        poMap.set(key, {
          customer_lot: key,
          pt_code: pallet.pallet.pt_code,
          description: pallet.pallet.description,
          pallet_count: 1,
          total_quantity: displayQuantity,
          released_count: isReleased ? 1 : 0,
          pending_count: isPending ? 1 : 0,
          on_hold_count: isOnHold ? 1 : 0,
          subtotal: price ? palletSubtotal : null,
          release_numbers: releaseSet,
          prev_shipped: 0,
        });
      }
    });
    
    // Calculate previously shipped volume (total shipped minus what's in this load)
    if (poTotalsMap) {
      poMap.forEach((po) => {
        const totals = poTotalsMap.get(po.customer_lot);
        if (totals) {
          // shipped_quantity = all shipped ever; subtract this load's volume to get previous
          po.prev_shipped = Math.max(0, totals.shipped_quantity - po.total_quantity);
        }
      });
    }

    return Array.from(poMap.values());
  }, [pallets, ptCodeToPOMap, bfxOrderToPOMap, poPriceMap, poTotalsMap]);

  const grandTotal = useMemo(() => {
    if (!showSubtotals) return 0;
    return poSummary.reduce((sum, po) => sum + (po.subtotal || 0), 0);
  }, [poSummary, showSubtotals]);

  if (poSummary.length === 0) return null;

  const formatCurrency = (val: number) => "$" + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleExportExcel = () => {
    const rows = poSummary.map((po) => ({
      "Customer PO": po.customer_lot,
      "Product": po.description,
      "Pallets": po.pallet_count,
      "Volume": po.total_quantity,
      ...(showPoTotals ? { "Prev. Shipped": po.prev_shipped || "" } : {}),
      "Release #": po.release_numbers.size > 0 ? Array.from(po.release_numbers).join(", ") : "",
      "Released": po.released_count,
      "Pending": po.pending_count,
      "On Hold": po.on_hold_count,
      ...(showSubtotals ? { "Subtotal": po.subtotal ?? "" } : {}),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 40 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      ...(showSubtotals ? [{ wch: 14 }] : []),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "POs in Load");
    XLSX.writeFile(wb, `POs_Load_${loadNumber || "export"}.xlsx`);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="mr-1.5 h-4 w-4" />
              Excel
            </Button>
          )}
        </div>
        <CardDescription>
          Summary of Customer POs included in this load
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer PO</TableHead>
                {isAdmin && <TableHead>PT Code</TableHead>}
                <TableHead>Product</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead className="text-center">Pallets</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                {showPoTotals && <TableHead className="text-right">Prev. Shipped</TableHead>}
                <TableHead className="text-center">Released</TableHead>
                <TableHead className="text-center">Pending</TableHead>
                <TableHead className="text-center">On Hold</TableHead>
                {showSubtotals && <TableHead className="text-right">Subtotal</TableHead>}
                {showPoTotals && (
                  <>
                    <TableHead className="text-right">PO Total</TableHead>
                    <TableHead className="text-right">Shipped</TableHead>
                    <TableHead className="text-right">PO Pending</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {poSummary.map((po) => {
                const docs = poDocumentsMap?.get(po.customer_lot);
                return (
                  <TableRow key={po.customer_lot}>
                    <TableCell className="font-medium">{po.customer_lot}</TableCell>
                    {isAdmin && <TableCell className="font-mono text-sm">{po.pt_code}</TableCell>}
                    <TableCell className="max-w-[200px] truncate">{po.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {docs?.pc_number ? (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => onOpenStorageFile?.(docs.pc_number, "print-cards")}
                          >
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            PC
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{po.pallet_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {po.total_quantity.toLocaleString()}
                    </TableCell>
                    {showPoTotals && (
                      <TableCell className="text-right text-muted-foreground">
                        {po.prev_shipped > 0 ? po.prev_shipped.toLocaleString() : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      {po.released_count > 0 && (
                        <Badge variant="secondary" className="border border-success/20 bg-success/10 text-success">
                          {po.released_count}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {po.pending_count > 0 && (
                        <Badge variant="secondary" className="border border-warning/20 bg-warning/10 text-warning">
                          {po.pending_count}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {po.on_hold_count > 0 && (
                        <Badge variant="secondary" className="border border-destructive/20 bg-destructive/10 text-destructive">
                          {po.on_hold_count}
                        </Badge>
                      )}
                    </TableCell>
                    {showSubtotals && (
                      <TableCell className="text-right font-medium">
                        {po.subtotal !== null ? formatCurrency(po.subtotal) : "-"}
                      </TableCell>
                    )}
                    {showPoTotals && (() => {
                      const totals = poTotalsMap?.get(po.customer_lot);
                      const poTotal = totals?.total_quantity || 0;
                      const shipped = totals?.shipped_quantity || 0;
                      const pending = poTotal - shipped;
                      return (
                        <>
                          <TableCell className="text-right">{poTotal > 0 ? poTotal.toLocaleString() : "-"}</TableCell>
                          <TableCell className="text-right">{shipped > 0 ? shipped.toLocaleString() : "-"}</TableCell>
                          <TableCell className="text-right">{poTotal > 0 ? pending.toLocaleString() : "-"}</TableCell>
                        </>
                      );
                    })()}
                  </TableRow>
                );
              })}
            </TableBody>
            {showSubtotals && grandTotal > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={(isAdmin ? 9 : 8) + (showPoTotals ? 4 : 0)} className="text-right font-semibold">
                    <div className="flex items-center justify-end gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span>Load Total:</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-success">
                    {formatCurrency(grandTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

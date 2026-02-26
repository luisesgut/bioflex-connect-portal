import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Info, DollarSign } from "lucide-react";

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
}

interface LoadPOSummaryProps {
  pallets: LoadPallet[];
  isAdmin: boolean;
  title?: string;
  ptCodeToPOMap?: Map<string, string>;
  poPriceMap?: Map<string, number>;
  loadStatus?: string;
  poTotalsMap?: Map<string, { total_quantity: number; shipped_quantity: number }>;
}

export function LoadPOSummary({ pallets, isAdmin, title = "POs in this Load", ptCodeToPOMap, poPriceMap, loadStatus, poTotalsMap }: LoadPOSummaryProps) {
  const showSubtotals = isAdmin && poPriceMap && poPriceMap.size > 0;

  const poSummary = useMemo(() => {
    const poMap = new Map<string, POSummary>();
    
    pallets.forEach((pallet) => {
      const key = pallet.pallet.customer_lot || ptCodeToPOMap?.get(pallet.pallet.pt_code) || "unassigned";
      const existing = poMap.get(key);
      
      const isReleased = !!pallet.release_number || !!pallet.release_pdf_url;
      const isOnHold = pallet.is_on_hold;
      const isPending = !isReleased && !isOnHold;

      const price = poPriceMap?.get(key);
      const palletSubtotal = price ? (pallet.quantity / 1000) * price : 0;
      
      if (existing) {
        existing.pallet_count++;
        existing.total_quantity += pallet.quantity;
        if (isReleased) existing.released_count++;
        if (isPending) existing.pending_count++;
        if (isOnHold) existing.on_hold_count++;
        if (existing.subtotal !== null) {
          existing.subtotal += palletSubtotal;
        }
      } else {
        poMap.set(key, {
          customer_lot: key,
          pt_code: pallet.pallet.pt_code,
          description: pallet.pallet.description,
          pallet_count: 1,
          total_quantity: pallet.quantity,
          released_count: isReleased ? 1 : 0,
          pending_count: isPending ? 1 : 0,
          on_hold_count: isOnHold ? 1 : 0,
          subtotal: price ? palletSubtotal : null,
        });
      }
    });
    
    return Array.from(poMap.values());
  }, [pallets, ptCodeToPOMap, poPriceMap]);

  const grandTotal = useMemo(() => {
    if (!showSubtotals) return 0;
    return poSummary.reduce((sum, po) => sum + (po.subtotal || 0), 0);
  }, [poSummary, showSubtotals]);

  if (poSummary.length === 0) return null;

  const formatCurrency = (val: number) => "$" + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
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
                <TableHead className="text-center">Pallets</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-center">Released</TableHead>
                <TableHead className="text-center">Pending</TableHead>
                <TableHead className="text-center">On Hold</TableHead>
                {showSubtotals && <TableHead className="text-right">Subtotal</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {poSummary.map((po) => (
                <TableRow key={po.customer_lot}>
                  <TableCell className="font-medium">{po.customer_lot}</TableCell>
                  {isAdmin && <TableCell className="font-mono text-sm">{po.pt_code}</TableCell>}
                  <TableCell className="max-w-[200px] truncate">{po.description}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{po.pallet_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {po.total_quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {po.released_count > 0 && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        {po.released_count}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {po.pending_count > 0 && (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                        {po.pending_count}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {po.on_hold_count > 0 && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                        {po.on_hold_count}
                      </Badge>
                    )}
                  </TableCell>
                  {showSubtotals && (
                    <TableCell className="text-right font-medium">
                      {po.subtotal !== null ? formatCurrency(po.subtotal) : "-"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            {showSubtotals && grandTotal > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-right font-semibold">
                    <div className="flex items-center justify-end gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span>Load Total:</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700 dark:text-green-400">
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

import { useState, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import ExcelJS from "exceljs";

interface POTRMatch {
  rowIndex: number;
  poNumber: string;
  itemCode: string;
  description: string;
  currentShipped: string;
  currentOnFloor: string;
  newShipped: number | null;
  newOnFloor: number | null;
  otherStock: number | null;
  salesOrder: string | null;
  pricePerThousand: number | null;
  matched: boolean;
}

export default function POTRUpdate() {
  const [workbookBuffer, setWorkbookBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [matches, setMatches] = useState<POTRMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [headerRowIdx, setHeaderRowIdx] = useState(-1);
  const [shippedColIdx, setShippedColIdx] = useState(-1);
  const [onFloorColIdx, setOnFloorColIdx] = useState(-1);
  const [sheetName, setSheetName] = useState("");

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      setWorkbookBuffer(buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      const ws = wb.worksheets[0];
      if (!ws) { setLoading(false); return; }
      setSheetName(ws.name);

      // Convert to array of arrays for header detection
      const aoa: string[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const vals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          while (vals.length < colNumber - 1) vals.push("");
          vals.push(String(cell.value ?? ""));
        });
        while (aoa.length < rowNumber - 1) aoa.push([]);
        aoa.push(vals);
      });

      // Find header row
      let hIdx = -1;
      for (let i = 0; i < Math.min(aoa.length, 15); i++) {
        const row = aoa[i].map(c => c.toLowerCase());
        if (row.some(c => c === "item #" || c === "item#") && row.some(c => c === "dp")) {
          hIdx = i;
          break;
        }
      }
      if (hIdx < 0) {
        for (let i = 0; i < Math.min(aoa.length, 15); i++) {
          const row = aoa[i].map(c => c.toLowerCase());
          if (row.some(c => c.includes("priority")) && row.some(c => c.includes("shipped"))) {
            hIdx = i;
            break;
          }
        }
      }
      if (hIdx < 0) { setLoading(false); return; }

      setHeaderRowIdx(hIdx);
      const headers = aoa[hIdx].map(h => h.trim().toLowerCase());

      const dpIdx = headers.findIndex(h => h === "dp");
      const itemIdx = headers.findIndex(h => h === "item #" || h === "item#");
      const descIdx = headers.findIndex(h => h.includes("description"));
      const sIdx = headers.findIndex(h => h.includes("shipped") || h.includes("already"));
      const fIdx = headers.findIndex(h => h.includes("floor") || h.includes("bioflex"));

      setShippedColIdx(sIdx);
      setOnFloorColIdx(fIdx);

      if (dpIdx < 0) { setLoading(false); return; }

      const poNumbers: string[] = [];
      const dataRows: { rowIndex: number; poNumber: string; itemCode: string; description: string; currentShipped: string; currentOnFloor: string }[] = [];

      for (let i = hIdx + 1; i < aoa.length; i++) {
        const row = aoa[i];
        const po = (row[dpIdx] || "").trim();
        if (!po || !/^\d+$/.test(po)) continue;

        dataRows.push({
          rowIndex: i,
          poNumber: po,
          itemCode: itemIdx >= 0 ? (row[itemIdx] || "").trim() : "",
          description: descIdx >= 0 ? (row[descIdx] || "").trim() : "",
          currentShipped: sIdx >= 0 ? (row[sIdx] || "").trim() : "",
          currentOnFloor: fIdx >= 0 ? (row[fIdx] || "").trim() : "",
        });
        poNumbers.push(po);
      }

      const { data: sapOrders } = await supabase
        .from("sap_orders")
        .select("po_number, cantidad_enviada, pt_code, pedido, precio")
        .in("po_number", poNumbers);

      const sapMap = new Map<string, { shipped: number | null; ptCode: string | null; pedido: string | null; precio: number | null }>();
      for (const so of sapOrders || []) {
        if (so.po_number) {
          sapMap.set(so.po_number, {
            shipped: so.cantidad_enviada != null ? Number(so.cantidad_enviada) : null,
            ptCode: so.pt_code || null,
            pedido: so.pedido != null ? String(so.pedido) : null,
            precio: so.precio != null ? Number(so.precio) : null,
          });
        }
      }

      const ptCodes = [...new Set((sapOrders || []).map(s => s.pt_code).filter(Boolean))] as string[];
      const palletsByPtAndOrder = new Map<string, number>();
      const totalByPt = new Map<string, number>();
      if (ptCodes.length > 0) {
        const { data: pallets } = await supabase
          .from("inventory_pallets")
          .select("pt_code, stock, bfx_order, status")
          .eq("is_virtual", false)
          .in("pt_code", ptCodes);

        for (const p of pallets || []) {
          const stock = Number(p.stock || 0);
          if (p.status === "available") {
            totalByPt.set(p.pt_code, (totalByPt.get(p.pt_code) || 0) + stock);
          }
          if (p.bfx_order && p.status === "available") {
            const key = `${p.pt_code}::${p.bfx_order}`;
            palletsByPtAndOrder.set(key, (palletsByPtAndOrder.get(key) || 0) + stock);
          }
        }
      }

      const results: POTRMatch[] = dataRows.map(dr => {
        const sap = sapMap.get(dr.poNumber);
        let onFloorPO: number | null = null;
        let otherStock: number | null = null;
        if (sap?.ptCode) {
          const poKey = `${sap.ptCode}::${dr.poNumber}`;
          onFloorPO = palletsByPtAndOrder.get(poKey) ?? 0;
          const totalPt = totalByPt.get(sap.ptCode) ?? 0;
          otherStock = Math.max(0, totalPt - onFloorPO);
        }
        return {
          ...dr,
          newShipped: sap?.shipped ?? null,
          newOnFloor: onFloorPO,
          otherStock,
          salesOrder: sap?.pedido ?? null,
          pricePerThousand: sap?.precio ?? null,
          matched: !!sap,
        };
      });

      setMatches(results);
    } catch (err) {
      console.error("Error parsing POTR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!workbookBuffer || shippedColIdx < 0 || onFloorColIdx < 0) return;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(workbookBuffer);

    const ws = wb.worksheets[0];
    if (!ws) return;

    // Determine columns for the two new fields: after the last used column
    const headerExcelRow = headerRowIdx + 1;
    const headerRow = ws.getRow(headerExcelRow);
    let maxCol = 0;
    headerRow.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
      if (colNumber > maxCol) maxCol = colNumber;
    });
    const salesOrderCol = maxCol + 1;
    const otherStockCol = maxCol + 2;
    const priceCol = maxCol + 3;

    // Write headers for new columns
    const soHeaderCell = headerRow.getCell(salesOrderCol);
    soHeaderCell.value = "Sales Order #";
    soHeaderCell.font = { bold: true };

    const osHeaderCell = headerRow.getCell(otherStockCol);
    osHeaderCell.value = "Other Stock (Same Product)";
    osHeaderCell.font = { bold: true };

    const priceHeaderCell = headerRow.getCell(priceCol);
    priceHeaderCell.value = "Price Per Thousand";
    priceHeaderCell.font = { bold: true };

    for (const match of matches) {
      if (!match.matched) continue;
      const excelRow = match.rowIndex + 1;
      const row = ws.getRow(excelRow);

      const shippedCell = row.getCell(shippedColIdx + 1);
      shippedCell.value = match.newShipped ?? 0;

      const onFloorCell = row.getCell(onFloorColIdx + 1);
      onFloorCell.value = match.newOnFloor ?? 0;

      row.getCell(salesOrderCol).value = match.salesOrder || "";
      row.getCell(otherStockCol).value = match.otherStock ?? 0;
      row.getCell(priceCol).value = match.pricePerThousand ?? "";
    }

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.xlsx$/i, "") + `_updated_${ts}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workbookBuffer, matches, shippedColIdx, onFloorColIdx, headerRowIdx, fileName]);

  const matchedCount = matches.filter(m => m.matched).length;
  const unmatchedCount = matches.filter(m => !m.matched).length;
  const hasUpdates = matches.some(m => m.matched && (m.newShipped != null || m.newOnFloor != null));

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">POTR Update</h1>
          <p className="text-muted-foreground mt-1">
            Sube el archivo POTR Excel y automáticamente se llenarán las columnas de "Quantity Already Shipped" y "Quantity On Floor At BioFlex".
          </p>
        </div>

        {matches.length === 0 && !loading && (
          <Card className="border-dashed border-2 p-12 flex flex-col items-center gap-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Selecciona el archivo POTR (.xlsx)</p>
            <label>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <Button variant="default" className="gap-2 cursor-pointer" asChild>
                <span><Upload className="h-4 w-4" /> Subir archivo POTR</span>
              </Button>
            </label>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Procesando archivo y consultando datos...</span>
          </div>
        )}

        {matches.length > 0 && !loading && (
          <>
            <div className="flex gap-4 flex-wrap items-center">
              <Badge variant="default" className="text-sm px-3 py-1 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {matchedCount} encontrados
              </Badge>
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {unmatchedCount} sin match en SAP
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <label>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2 cursor-pointer" asChild>
                    <span><Upload className="h-4 w-4" /> Cambiar archivo</span>
                  </Button>
                </label>
                <Button onClick={handleDownload} disabled={!hasUpdates} className="gap-2">
                  <Download className="h-4 w-4" /> Descargar POTR Actualizado
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/50 font-semibold text-sm">
                Vista previa de cambios
              </div>
              <div className="overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DP PO#</TableHead>
                      <TableHead>Item #</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Shipped (actual)</TableHead>
                      <TableHead className="text-right">Shipped (nuevo)</TableHead>
                      <TableHead className="text-right">On Floor (actual)</TableHead>
                      <TableHead className="text-right">On Floor PO (nuevo)</TableHead>
                      <TableHead className="text-right">Otro Stock</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m) => (
                      <TableRow key={`${m.poNumber}-${m.rowIndex}`} className={!m.matched ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{m.poNumber}</TableCell>
                        <TableCell>{m.itemCode}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.description}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{m.currentShipped || "—"}</TableCell>
                        <TableCell className="text-right">
                          {m.newShipped != null ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">{m.newShipped.toLocaleString()}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{m.currentOnFloor || "—"}</TableCell>
                        <TableCell className="text-right">
                          {m.newOnFloor != null ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">{m.newOnFloor.toLocaleString()}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.otherStock != null ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">{m.otherStock.toLocaleString()}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {m.matched ? (
                            <Badge variant="default" className="text-xs">Match</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Sin match</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}

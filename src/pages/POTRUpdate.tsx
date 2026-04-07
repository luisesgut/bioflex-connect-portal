import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Database } from "lucide-react";
import ExcelJS from "exceljs";

interface POTRMatch {
  rowIndex: number; // -1 for SAP-only rows
  poNumber: string;
  itemCode: string;
  description: string;
  itemType: string; // Item Type or Tipo Empaque for column G
  currentShipped: string;
  currentOnFloor: string;
  newShipped: number | null;
  newOnFloor: number | null;
  otherStock: number | null;
  salesOrder: string | null;
  pricePerThousand: number | null;
  matched: boolean;
  isFromSAP: boolean;
  dueDate: string | null;
  blanketQuantity: number | null; // total cantidad from SAP for column L
}

export default function POTRUpdate() {
  const [workbookBuffer, setWorkbookBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [matches, setMatches] = useState<POTRMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [headerRowIdx, setHeaderRowIdx] = useState(-1);
  const [shippedColIdx, setShippedColIdx] = useState(-1);
  const [onFloorColIdx, setOnFloorColIdx] = useState(-1);
  const [dueDateColIdx, setDueDateColIdx] = useState(-1);
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
      const ddIdx = headers.findIndex(h => h.includes("due") || h.includes("vencimiento") || h.includes("date due"));

      setShippedColIdx(sIdx);
      setOnFloorColIdx(fIdx);
      setDueDateColIdx(ddIdx >= 0 ? ddIdx : 10); // Column K = index 10 (0-based)

      if (dpIdx < 0) { setLoading(false); return; }

      const excelPoSet = new Set<string>();
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
        excelPoSet.add(po);
      }

      // Fetch ALL sap_orders (not just the ones in Excel)
      const { data: allSapOrders } = await supabase
        .from("sap_orders")
        .select("po_number, cantidad_enviada, cantidad, pt_code, pedido, precio, producto, fecha_vencimiento, tipo_empaque");

      const sapMap = new Map<string, { shipped: number | null; ptCode: string | null; pedido: string | null; precio: number | null; cantidad: number | null }>();
      const sapOnlyEntries: { poNumber: string; ptCode: string; description: string; shipped: number | null; pedido: string | null; precio: number | null; dueDate: string | null; tipoEmpaque: string; cantidad: number | null }[] = [];

      // Collect SAP-only pt_codes to look up item_type from products table
      const sapOnlyPtCodes = new Set<string>();

      for (const so of allSapOrders || []) {
        if (!so.po_number) continue;
        const entry = {
          shipped: so.cantidad_enviada != null ? Number(so.cantidad_enviada) : null,
          ptCode: so.pt_code || null,
          pedido: so.pedido != null ? String(so.pedido) : null,
          precio: so.precio != null ? Number(so.precio) : null,
          cantidad: so.cantidad != null ? Number(so.cantidad) : null,
        };

        if (excelPoSet.has(so.po_number)) {
          sapMap.set(so.po_number, entry);
        } else {
          if (so.pt_code) sapOnlyPtCodes.add(so.pt_code);
          sapOnlyEntries.push({
            poNumber: so.po_number,
            ptCode: so.pt_code || "",
            description: so.producto || "",
            shipped: entry.shipped,
            pedido: entry.pedido,
            precio: entry.precio,
            dueDate: so.fecha_vencimiento || null,
            tipoEmpaque: so.tipo_empaque || "",
            cantidad: entry.cantidad,
          });
        }
      }

      // Fetch item_type from products table for SAP-only entries
      const itemTypeByPt = new Map<string, string>();
      if (sapOnlyPtCodes.size > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("pt_code, item_type")
          .in("pt_code", [...sapOnlyPtCodes]);
        for (const p of prods || []) {
          if (p.pt_code && p.item_type) itemTypeByPt.set(p.pt_code, p.item_type);
        }
      }

      // Build itemType lookup for SAP-only entries (separate field, not concatenated)
      const sapOnlyItemTypes = new Map<string, string>();
      for (const entry of sapOnlyEntries) {
        const itemType = itemTypeByPt.get(entry.ptCode) || "";
        const tipoEmpaque = entry.tipoEmpaque || "";
        sapOnlyItemTypes.set(entry.poNumber, itemType || tipoEmpaque);
      }

      // Fallback: for POs not found in SAP (closed/completed), check purchase_orders
      const missedPOs = [...excelPoSet].filter(po => !sapMap.has(po));
      if (missedPOs.length > 0) {
        const { data: localOrders } = await supabase
          .from("purchase_orders")
          .select("po_number, sales_order_number, price_per_thousand, quantity, status, product_id, products(pt_code)")
          .in("po_number", missedPOs);

        for (const lo of localOrders || []) {
          if (lo.po_number && !sapMap.has(lo.po_number)) {
            const ptCode = (lo.products as any)?.pt_code || null;
            const isClosed = lo.status === 'closed' || lo.status === 'delivered' || lo.status === 'shipped';
            sapMap.set(lo.po_number, {
              shipped: isClosed ? lo.quantity : null,
              ptCode,
              pedido: lo.sales_order_number || null,
              precio: lo.price_per_thousand != null ? Number(lo.price_per_thousand) : null,
              cantidad: lo.quantity != null ? Number(lo.quantity) : null,
            });
          }
        }
      }

      // Collect ALL pt_codes for inventory lookup (from both Excel-matched and SAP-only)
      const allPtCodes = new Set<string>();
      for (const s of sapMap.values()) {
        if (s.ptCode) allPtCodes.add(s.ptCode);
      }
      for (const s of sapOnlyEntries) {
        if (s.ptCode) allPtCodes.add(s.ptCode);
      }

      const ptCodesArr = [...allPtCodes];
      const palletsByPtAndOrder = new Map<string, number>();
      const totalByPt = new Map<string, number>();
      if (ptCodesArr.length > 0) {
        const { data: pallets } = await supabase
          .from("inventory_pallets")
          .select("pt_code, stock, bfx_order, status")
          .eq("is_virtual", false)
          .in("pt_code", ptCodesArr);

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

      // Build Excel-based results
      const excelResults: POTRMatch[] = dataRows.map(dr => {
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
          itemType: "",
          newShipped: sap?.shipped ?? null,
          newOnFloor: onFloorPO,
          otherStock,
          salesOrder: sap?.pedido ?? null,
          pricePerThousand: sap?.precio ?? null,
          matched: !!sap,
          isFromSAP: false,
          dueDate: null,
          blanketQuantity: sap?.cantidad ?? null,
        };
      });

      // Build SAP-only results
      const sapOnlyResults: POTRMatch[] = sapOnlyEntries.map(entry => {
        let onFloorPO: number | null = null;
        let otherStock: number | null = null;
        if (entry.ptCode) {
          const poKey = `${entry.ptCode}::${entry.poNumber}`;
          onFloorPO = palletsByPtAndOrder.get(poKey) ?? 0;
          const totalPt = totalByPt.get(entry.ptCode) ?? 0;
          otherStock = Math.max(0, totalPt - onFloorPO);
        }
        return {
          rowIndex: -1,
          poNumber: entry.poNumber,
          itemCode: entry.ptCode,
          description: entry.description,
          itemType: sapOnlyItemTypes.get(entry.poNumber) || "",
          currentShipped: "",
          currentOnFloor: "",
          newShipped: entry.shipped,
          newOnFloor: onFloorPO,
          otherStock,
          salesOrder: entry.pedido,
          pricePerThousand: entry.precio,
          matched: true,
          isFromSAP: true,
          dueDate: entry.dueDate,
          blanketQuantity: entry.cantidad,
        };
      });

      // Sort SAP-only: assigned Sales Order first, unassigned last
      sapOnlyResults.sort((a, b) => {
        const aHas = a.salesOrder ? 1 : 0;
        const bHas = b.salesOrder ? 1 : 0;
        return bHas - aHas;
      });

      setMatches([...excelResults, ...sapOnlyResults]);
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

    // Determine columns for the new fields
    const headerExcelRow = headerRowIdx + 1;
    const headerRow = ws.getRow(headerExcelRow);
    let maxCol = 0;
    headerRow.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
      if (colNumber > maxCol) maxCol = colNumber;
    });
    const salesOrderCol = maxCol + 1;
    const otherStockCol = maxCol + 2;
    const priceCol = maxCol + 3;
    // PO Due Date goes to the existing due date column (column K = dueDateColIdx + 1)
    const dueDateExcelCol = dueDateColIdx + 1;

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

    // Number format for thousands
    const thousandsFmt = '#,##0';

    // Find column indices from headers for DP, Item#, Description
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? "").trim().toLowerCase();
    });
    const dpColExcel = headers.findIndex(h => h === "dp");
    const itemColExcel = headers.findIndex(h => h === "item #" || h === "item#");
    const descColExcel = headers.findIndex(h => h?.includes("description"));

    // Write Excel-based matches
    for (const match of matches) {
      if (match.isFromSAP) continue;
      if (!match.matched) continue;
      const excelRow = match.rowIndex + 1;
      const row = ws.getRow(excelRow);

      const shippedCell = row.getCell(shippedColIdx + 1);
      shippedCell.value = match.newShipped ?? 0;
      shippedCell.numFmt = thousandsFmt;

      const onFloorCell = row.getCell(onFloorColIdx + 1);
      onFloorCell.value = match.newOnFloor ?? 0;
      onFloorCell.numFmt = thousandsFmt;

      row.getCell(salesOrderCol).value = match.salesOrder || "";
      const osCell = row.getCell(otherStockCol);
      osCell.value = match.otherStock ?? 0;
      osCell.numFmt = thousandsFmt;
      row.getCell(priceCol).value = match.pricePerThousand ?? "";
    }

    // Append SAP-only rows at the bottom
    const sapOnlyMatches = matches.filter(m => m.isFromSAP);
    if (sapOnlyMatches.length > 0) {
      // Find the last row with data
      let lastDataRow = ws.rowCount;
      const startRow = lastDataRow + 2; // leave a blank row

      // Add a separator label
      const sepRow = ws.getRow(startRow);
      if (dpColExcel > 0) {
        sepRow.getCell(dpColExcel).value = "--- POs Solo en SAP ---";
        sepRow.getCell(dpColExcel).font = { bold: true, color: { argb: "FF0066CC" } };
      }

      let currentRow = startRow + 1;
      for (const match of sapOnlyMatches) {
        const row = ws.getRow(currentRow);
        if (dpColExcel > 0) row.getCell(dpColExcel).value = match.poNumber;
        if (itemColExcel > 0) row.getCell(itemColExcel).value = match.itemCode;
        if (descColExcel > 0) row.getCell(descColExcel).value = match.description;
        const sc = row.getCell(shippedColIdx + 1);
        sc.value = match.newShipped ?? 0;
        sc.numFmt = thousandsFmt;
        const fc = row.getCell(onFloorColIdx + 1);
        fc.value = match.newOnFloor ?? 0;
        fc.numFmt = thousandsFmt;
        row.getCell(salesOrderCol).value = match.salesOrder || "";
        const oc = row.getCell(otherStockCol);
        oc.value = match.otherStock ?? 0;
        oc.numFmt = thousandsFmt;
        row.getCell(priceCol).value = match.pricePerThousand ?? "";
        if (dueDateExcelCol > 0) row.getCell(dueDateExcelCol).value = match.dueDate || "";
        currentRow++;
      }
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
  }, [workbookBuffer, matches, shippedColIdx, onFloorColIdx, dueDateColIdx, headerRowIdx, fileName]);

  const matchedCount = matches.filter(m => m.matched && !m.isFromSAP).length;
  const unmatchedCount = matches.filter(m => !m.matched).length;
  const sapOnlyCount = matches.filter(m => m.isFromSAP).length;
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
                {matchedCount} encontrados en Excel
              </Badge>
              {sapOnlyCount > 0 && (
                <Badge className="text-sm px-3 py-1 gap-1 bg-blue-600 hover:bg-blue-700">
                  <Database className="h-3.5 w-3.5" />
                  {sapOnlyCount} nuevas de SAP
                </Badge>
              )}
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {unmatchedCount} sin match
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
                      <TableHead className="text-right">Precio/Millar</TableHead>
                      <TableHead>PO Date Due</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m, idx) => (
                      <TableRow
                        key={`${m.poNumber}-${m.rowIndex}-${idx}`}
                        className={
                          m.isFromSAP
                            ? "bg-blue-50/50 dark:bg-blue-950/20"
                            : !m.matched
                              ? "opacity-50"
                              : ""
                        }
                      >
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
                        <TableCell className="text-right">
                          {m.pricePerThousand != null ? (
                            <span className="font-medium">${m.pricePerThousand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {m.dueDate || "—"}
                        </TableCell>
                        <TableCell>
                          {m.isFromSAP ? (
                            <Badge className="text-xs bg-blue-600 hover:bg-blue-700">Solo SAP</Badge>
                          ) : m.matched ? (
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

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface POTRRow {
  itemCode: string;
  customer: string;
  dpSalesCsr: string;
}

interface MatchResult {
  itemCode: string;
  customer: string;
  dpSalesCsr: string;
  productId: string | null;
  currentCustomer: string | null;
  currentCsr: string | null;
  status: "will_update" | "no_match" | "already_set";
}

export default function POTRImport() {
  const [parsing, setParsing] = useState(true);
  const [rows, setRows] = useState<POTRRow[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [rawPreview, setRawPreview] = useState<Record<string, { headerRow: number; headers: string[]; rows: string[][] }>>({});
  const [updating, setUpdating] = useState(false);
  const [done, setDone] = useState(false);
  const [updateResults, setUpdateResults] = useState({ updated: 0, errors: 0 });

  useEffect(() => {
    parseAndMatch();
  }, []);

  const parseAndMatch = async () => {
    setParsing(true);
    try {
      // Fetch the Excel from public folder
      const response = await fetch("/temp-potr.xlsx");
      const buffer = await response.arrayBuffer();
      const wb = XLSX.read(buffer);

      const colInfo: Record<string, string[]> = {};
      const allRows: POTRRow[] = [];

      // Only process sheets likely to have PO data
      const targetSheets = wb.SheetNames.filter(s =>
        /open|closed|po/i.test(s)
      );
      // If none match, try all sheets
      const sheetsToProcess = targetSheets.length > 0 ? targetSheets : wb.SheetNames;

      for (const sheetName of sheetsToProcess) {
        const ws = wb.Sheets[sheetName];
        // Read as raw array-of-arrays to find the real header row
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as string[][];
        if (aoa.length < 2) continue;

        // Find the header row: look for a row containing "Item" or "Customer"
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(aoa.length, 15); i++) {
          const row = aoa[i];
          const rowStr = row.map(c => String(c || "").toLowerCase()).join("|");
          if (rowStr.includes("item") && (rowStr.includes("customer") || rowStr.includes("csr"))) {
            headerRowIdx = i;
            break;
          }
        }
        if (headerRowIdx < 0) continue;

        const headers = aoa[headerRowIdx].map(h => String(h || "").trim());
        colInfo[sheetName] = headers.filter(Boolean);

        // Save raw preview for debugging
        const previewRows = aoa.slice(headerRowIdx, headerRowIdx + 8).map(r => r.map(c => String(c || "")));
        setRawPreview(prev => ({ ...prev, [sheetName]: { headerRow: headerRowIdx, headers, rows: previewRows } }));

        // The "Customer" header actually contains Item Codes (e.g., 1587V1)
        // The second "Item" column contains type categories (not useful)
        // Sales/CSR contains the CSR names
        const itemCodeIdx = headers.findIndex(k => /^customer$/i.test(k.trim()));
        const csrIdx = headers.findIndex(k => /csr|sales.*csr|dp.*sales/i.test(k));

        if (itemCodeIdx < 0) continue;

        // Process data rows after header, skip sub-header and category rows
        for (let i = headerRowIdx + 1; i < aoa.length; i++) {
          const row = aoa[i];
          const itemCode = String(row[itemCodeIdx] || "").trim();
          // Skip empty, sub-headers, and non-code values
          if (!itemCode || /^(item\s*#?|description|names?|type|customer)$/i.test(itemCode)) continue;
          // Skip rows that look like merged section headers (no numeric/alphanumeric code pattern)
          if (/^(bag|film|wicket|zipper|roll)/i.test(itemCode) && !/\d/.test(itemCode)) continue;

          const dpSalesCsr = csrIdx >= 0 ? String(row[csrIdx] || "").trim() : "";

          // Skip rows with no CSR data
          if (!dpSalesCsr || /^(names?)$/i.test(dpSalesCsr)) continue;

          allRows.push({ itemCode, customer: "", dpSalesCsr });
        }
      }

      setColumns(colInfo);

      // Deduplicate by itemCode - keep first occurrence with data
      const byItemCode = new Map<string, POTRRow>();
      for (const row of allRows) {
        const existing = byItemCode.get(row.itemCode);
        if (!existing) {
          byItemCode.set(row.itemCode, row);
        } else {
          // Merge: prefer non-empty values
          byItemCode.set(row.itemCode, {
            itemCode: row.itemCode,
            customer: existing.customer || row.customer,
            dpSalesCsr: existing.dpSalesCsr || row.dpSalesCsr,
          });
        }
      }

      const uniqueRows = Array.from(byItemCode.values());
      setRows(uniqueRows);

      // Fetch all products
      const { data: products } = await supabase
        .from("products")
        .select("id, customer_item, customer, dp_sales_csr_names");

      const productMap = new Map<string, { id: string; customer: string | null; dp_sales_csr_names: string | null }>();
      for (const p of products || []) {
        if (p.customer_item) {
          productMap.set(p.customer_item.trim().toUpperCase(), p);
        }
      }

      // Match rows to products
      const matchResults: MatchResult[] = uniqueRows.map((row) => {
        const product = productMap.get(row.itemCode.toUpperCase());

        if (!product) {
          return { ...row, productId: null, currentCustomer: null, currentCsr: null, status: "no_match" as const };
        }

        // Normalize CSR names: replace "/" with ", "
        const normalizedCsr = row.dpSalesCsr.replace(/\s*\/\s*/g, ", ");

        const customerChanged = row.customer && row.customer !== product.customer;
        const csrChanged = normalizedCsr && normalizedCsr !== product.dp_sales_csr_names;

        return {
          ...row,
          dpSalesCsr: normalizedCsr,
          productId: product.id,
          currentCustomer: product.customer,
          currentCsr: product.dp_sales_csr_names,
          status: (customerChanged || csrChanged) ? "will_update" as const : "already_set" as const,
        };
      });

      setMatches(matchResults);
    } catch (err) {
      console.error("Parse error:", err);
    } finally {
      setParsing(false);
    }
  };

  const handleUpdate = async () => {
    const toUpdate = matches.filter((m) => m.status === "will_update" && m.productId);
    if (toUpdate.length === 0) return;

    setUpdating(true);
    let updated = 0;
    let errors = 0;

    for (const match of toUpdate) {
      const updateData: Record<string, string | null> = {};
      if (match.customer) updateData.customer = match.customer;
      if (match.dpSalesCsr) updateData.dp_sales_csr_names = match.dpSalesCsr;

      const { error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", match.productId!);

      if (error) {
        console.error(`Error updating ${match.itemCode}:`, error);
        errors++;
      } else {
        updated++;
      }
    }

    setUpdateResults({ updated, errors });
    setDone(true);
    setUpdating(false);
  };

  const willUpdate = matches.filter((m) => m.status === "will_update");
  const noMatch = matches.filter((m) => m.status === "no_match");
  const alreadySet = matches.filter((m) => m.status === "already_set");

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">POTR Import — One-time Update</h1>
          <p className="text-muted-foreground mt-1">
            Importing Customer and DP Sales/CSR from the POTR Excel into the Products database.
          </p>
        </div>

        {parsing && (
          <div className="flex items-center gap-3 py-12 justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Parsing Excel and matching products...</span>
          </div>
        )}

        {!parsing && (
          <>
            {/* Column detection info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h3 className="font-semibold text-sm">Detected Sheets & Columns</h3>
              {Object.entries(columns).map(([sheet, cols]) => (
                <div key={sheet} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{sheet}:</span> {cols.join(", ")}
                </div>
              ))}
            </div>

            {/* Raw data preview for debugging */}
            {Object.entries(rawPreview).map(([sheet, info]) => (
              <details key={sheet} className="rounded-lg border bg-muted/30 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Raw data: {sheet} (header row {info.headerRow})</summary>
                <div className="overflow-x-auto mt-2">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="border px-2 py-1 bg-muted">Row</th>
                        {info.headers.map((h, i) => (
                          <th key={i} className="border px-2 py-1 bg-muted">{i}: {h || "(empty)"}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {info.rows.slice(1).map((row, ri) => (
                        <tr key={ri}>
                          <td className="border px-2 py-1 font-mono">{info.headerRow + 1 + ri}</td>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border px-2 py-1 max-w-[150px] truncate">{cell || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}


            {/* Summary */}
            <div className="flex gap-4 flex-wrap">
              <Badge variant="default" className="text-sm px-3 py-1">
                {willUpdate.length} to update
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {alreadySet.length} already correct
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {noMatch.length} no match in DB
              </Badge>
            </div>

            {/* Preview table */}
            {willUpdate.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/50 font-semibold text-sm">
                  Products to Update ({willUpdate.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="px-4 py-2 text-left">Item Code</th>
                        <th className="px-4 py-2 text-left">New Customer</th>
                        <th className="px-4 py-2 text-left">Current Customer</th>
                        <th className="px-4 py-2 text-left">New DP Sales/CSR</th>
                        <th className="px-4 py-2 text-left">Current DP Sales/CSR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {willUpdate.map((m) => (
                        <tr key={m.itemCode} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{m.itemCode}</td>
                          <td className="px-4 py-2">
                            {m.customer && m.customer !== m.currentCustomer ? (
                              <span className="text-green-600 font-medium">{m.customer}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{m.currentCustomer || "—"}</td>
                          <td className="px-4 py-2">
                            {m.dpSalesCsr && m.dpSalesCsr !== m.currentCsr ? (
                              <span className="text-green-600 font-medium">{m.dpSalesCsr}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{m.currentCsr || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No match table */}
            {noMatch.length > 0 && (
              <details className="rounded-xl border bg-card overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                  {noMatch.length} items without matching product in DB (click to expand)
                </summary>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="px-4 py-2 text-left">Item Code</th>
                        <th className="px-4 py-2 text-left">Customer</th>
                        <th className="px-4 py-2 text-left">DP Sales/CSR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {noMatch.map((m) => (
                        <tr key={m.itemCode} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{m.itemCode}</td>
                          <td className="px-4 py-2">{m.customer || "—"}</td>
                          <td className="px-4 py-2">{m.dpSalesCsr || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {/* Action */}
            {!done ? (
              <div className="flex gap-3">
                <Button
                  onClick={handleUpdate}
                  disabled={updating || willUpdate.length === 0}
                  className="gap-2"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {updating ? "Updating..." : `Update ${willUpdate.length} products`}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Update complete: {updateResults.updated} products updated.
                  </p>
                  {updateResults.errors > 0 && (
                    <p className="text-sm text-red-600">{updateResults.errors} errors.</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    You can now go back to Products. This page can be removed.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

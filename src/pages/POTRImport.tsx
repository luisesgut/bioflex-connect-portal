import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
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

// Map short first names from POTR to full names from profiles
function resolveFullNames(
  shortNames: string,
  profilesByFirstName: Map<string, string>
): string {
  const parts = shortNames.split(/\s*\/\s*/);
  const resolved = parts
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => profilesByFirstName.get(n.toLowerCase()) || n);
  return resolved.join(", ");
}

// Map Excel customer names to dropdown option labels
function resolveCustomer(
  raw: string,
  customerLabels: Set<string>
): string {
  const trimmed = raw.trim();
  // Direct match
  if (customerLabels.has(trimmed)) return trimmed;
  // Case-insensitive match
  for (const label of customerLabels) {
    if (label.toLowerCase() === trimmed.toLowerCase()) return label;
  }
  // Partial match (e.g., "Church" → "Church Brothers")
  for (const label of customerLabels) {
    if (label.toLowerCase().startsWith(trimmed.toLowerCase())) return label;
  }
  return trimmed;
}

export default function POTRImport() {
  const [parsing, setParsing] = useState(true);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [updating, setUpdating] = useState(false);
  const [done, setDone] = useState(false);
  const [updateResults, setUpdateResults] = useState({ updated: 0, errors: 0 });

  useEffect(() => {
    parseAndMatch();
  }, []);

  const parseAndMatch = async () => {
    setParsing(true);
    try {
      const response = await fetch("/temp-potr.xlsx");
      const buffer = await response.arrayBuffer();
      const wb = XLSX.read(buffer);

      // Fetch profiles to build first-name → full-name map
      const { data: profiles } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_type", "external");

      const profilesByFirstName = new Map<string, string>();
      for (const p of profiles || []) {
        if (p.full_name) {
          const firstName = p.full_name.split(" ")[0].toLowerCase();
          profilesByFirstName.set(firstName, p.full_name);
        }
      }

      // Fetch customer dropdown options
      const { data: dropdownOpts } = await supabase
        .from("dropdown_options")
        .select("label")
        .eq("category", "final_customer")
        .eq("is_active", true);

      const customerLabels = new Set((dropdownOpts || []).map((o) => o.label));

      const allRows: POTRRow[] = [];

      // Process sheets with PO data
      const targetSheets = wb.SheetNames.filter((s) => /open|closed|po/i.test(s));
      const sheetsToProcess = targetSheets.length > 0 ? targetSheets : wb.SheetNames;

      for (const sheetName of sheetsToProcess) {
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as string[][];
        if (aoa.length < 3) continue;

        // Find the LAST header row with "Item" — this is the actual column-level header
        // e.g., row with: Priority | Ship | Deliver | DP | Item # | Description | Type | Names | Customer
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(aoa.length, 15); i++) {
          const row = aoa[i];
          const rowStr = row.map((c) => String(c || "").toLowerCase()).join("|");
          if (rowStr.includes("item #") || rowStr.includes("item#")) {
            headerRowIdx = i;
            break;
          }
        }
        // Fallback: look for row with "Priority"
        if (headerRowIdx < 0) {
          for (let i = 0; i < Math.min(aoa.length, 15); i++) {
            const row = aoa[i];
            const rowStr = row.map((c) => String(c || "").toLowerCase()).join("|");
            if (rowStr.includes("priority") && rowStr.includes("customer")) {
              headerRowIdx = i;
              break;
            }
          }
        }
        if (headerRowIdx < 0) continue;

        const headers = aoa[headerRowIdx].map((h) => String(h || "").trim().toLowerCase());

        // Find column indices
        const itemCodeIdx = headers.findIndex((h) => h === "item #" || h === "item#" || h === "item");
        const customerIdx = headers.findIndex((h) => h === "customer");
        const csrIdx = headers.findIndex((h) => h === "names" || /csr|sales.*csr/i.test(h));

        if (itemCodeIdx < 0) continue;

        for (let i = headerRowIdx + 1; i < aoa.length; i++) {
          const row = aoa[i];
          const itemCode = String(row[itemCodeIdx] || "").trim();
          if (!itemCode) continue;
          // Skip section headers and non-data rows
          if (/^(bag|film|wicket|zipper|roll|total)/i.test(itemCode) && !/\d/.test(itemCode)) continue;
          if (/^(item\s*#?|description|names?|type|customer)$/i.test(itemCode)) continue;

          const rawCustomer = customerIdx >= 0 ? String(row[customerIdx] || "").trim() : "";
          const rawCsr = csrIdx >= 0 ? String(row[csrIdx] || "").trim() : "";

          if (!rawCustomer && !rawCsr) continue;

          const customer = rawCustomer ? resolveCustomer(rawCustomer, customerLabels) : "";
          const dpSalesCsr = rawCsr ? resolveFullNames(rawCsr, profilesByFirstName) : "";

          allRows.push({ itemCode, customer, dpSalesCsr });
        }
      }

      // Deduplicate by itemCode
      const byItemCode = new Map<string, POTRRow>();
      for (const row of allRows) {
        const key = row.itemCode.toUpperCase();
        if (!byItemCode.has(key)) {
          byItemCode.set(key, row);
        }
      }

      const uniqueRows = Array.from(byItemCode.values());

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

      const matchResults: MatchResult[] = uniqueRows.map((row) => {
        const product = productMap.get(row.itemCode.toUpperCase());
        if (!product) {
          return { ...row, productId: null, currentCustomer: null, currentCsr: null, status: "no_match" as const };
        }

        const customerChanged = row.customer && row.customer !== product.customer;
        const csrChanged = row.dpSalesCsr && row.dpSalesCsr !== product.dp_sales_csr_names;

        return {
          ...row,
          productId: product.id,
          currentCustomer: product.customer,
          currentCsr: product.dp_sales_csr_names,
          status: customerChanged || csrChanged ? ("will_update" as const) : ("already_set" as const),
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
                              <span className="text-muted-foreground">{m.customer || "—"}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{m.currentCustomer || "—"}</td>
                          <td className="px-4 py-2">
                            {m.dpSalesCsr && m.dpSalesCsr !== m.currentCsr ? (
                              <span className="text-green-600 font-medium">{m.dpSalesCsr}</span>
                            ) : (
                              <span className="text-muted-foreground">{m.dpSalesCsr || "—"}</span>
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

            {noMatch.length > 0 && (
              <details className="rounded-xl border bg-card overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                  {noMatch.length} items without matching product in DB
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

            {!done ? (
              <Button onClick={handleUpdate} disabled={updating || willUpdate.length === 0} className="gap-2">
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {updating ? "Updating..." : `Update ${willUpdate.length} products`}
              </Button>
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
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

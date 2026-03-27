import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, FileDown, Pencil, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateCustomsPDF } from "@/utils/generateCustomsPDF";
import { openStorageFile } from "@/hooks/useOpenStorageFile";

const FREIGHT_COST = 5000;
const FULL_LOAD_PALLETS = 24;

export interface PalletDetail {
  palletIndex: number;
  grossWeight: number;
  netWeight: number;
  pieces: number;
  boxes?: number;
  traceability?: string;
}

export interface CustomsProductSummary {
  description: string;
  destination: string;
  salesOrder: string | null;
  poNumber: string | null;
  releaseNumber: string | null;
  bfxSpecUrl: string | null;
  ptCode: string | null;
  totalPallets: number;
  totalUnits: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  pricePerThousand: number;
  totalPrice: number;
  ce: number;
  ceTruncated: number;
  customsValue: number;
  unit: string;
  palletDetails?: PalletDetail[];
  // Legacy compat fields for PDF
  sapNumber: string | null;
  piecesPerPallet: number;
  palletsPerBox: number;
  totalPiecesPerPallet: number;
  totalBoxesOrRolls: number;
  totalPieces: number;
  pricePerPiece: number;
  customsEquivalent: number;
}

interface CustomsReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadId: string;
  loadNumber: string;
  shippingDate: string;
  existingData: CustomsProductSummary[] | null;
  validationId: string | null;
  userId: string;
  isReadOnly: boolean;
  onSaved: () => void;
}

interface LoadPalletRow {
  id: string;
  destination: string | null;
  quantity: number;
  release_number: string | null;
  is_on_hold: boolean;
  pallet: {
    pt_code: string;
    description: string;
    customer_lot: string | null;
    bfx_order: string | null;
    unit: string;
    gross_weight: number | null;
    net_weight: number | null;
    pieces: number | null;
  };
}

function recalcDerived(p: CustomsProductSummary): CustomsProductSummary {
  p.pricePerPiece = p.pricePerThousand / 1000;
  p.totalPrice = (p.totalUnits / 1000) * p.pricePerThousand;
  p.totalPieces = p.totalUnits;
  if (p.totalNetWeight > 0) {
    p.ce = p.totalPrice / p.totalNetWeight;
    p.ceTruncated = Math.floor(p.ce * 100) / 100;
    p.customsValue = p.ceTruncated * p.totalNetWeight;
    p.customsEquivalent = p.ce;
  } else {
    p.ce = 0;
    p.ceTruncated = 0;
    p.customsValue = 0;
    p.customsEquivalent = 0;
  }
  return p;
}

async function buildFromReleasedPallets(loadId: string): Promise<CustomsProductSummary[]> {
  // Fetch released (non-held) pallets
  const { data: loadPallets, error } = await supabase
    .from("load_pallets")
    .select(`
      id, destination, quantity, release_number, is_on_hold,
      pallet:inventory_pallets(pt_code, description, customer_lot, bfx_order, unit, gross_weight, net_weight, pieces, traceability)
    `)
    .eq("load_id", loadId)
    .eq("is_on_hold", false);

  if (error) throw error;
  const pallets = (loadPallets || []) as unknown as LoadPalletRow[];

  // Collect unique identifiers: customer_lot, bfx_order, and pt_codes
  const poIdentifiers = new Set<string>();
  const ptCodes = new Set<string>();
  pallets.forEach(p => {
    if (p.pallet.customer_lot) poIdentifiers.add(p.pallet.customer_lot);
    if (p.pallet.bfx_order) poIdentifiers.add(p.pallet.bfx_order);
    ptCodes.add(p.pallet.pt_code);
  });

  // Fetch PO info matching by po_number (could be customer_lot or bfx_order)
  const poMap = new Map<string, { sales_order_number: string | null; price_per_thousand: number; po_number: string }>();
  if (poIdentifiers.size > 0) {
    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("po_number, sales_order_number, price_per_thousand")
      .in("po_number", Array.from(poIdentifiers));
    (pos || []).forEach((po: any) => {
      poMap.set(po.po_number, {
        sales_order_number: po.sales_order_number || null,
        price_per_thousand: po.price_per_thousand || 0,
        po_number: po.po_number,
      });
    });
  }

  // Also try matching POs by product pt_code for any pallets without direct match
  if (ptCodes.size > 0) {
    const { data: posByProduct } = await supabase
      .from("purchase_orders")
      .select("po_number, sales_order_number, price_per_thousand, product:products(codigo_producto, pt_code)")
      .in("status", ["pending", "confirmed", "accepted", "in_production"]);
    (posByProduct || []).forEach((po: any) => {
      const ptCode = po.product?.codigo_producto || po.product?.pt_code;
      if (ptCode && ptCodes.has(ptCode) && !poMap.has(ptCode)) {
        // Store by pt_code as fallback key
        poMap.set(`__pt__${ptCode}`, {
          sales_order_number: po.sales_order_number || null,
          price_per_thousand: po.price_per_thousand || 0,
          po_number: po.po_number,
        });
      }
    });
  }

  // Fetch product info (bfx_spec_url, pieces_per_pallet, piezas_por_paquete, paquete_por_caja)
  const productMap = new Map<string, { bfx_spec_url: string | null; pieces_per_pallet: number | null; piezas_por_paquete: number | null; paquete_por_caja: number | null }>();
  if (ptCodes.size > 0) {
    const ptArr = Array.from(ptCodes);
    const { data: products } = await supabase
      .from("products")
      .select("codigo_producto, pt_code, bfx_spec_url, pieces_per_pallet, piezas_por_paquete, paquete_por_caja")
      .or(ptArr.map(c => `codigo_producto.eq.${c},pt_code.eq.${c}`).join(','));
    (products || []).forEach((p: any) => {
      const key = p.codigo_producto || p.pt_code;
      if (key) productMap.set(key, {
        bfx_spec_url: p.bfx_spec_url || null,
        pieces_per_pallet: p.pieces_per_pallet || null,
        piezas_por_paquete: p.piezas_por_paquete || null,
        paquete_por_caja: p.paquete_por_caja || null,
      });
    });
  }

  // Group by description + destination
  const grouped = new Map<string, CustomsProductSummary>();

  pallets.forEach(lp => {
    const dest = lp.destination || "TBD";
    const key = `${lp.pallet.description}__${dest}`;
    // Try customer_lot first, then bfx_order, then pt_code fallback
    const poInfo = (lp.pallet.customer_lot ? poMap.get(lp.pallet.customer_lot) : null)
      || (lp.pallet.bfx_order ? poMap.get(lp.pallet.bfx_order) : null)
      || poMap.get(`__pt__${lp.pallet.pt_code}`) || null;
    const prodInfo = productMap.get(lp.pallet.pt_code);
    const pricePerThousand = poInfo?.price_per_thousand || 0;
    const piecesPerPallet = prodInfo?.pieces_per_pallet || 50000;
    const piecesPerPackage = prodInfo?.piezas_por_paquete || 1000;
    const packagesPerBox = prodInfo?.paquete_por_caja || 50;

    if (!grouped.has(key)) {
      grouped.set(key, {
        description: lp.pallet.description,
        destination: dest,
        salesOrder: poInfo?.sales_order_number || null,
        poNumber: lp.pallet.customer_lot || poInfo?.po_number || null,
        releaseNumber: lp.release_number || null,
        bfxSpecUrl: prodInfo?.bfx_spec_url || null,
        ptCode: lp.pallet.pt_code || null,
        totalPallets: 0,
        totalUnits: 0,
        totalGrossWeight: 0,
        totalNetWeight: 0,
        pricePerThousand,
        totalPrice: 0,
        ce: 0,
        ceTruncated: 0,
        customsValue: 0,
        unit: lp.pallet.unit,
        palletDetails: [],
        // Legacy
        sapNumber: poInfo?.sales_order_number || null,
        piecesPerPallet: piecesPerPackage,
        palletsPerBox: packagesPerBox,
        totalPiecesPerPallet: piecesPerPallet,
        totalBoxesOrRolls: 0,
        totalPieces: 0,
        pricePerPiece: pricePerThousand / 1000,
        customsEquivalent: 0,
      });
    }

    const group = grouped.get(key)!;

    group.totalPallets += 1;
    group.totalUnits += lp.pallet.unit === "MIL" ? lp.quantity * 1000 : lp.quantity;
    group.totalGrossWeight += lp.pallet.gross_weight || 0;
    group.totalNetWeight += lp.pallet.net_weight || 0;

    // Collect pallet detail for PDF breakdown
    group.palletDetails = group.palletDetails || [];
    group.palletDetails.push({
      palletIndex: group.palletDetails.length + 1,
      grossWeight: lp.pallet.gross_weight || 0,
      netWeight: lp.pallet.net_weight || 0,
      pieces: lp.pallet.unit === "MIL" ? lp.quantity * 1000 : lp.quantity,
      boxes: lp.pallet.pieces || 0,
      traceability: (lp.pallet as any).traceability || undefined,
    });

    group.totalBoxesOrRolls += lp.pallet.pieces || 0;

    // Keep first non-null release number
    if (!group.releaseNumber && lp.release_number) {
      group.releaseNumber = lp.release_number;
    }
  });

  // Calculate derived fields
  const results: CustomsProductSummary[] = [];
  grouped.forEach(product => {
    recalcDerived(product);
    results.push(product);
  });

  return results;
}
/**
 * Enrich stored validated_data with fresh traceability codes from load_pallets.
 * Needed because older validated_data may lack the traceability field.
 */
export async function enrichWithTraceability(
  loadId: string,
  products: CustomsProductSummary[]
): Promise<CustomsProductSummary[]> {
  // Check if any palletDetails are missing traceability
  const needsEnrichment = products.some(
    p => p.palletDetails?.some(pd => !pd.traceability)
  );
  if (!needsEnrichment) return products;

  try {
    const { data } = await supabase
      .from("load_pallets")
      .select("pallet:inventory_pallets(pt_code, traceability, gross_weight, net_weight)")
      .eq("load_id", loadId)
      .eq("is_on_hold", false);

    if (!data || data.length === 0) return products;

    // Build a lookup: index pallets in order per pt_code
    const palletsByPtCode: Record<string, string[]> = {};
    (data as any[]).forEach(lp => {
      const ptCode = lp.pallet?.pt_code;
      const trace = lp.pallet?.traceability;
      if (ptCode && trace) {
        if (!palletsByPtCode[ptCode]) palletsByPtCode[ptCode] = [];
        palletsByPtCode[ptCode].push(trace);
      }
    });

    // Merge traceability into palletDetails
    return products.map(p => {
      if (!p.palletDetails) return p;
      const ptTraces = palletsByPtCode[p.ptCode || ""] || [];
      const enrichedDetails = p.palletDetails.map((pd, i) => ({
        ...pd,
        traceability: pd.traceability || ptTraces[i] || undefined,
      }));
      return { ...p, palletDetails: enrichedDetails };
    });
  } catch (err) {
    console.warn("Failed to enrich traceability:", err);
    return products;
  }
}

export function CustomsReviewDialog({
  open,
  onOpenChange,
  loadId,
  loadNumber,
  shippingDate,
  existingData,
  validationId,
  userId,
  isReadOnly,
  onSaved,
}: CustomsReviewDialogProps) {
  const [products, setProducts] = useState<CustomsProductSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [freightCostInput, setFreightCostInput] = useState(String(FREIGHT_COST));
  const [exchangeRateInput, setExchangeRateInput] = useState("17.5");
  const [freightSalesOrder, setFreightSalesOrder] = useState("");

  useEffect(() => {
    if (!open) return;
    setEditingIndex(null);

    if (existingData && existingData.length > 0) {
      // Enrich existing validated data with fresh traceability from DB
      enrichWithTraceability(loadId, existingData).then(enriched => setProducts(enriched));
      return;
    }

    // Build from released pallets
    setLoadingData(true);
    buildFromReleasedPallets(loadId)
      .then(data => setProducts(data))
      .catch(err => {
        console.error("Error building product summaries:", err);
        toast.error("Error loading released pallet data");
      })
      .finally(() => setLoadingData(false));
  }, [open, existingData, loadId]);

  const totalPalletCount = products.reduce((s, p) => s + p.totalPallets, 0);
  const totalProductValue = products.reduce((s, p) => s + p.totalPrice, 0);
  const freightCost = Number(freightCostInput) || 0;
  const freightWithoutIVA = freightCost / 1.16;
  const exchangeRate = Number(exchangeRateInput) || 0;
  const totalGrossWeight = products.reduce((s, p) => s + p.totalGrossWeight, 0);
  const totalNetWeight = products.reduce((s, p) => s + p.totalNetWeight, 0);
  const grandTotalUSD = totalProductValue + freightCost;
  const grandTotalMXN = grandTotalUSD * exchangeRate;

  const updateProduct = (index: number, field: keyof CustomsProductSummary, value: any) => {
    setProducts(prev => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value };
      recalcDerived(p);
      updated[index] = p;
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (validationId) {
        const { error } = await supabase
          .from("load_billing_validations")
          .update({
            validated_data: products as any,
            status: "approved",
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", validationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("load_billing_validations")
          .insert({
            load_id: loadId,
            submitted_by: userId,
            status: "approved",
            validated_data: products as any,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      toast.success("Billing data validated and saved");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving validation:", error);
      toast.error("Error saving validation");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    generateCustomsPDF(
      { loadNumber, shippingDate },
      products,
      totalPalletCount,
      freightCost,
      exchangeRate
    );
    toast.success("PDF downloaded");
  };

  const fmt = (n: number, decimals = 2) =>
    n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Export Document Review — {loadNumber}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Data has been validated. You can download the PDF."
              : "Review and modify fields as needed before approving."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4 -mr-4">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading released pallet data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {products.map((product, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">{product.description}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {product.destination}
                        </Badge>
                        {product.releaseNumber && (
                          <Badge variant="secondary" className="text-xs">
                            Release: {product.releaseNumber}
                          </Badge>
                        )}
                        {product.bfxSpecUrl && (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() => openStorageFile(product.bfxSpecUrl!, 'print-cards')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            BFX Spec
                          </Button>
                        )}
                      </div>
                    </div>
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                      >
                        {editingIndex === idx ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <FieldRow
                      label="Sales Order"
                      value={product.salesOrder || "-"}
                      editing={editingIndex === idx}
                      onChange={v => updateProduct(idx, "salesOrder", v || null)}
                    />
                    <FieldRow
                      label="Customer PO"
                      value={product.poNumber || "-"}
                      editing={editingIndex === idx}
                      onChange={v => updateProduct(idx, "poNumber", v || null)}
                    />
                    <FieldRow
                      label="Total Pallets"
                      value={String(product.totalPallets)}
                      editing={editingIndex === idx}
                      type="number"
                      onChange={v => updateProduct(idx, "totalPallets", Number(v))}
                    />
                    <FieldRow
                      label="Total Units"
                      value={product.totalUnits.toLocaleString()}
                      editing={editingIndex === idx}
                      type="number"
                      onChange={v => updateProduct(idx, "totalUnits", Number(v))}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <FieldRow
                      label="Price / Thousand"
                      value={fmt(product.pricePerThousand)}
                      editing={editingIndex === idx}
                      type="number"
                      onChange={v => updateProduct(idx, "pricePerThousand", Number(v))}
                    />
                    <div>
                      <span className="text-muted-foreground text-xs">Total Amount</span>
                      <p className="font-medium">${fmt(product.totalPrice)}</p>
                    </div>
                    <FieldRow
                      label="Gross Weight"
                      value={fmt(product.totalGrossWeight)}
                      editing={editingIndex === idx}
                      type="number"
                      onChange={v => updateProduct(idx, "totalGrossWeight", Number(v))}
                    />
                    <FieldRow
                      label="Net Weight"
                      value={fmt(product.totalNetWeight)}
                      editing={editingIndex === idx}
                      type="number"
                      onChange={v => updateProduct(idx, "totalNetWeight", Number(v))}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">CE (Amount / Net Weight)</span>
                      <p className="font-medium">{product.ce.toFixed(6)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">CE Truncated (2 decimals)</span>
                      <p className="font-medium">{product.ceTruncated.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Customs Value</span>
                      <p className="font-semibold">${fmt(product.customsValue)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Load Summary */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <h4 className="font-semibold text-sm">Load Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Total Pallets</span>
                    <p className="font-medium">{totalPalletCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Product Value</span>
                    <p className="font-medium">${fmt(totalProductValue)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Freight (USD)</Label>
                    <Input
                      className="h-8 text-sm mt-0.5 w-32"
                      type="number"
                      value={freightCostInput}
                      onChange={e => setFreightCostInput(e.target.value)}
                      disabled={isReadOnly}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sin IVA: ${fmt(freightWithoutIVA)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Grand Total (USD)</span>
                    <p className="font-semibold">${fmt(grandTotalUSD)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Freight SAP Order</Label>
                    <Input
                      className="h-8 text-sm mt-0.5 w-32"
                      type="text"
                      value={freightSalesOrder}
                      onChange={e => setFreightSalesOrder(e.target.value)}
                      placeholder="OV number"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Total Gross Weight</span>
                    <p className="font-medium">{fmt(totalGrossWeight)} kg</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Total Net Weight</span>
                    <p className="font-medium">{fmt(totalNetWeight)} kg</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Exchange Rate (MXN/USD)</Label>
                    <Input
                      className="h-8 text-sm mt-0.5 w-32"
                      type="number"
                      step="0.01"
                      value={exchangeRateInput}
                      onChange={e => setExchangeRateInput(e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Grand Total (MXN)</span>
                    <p className="font-semibold text-primary">${fmt(grandTotalMXN)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existingData && existingData.length > 0 && (
            <Button variant="outline" onClick={handleDownloadPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving || loadingData}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Validate & Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label,
  value,
  editing,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  type?: string;
  onChange: (v: string) => void;
}) {
  if (editing) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          className="h-8 text-sm mt-0.5"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

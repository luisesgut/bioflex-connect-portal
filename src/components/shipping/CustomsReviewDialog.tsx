import { useState, useEffect, useMemo } from "react";
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
import { Loader2, Save, FileDown, Pencil, Check, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateCustomsPDF } from "@/utils/generateCustomsPDF";
import { TruckLayoutPreview, DEST_COLOR_PALETTE } from "./TruckLayoutPreview";
import { useCustomerLocations } from "@/hooks/useCustomerLocations";
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
  existingData: any | null;
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

export async function buildFromReleasedPallets(loadId: string): Promise<CustomsProductSummary[]> {
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
      .select("po_number, sales_order_number, price_per_thousand, product:products(pt_code)")
      .in("status", ["pending", "confirmed", "accepted", "in_production"]);
    (posByProduct || []).forEach((po: any) => {
      const ptCode = po.product?.pt_code;
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

  // Fetch product info (pieces_per_pallet, piezas_por_paquete, paquete_por_caja)
  const productMap = new Map<string, { pieces_per_pallet: number | null; piezas_por_paquete: number | null; paquete_por_caja: number | null }>();
  if (ptCodes.size > 0) {
    const ptArr = Array.from(ptCodes);
    const { data: products } = await supabase
      .from("products")
      .select("pt_code, pieces_per_pallet, piezas_por_paquete, paquete_por_caja")
      .in("pt_code", ptArr);
    (products || []).forEach((p: any) => {
      const key = p.pt_code;
      if (key) productMap.set(key, {
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
        bfxSpecUrl: null,
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
  try {
    const { data } = await supabase
      .from("load_pallets")
      .select("destination, release_number, pallet:inventory_pallets(pt_code, traceability, gross_weight, net_weight)")
      .eq("load_id", loadId)
      .eq("is_on_hold", false);

    if (!data || data.length === 0) return products;

    // Build lookups per pt_code
    const palletsByPtCode: Record<string, { traceability: string; destination: string | null; releaseNumber: string | null }[]> = {};
    (data as any[]).forEach(lp => {
      const ptCode = lp.pallet?.pt_code;
      if (ptCode) {
        if (!palletsByPtCode[ptCode]) palletsByPtCode[ptCode] = [];
        palletsByPtCode[ptCode].push({
          traceability: lp.pallet?.traceability || "",
          destination: lp.destination || null,
          releaseNumber: lp.release_number || null,
        });
      }
    });

    // Merge traceability, destination, and release into products
    return products.map(p => {
      const ptEntries = palletsByPtCode[p.ptCode || ""] || [];
      // Update destination: use first non-null from live data
      const liveDestination = ptEntries.find(e => e.destination)?.destination;
      // Update release: use first non-null from live data
      const liveRelease = ptEntries.find(e => e.releaseNumber)?.releaseNumber;

      const enrichedDetails = p.palletDetails?.map((pd, i) => ({
        ...pd,
        traceability: pd.traceability || ptEntries[i]?.traceability || undefined,
      }));

      return {
        ...p,
        destination: liveDestination || p.destination,
        releaseNumber: liveRelease || p.releaseNumber,
        palletDetails: enrichedDetails || p.palletDetails,
      };
    });
  } catch (err) {
    console.warn("Failed to enrich data:", err);
    return products;
  }
}

function extractUniqueDestinations(prods: CustomsProductSummary[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  prods.forEach(p => {
    if (p.destination && !seen.has(p.destination)) {
      seen.add(p.destination);
      result.push(p.destination);
    }
  });
  return result;
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
  const [destinationOrder, setDestinationOrder] = useState<string[]>([]);
  const { getDestinationLabel } = useCustomerLocations();

  useEffect(() => {
    if (!open) return;
    setEditingIndex(null);

    // Parse existingData: could be array (legacy) or { products, freightCost, exchangeRate, destinationOrder }
    let existingProducts: CustomsProductSummary[] | null = null;
    let savedDestOrder: string[] | null = null;
    if (existingData) {
      if (Array.isArray(existingData)) {
        existingProducts = existingData;
      } else if (existingData.products && Array.isArray(existingData.products)) {
        existingProducts = existingData.products;
        if (existingData.freightCost != null) setFreightCostInput(String(existingData.freightCost));
        if (existingData.exchangeRate != null) setExchangeRateInput(String(existingData.exchangeRate));
        if (Array.isArray(existingData.destinationOrder)) savedDestOrder = existingData.destinationOrder;
      }
    }

    if (existingProducts && existingProducts.length > 0) {
      enrichWithTraceability(loadId, existingProducts).then(enriched => {
        setProducts(enriched);
        if (savedDestOrder && savedDestOrder.length > 0) {
          setDestinationOrder(savedDestOrder);
        } else {
          setDestinationOrder(extractUniqueDestinations(enriched));
        }
      });
      return;
    }

    // Build from released pallets
    setLoadingData(true);
    buildFromReleasedPallets(loadId)
      .then(data => {
        setProducts(data);
        if (savedDestOrder && savedDestOrder.length > 0) {
          setDestinationOrder(savedDestOrder);
        } else {
          setDestinationOrder(extractUniqueDestinations(data));
        }
      })
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

  const palletsByDestination = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      map[p.destination] = (map[p.destination] || 0) + p.totalPallets;
    });
    return map;
  }, [products]);

  const hasMultipleDestinations = destinationOrder.length > 1;

  const moveDestination = (index: number, direction: -1 | 1) => {
    const newOrder = [...destinationOrder];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setDestinationOrder(newOrder);
  };

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
            validated_data: { products, freightCost, exchangeRate, destinationOrder } as any,
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
            validated_data: { products, freightCost, exchangeRate, destinationOrder } as any,
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
              {/* Destination ordering + truck layout */}
              {hasMultipleDestinations && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                  <h4 className="font-semibold text-sm">Orden de Destinos (1° = más cerca de compuertas)</h4>
                  <div className="flex gap-6 flex-wrap">
                    <div className="space-y-1.5">
                      {destinationOrder.map((dest, i) => {
                        const c = DEST_COLOR_PALETTE[i % DEST_COLOR_PALETTE.length];
                        return (
                          <div key={dest} className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-sm shrink-0 ${c.bg}`} />
                            <span className="text-sm font-medium min-w-[100px]">
                              {i + 1}. {getDestinationLabel(dest)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({palletsByDestination[dest] || 0} tarimas)
                            </span>
                            {!isReadOnly && (
                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  disabled={i === 0}
                                  onClick={() => moveDestination(i, -1)}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  disabled={i === destinationOrder.length - 1}
                                  onClick={() => moveDestination(i, 1)}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <TruckLayoutPreview
                      destinationOrder={destinationOrder}
                      palletsByDestination={palletsByDestination}
                      getDestinationLabel={getDestinationLabel}
                    />
                  </div>
                </div>
              )}

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
          {existingData && (Array.isArray(existingData) ? existingData.length > 0 : existingData.products?.length > 0) && (
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

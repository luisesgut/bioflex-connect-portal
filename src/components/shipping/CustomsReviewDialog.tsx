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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, FileDown, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateCustomsPDF } from "@/utils/generateCustomsPDF";

const FREIGHT_COST = 5000;
const FULL_LOAD_PALLETS = 24;

export interface CustomsProductSummary {
  description: string;
  destination: string;
  pallets: { palletNumber: number | string; grossWeight: number; netWeight: number }[];
  totalPallets: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  sapNumber: string | null;
  poNumber: string | null;
  piecesPerPallet: number;
  palletsPerBox: number;
  totalPiecesPerPallet: number;
  totalBoxesOrRolls: number;
  totalPieces: number;
  pricePerPiece: number;
  pricePerThousand: number;
  totalPrice: number;
  customsEquivalent: number;
  customsValue: number;
  unit: string;
}

interface PalletData {
  pt_code: string;
  description: string;
  destination: string | null;
  quantity: number;
  gross_weight: number | null;
  net_weight: number | null;
  pieces: number | null;
  unit: string;
  customer_lot: string | null;
  bfx_order: string | null;
}

interface OrderInfo {
  customer_lot: string;
  sales_order_number: string | null;
  price_per_thousand: number | null;
  pieces_per_pallet: number | null;
  piezas_por_paquete: number | null;
}

interface CustomsReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadId: string;
  loadNumber: string;
  shippingDate: string;
  pallets: PalletData[];
  orderInfo: Map<string, OrderInfo>;
  existingData: CustomsProductSummary[] | null;
  validationId: string | null;
  userId: string;
  isReadOnly: boolean;
  onSaved: () => void;
}

function buildProductSummaries(
  pallets: PalletData[],
  orderInfo: Map<string, OrderInfo>
): CustomsProductSummary[] {
  const grouped = new Map<string, CustomsProductSummary>();

  pallets.forEach((pallet) => {
    const key = `${pallet.description}__${pallet.destination || "tbd"}`;
    const order = pallet.customer_lot ? orderInfo.get(pallet.customer_lot) : null;

    if (!grouped.has(key)) {
      const pricePerThousand = order?.price_per_thousand || 0;
      const piecesPerPallet = order?.pieces_per_pallet || 50000;
      const piecesPerPackage = order?.piezas_por_paquete || 1000;

      grouped.set(key, {
        description: pallet.description,
        destination: pallet.destination || "TBD",
        pallets: [],
        totalPallets: 0,
        totalGrossWeight: 0,
        totalNetWeight: 0,
        sapNumber: order?.sales_order_number || null,
        poNumber: pallet.customer_lot,
        piecesPerPallet: piecesPerPackage,
        palletsPerBox: Math.floor(piecesPerPallet / piecesPerPackage) || 50,
        totalPiecesPerPallet: piecesPerPallet,
        totalBoxesOrRolls: 0,
        totalPieces: 0,
        pricePerPiece: pricePerThousand / 1000,
        pricePerThousand,
        totalPrice: 0,
        customsEquivalent: 0,
        customsValue: 0,
        unit: pallet.unit,
      });
    }

    const group = grouped.get(key)!;
    const isPartialPallet = (pallet.pieces || 0) < 50;
    const palletNumber = isPartialPallet
      ? `${pallet.pieces || 0} ${pallet.unit === "bags" ? "bxs" : "rolls"}`
      : group.pallets.length + 1;

    group.pallets.push({
      palletNumber,
      grossWeight: pallet.gross_weight || 0,
      netWeight: pallet.net_weight || 0,
    });

    group.totalPallets = group.pallets.filter((p) => typeof p.palletNumber === "number").length;
    group.totalGrossWeight += pallet.gross_weight || 0;
    group.totalNetWeight += pallet.net_weight || 0;
    group.totalPieces += pallet.quantity;

    if (!isPartialPallet) {
      group.totalBoxesOrRolls += group.palletsPerBox;
    } else {
      group.totalBoxesOrRolls += pallet.pieces || 0;
    }
  });

  // Calculate totals
  grouped.forEach((product) => {
    product.totalPrice = (product.totalPieces / 1000) * product.pricePerThousand;
    if (product.totalNetWeight > 0) {
      product.customsEquivalent = product.totalPrice / product.totalNetWeight;
      product.customsValue =
        (Math.floor(product.customsEquivalent * 100) / 100) * product.totalNetWeight;
    }
  });

  return Array.from(grouped.values());
}

export function CustomsReviewDialog({
  open,
  onOpenChange,
  loadId,
  loadNumber,
  shippingDate,
  pallets,
  orderInfo,
  existingData,
  validationId,
  userId,
  isReadOnly,
  onSaved,
}: CustomsReviewDialogProps) {
  const [products, setProducts] = useState<CustomsProductSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      if (existingData && existingData.length > 0) {
        setProducts(existingData);
      } else {
        setProducts(buildProductSummaries(pallets, orderInfo));
      }
      setEditingIndex(null);
    }
  }, [open, existingData, pallets, orderInfo]);

  const totalPalletCount = pallets.length;
  const totalProductValue = products.reduce((s, p) => s + p.totalPrice, 0);
  const freightCost =
    totalPalletCount < FULL_LOAD_PALLETS
      ? (totalPalletCount / FULL_LOAD_PALLETS) * FREIGHT_COST
      : 0;
  const totalGrossWeight = products.reduce((s, p) => s + p.totalGrossWeight, 0);
  const totalNetWeight = products.reduce((s, p) => s + p.totalNetWeight, 0);

  const updateProduct = (index: number, field: keyof CustomsProductSummary, value: any) => {
    setProducts((prev) => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value };

      // Recalculate derived fields
      p.pricePerPiece = p.pricePerThousand / 1000;
      p.totalPrice = (p.totalPieces / 1000) * p.pricePerThousand;
      if (p.totalNetWeight > 0) {
        p.customsEquivalent = p.totalPrice / p.totalNetWeight;
        p.customsValue =
          (Math.floor(p.customsEquivalent * 100) / 100) * p.totalNetWeight;
      }
      updated[index] = p;
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (validationId) {
        // Update existing validation
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
        // Create new validation with data
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
      toast.success("Datos de facturación validados y guardados");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving validation:", error);
      toast.error("Error al guardar la validación");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    generateCustomsPDF(
      { loadNumber, shippingDate },
      products,
      totalPalletCount,
      freightCost
    );
    toast.success("PDF descargado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Revisión de Documento de Exportación — {loadNumber}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Los datos han sido validados. Puedes descargar el PDF."
              : "Revisa y modifica los campos necesarios antes de aprobar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4 -mr-4">
          <div className="space-y-6">
            {products.map((product, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{product.description}</h4>
                    <Badge variant="outline" className="text-xs mt-1">
                      {product.destination}
                    </Badge>
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

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <FieldRow
                    label="SAP"
                    value={product.sapNumber || "-"}
                    editing={editingIndex === idx}
                    onChange={(v) => updateProduct(idx, "sapNumber", v || null)}
                  />
                  <FieldRow
                    label="PO"
                    value={product.poNumber || "-"}
                    editing={editingIndex === idx}
                    onChange={(v) => updateProduct(idx, "poNumber", v || null)}
                  />
                  <FieldRow
                    label="Tarimas"
                    value={String(product.totalPallets)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "totalPallets", Number(v))}
                  />
                  <FieldRow
                    label="Pzas x caja"
                    value={String(product.piecesPerPallet)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "piecesPerPallet", Number(v))}
                  />
                  <FieldRow
                    label="Cajas x tarima"
                    value={String(product.palletsPerBox)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "palletsPerBox", Number(v))}
                  />
                  <FieldRow
                    label="Total pzas x tarima"
                    value={String(product.totalPiecesPerPallet)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "totalPiecesPerPallet", Number(v))}
                  />
                  <FieldRow
                    label={product.unit === "bags" ? "Total cajas" : "Total rollos"}
                    value={String(product.totalBoxesOrRolls)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "totalBoxesOrRolls", Number(v))}
                  />
                  <FieldRow
                    label="Total piezas"
                    value={product.totalPieces.toLocaleString()}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "totalPieces", Number(v))}
                  />
                  <FieldRow
                    label="Precio x millar"
                    value={product.pricePerThousand.toFixed(2)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "pricePerThousand", Number(v))}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <FieldRow
                    label="Peso Bruto"
                    value={product.totalGrossWeight.toFixed(2)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "totalGrossWeight", Number(v))}
                  />
                  <FieldRow
                    label="Peso Neto"
                    value={product.totalNetWeight.toFixed(2)}
                    editing={editingIndex === idx}
                    type="number"
                    onChange={(v) => updateProduct(idx, "totalNetWeight", Number(v))}
                  />
                  <div>
                    <span className="text-muted-foreground text-xs">Total $</span>
                    <p className="font-medium">
                      ${product.totalPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Valor Aduana</span>
                    <p className="font-medium">
                      ${product.customsValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <h4 className="font-semibold text-sm">Resumen General</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Total Tarimas</span>
                  <p className="font-medium">{totalPalletCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">$ Producto</span>
                  <p className="font-medium">
                    ${totalProductValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Flete</span>
                  <p className="font-medium">
                    ${freightCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Total</span>
                  <p className="font-semibold">
                    ${(totalProductValue + freightCost).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Peso Bruto Total</span>
                  <p className="font-medium">{totalGrossWeight.toFixed(2)} kg</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Peso Neto Total</span>
                  <p className="font-medium">{totalNetWeight.toFixed(2)} kg</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {existingData && existingData.length > 0 && (
            <Button variant="outline" onClick={handleDownloadPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Validar y Guardar
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
          onChange={(e) => onChange(e.target.value)}
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

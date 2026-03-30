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
import { Loader2, Ghost } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseLocalizedNumber } from "@/lib/utils";

interface EditVirtualPalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  pallet: {
    id: string;
    pt_code: string;
    description: string;
    stock: number;
    unit: string;
    traceability: string;
    net_weight: number | null;
    gross_weight: number | null;
    bfx_order: string | null;
    pieces: number | null;
    location: string | null;
  } | null;
}

export function EditVirtualPalletDialog({
  open,
  onOpenChange,
  onUpdated,
  pallet,
}: EditVirtualPalletDialogProps) {
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [traceability, setTraceability] = useState("");
  const [boxes, setBoxes] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pallet && open) {
      setStock(String(pallet.stock));
      setUnit(pallet.unit || "PIEZAS");
      setNetWeight(pallet.net_weight != null ? String(pallet.net_weight) : "");
      setGrossWeight(pallet.gross_weight != null ? String(pallet.gross_weight) : "");
      setTraceability(pallet.traceability || "");
      setBoxes(pallet.pieces != null ? String(pallet.pieces) : "");
      setLocation(pallet.location || "");
    }
  }, [pallet, open]);

  const handleSave = async () => {
    if (!pallet) return;

    const parsedStock = parseLocalizedNumber(stock);
    const parsedNet = parseLocalizedNumber(netWeight);
    const parsedGross = parseLocalizedNumber(grossWeight);
    const parsedBoxes = boxes.trim() ? parseInt(boxes, 10) : null;

    if (!stock.trim() || parsedStock <= 0) {
      toast.error("Ingresa un stock válido");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("inventory_pallets")
        .update({
          stock: parsedStock,
          unit,
          net_weight: parsedNet > 0 ? parsedNet : null,
          gross_weight: parsedGross > 0 ? parsedGross : null,
          traceability: traceability.trim() || pallet.traceability,
          pieces: parsedBoxes && parsedBoxes > 0 ? parsedBoxes : null,
          location: location.trim() || null,
        })
        .eq("id", pallet.id);

      if (error) throw error;

      toast.success("Tarima virtual actualizada");
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      console.error("Error updating virtual pallet:", error);
      toast.error("Error al actualizar tarima virtual");
    } finally {
      setSaving(false);
    }
  };

  if (!pallet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-accent" />
            Editar Tarima Virtual
          </DialogTitle>
          <DialogDescription>
            {pallet.pt_code} · {pallet.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stock & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stock">Stock (piezas) *</Label>
              <Input
                id="edit-stock"
                type="text"
                inputMode="decimal"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unidad</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          {/* Traceability */}
          <div className="space-y-2">
            <Label htmlFor="edit-traceability">Trazabilidad</Label>
            <Input
              id="edit-traceability"
              value={traceability}
              onChange={(e) => setTraceability(e.target.value)}
            />
          </div>

          {/* Weights */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-gross-weight">Peso Bruto (kg)</Label>
              <Input
                id="edit-gross-weight"
                type="text"
                inputMode="decimal"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-net-weight">Peso Neto (kg)</Label>
              <Input
                id="edit-net-weight"
                type="text"
                inputMode="decimal"
                value={netWeight}
                onChange={(e) => setNetWeight(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

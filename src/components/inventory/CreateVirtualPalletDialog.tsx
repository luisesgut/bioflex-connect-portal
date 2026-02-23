import { useState } from "react";
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

interface CreateVirtualPalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateVirtualPalletDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateVirtualPalletDialogProps) {
  const [ptCode, setPtCode] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("MIL");
  const [traceability, setTraceability] = useState("");
  const [bfxOrder, setBfxOrder] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setPtCode("");
    setDescription("");
    setStock("");
    setUnit("MIL");
    setTraceability("");
    setBfxOrder("");
  };

  const handleCreate = async () => {
    if (!ptCode.trim() || !description.trim() || !stock || !traceability.trim()) {
      toast.error("PT Code, descripción, stock y trazabilidad son requeridos");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("inventory_pallets").insert({
        pt_code: ptCode.trim(),
        description: description.trim(),
        stock: parseFloat(stock),
        unit,
        traceability: `VIRTUAL-${traceability.trim()}`,
        bfx_order: bfxOrder.trim() || null,
        fecha: new Date().toISOString().split("T")[0],
        status: "available",
        is_virtual: true,
      });

      if (error) throw error;

      toast.success("Tarima virtual creada exitosamente");
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error("Error creating virtual pallet:", error);
      toast.error("Error al crear tarima virtual");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-500" />
            Crear Tarima Virtual
          </DialogTitle>
          <DialogDescription>
            Crea una tarima virtual para productos en WIP que aún no están en inventario.
            Deberá ligarse a una tarima real antes de pasar a In Transit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vp-pt-code">PT Code *</Label>
              <Input
                id="vp-pt-code"
                placeholder="e.g. PT-12345"
                value={ptCode}
                onChange={(e) => setPtCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vp-stock">Stock *</Label>
              <Input
                id="vp-stock"
                type="number"
                placeholder="e.g. 1000"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vp-description">Descripción *</Label>
            <Input
              id="vp-description"
              placeholder="Descripción del producto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vp-traceability">Trazabilidad *</Label>
              <Input
                id="vp-traceability"
                placeholder="Lote esperado"
                value={traceability}
                onChange={(e) => setTraceability(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vp-unit">Unidad</Label>
              <Input
                id="vp-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vp-bfx-order">Sales Order</Label>
            <Input
              id="vp-bfx-order"
              placeholder="Opcional"
              value={bfxOrder}
              onChange={(e) => setBfxOrder(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Virtual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

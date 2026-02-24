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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Ghost, ChevronsUpDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateVirtualPalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ActivePO {
  id: string;
  po_number: string;
  sales_order_number: string | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    pt_code: string | null;
    codigo_producto: string | null;
    pieces_per_pallet: number | null;
    item_description: string | null;
  } | null;
}

export function CreateVirtualPalletDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateVirtualPalletDialogProps) {
  const [activePOs, setActivePOs] = useState<ActivePO[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("MIL");
  const [traceability, setTraceability] = useState("");
   const [netWeight, setNetWeight] = useState("");
   const [saving, setSaving] = useState(false);

  const selectedPO = useMemo(
    () => activePOs.find((po) => po.id === selectedPOId) || null,
    [activePOs, selectedPOId]
  );

  const ptCode = selectedPO?.product
    ? selectedPO.product.codigo_producto || selectedPO.product.pt_code || ""
    : "";

  const description = selectedPO?.product
    ? selectedPO.product.item_description || selectedPO.product.name || ""
    : "";

  useEffect(() => {
    if (open) {
      fetchActivePOs();
      resetForm();
    }
  }, [open]);

  // Pre-fill stock when PO is selected
  useEffect(() => {
    if (selectedPO?.product?.pieces_per_pallet) {
      setStock(String(selectedPO.product.pieces_per_pallet));
    } else {
      setStock("");
    }
  }, [selectedPO]);

  const fetchActivePOs = async () => {
    setLoadingPOs(true);
    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "id, po_number, sales_order_number, quantity, product:products(id, name, pt_code, codigo_producto, pieces_per_pallet, item_description)"
        )
        .eq("status", "accepted")
        .order("po_number");

      if (error) throw error;
      setActivePOs((data as unknown as ActivePO[]) || []);
    } catch (err) {
      console.error("Error fetching active POs:", err);
    } finally {
      setLoadingPOs(false);
    }
  };

  const resetForm = () => {
    setSelectedPOId("");
    setStock("");
    setUnit("MIL");
    setTraceability("");
    setNetWeight("");
  };

  const handleCreate = async () => {
    if (!selectedPOId || !ptCode || !description || !stock || !traceability.trim()) {
      toast.error("Selecciona una PO, stock y trazabilidad son requeridos");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("inventory_pallets").insert({
        pt_code: ptCode,
        description,
        stock: parseFloat(stock),
        unit,
        traceability: `VIRTUAL-${traceability.trim()}`,
        bfx_order: selectedPO?.sales_order_number || selectedPO?.po_number || null,
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

  const getPOLabel = (po: ActivePO) => {
    const product = po.product;
    const code = product?.codigo_producto || product?.pt_code || "—";
    const name = product?.name || "";
    return `PO ${po.po_number} · ${code} · ${name}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-500" />
            Crear Tarima Virtual
          </DialogTitle>
          <DialogDescription>
            Selecciona una PO activa para crear una tarima virtual. Deberá
            ligarse a una tarima real antes de pasar a In Transit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* PO Selector */}
          <div className="space-y-2">
            <Label>Purchase Order *</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedPO ? (
                    <span className="truncate">{getPOLabel(selectedPO)}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {loadingPOs ? "Cargando POs..." : "Buscar PO activa..."}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por PO, PT Code o producto..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron POs activas.</CommandEmpty>
                    <CommandGroup>
                      {activePOs.map((po) => (
                        <CommandItem
                          key={po.id}
                          value={getPOLabel(po)}
                          onSelect={() => {
                            setSelectedPOId(po.id);
                            setPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPOId === po.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              PO {po.po_number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {po.product?.codigo_producto ||
                                po.product?.pt_code ||
                                "—"}{" "}
                              · {po.product?.name || "Sin producto"}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Auto-filled PT Code & Description */}
          {selectedPO && (
            <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">PT Code</p>
                <p className="text-sm font-medium">{ptCode || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Producto</p>
                <p className="text-sm font-medium truncate">{description || "—"}</p>
              </div>
            </div>
          )}

          {/* Stock & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vp-stock">Stock (piezas) *</Label>
              <Input
                id="vp-stock"
                type="number"
                placeholder="e.g. 1000"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
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

          {/* Traceability */}
          <div className="space-y-2">
            <Label htmlFor="vp-traceability">Trazabilidad *</Label>
            <Input
              id="vp-traceability"
              placeholder="Lote esperado"
              value={traceability}
              onChange={(e) => setTraceability(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !selectedPOId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Virtual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

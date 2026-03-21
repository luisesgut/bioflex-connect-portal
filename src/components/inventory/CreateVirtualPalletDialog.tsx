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
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { cn, parseLocalizedNumber } from "@/lib/utils";

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
  sap_pt_code?: string | null;
  sap_product_name?: string | null;
  sap_item_description?: string | null;
}

interface CatOrdenOpenItem {
  u_PO2?: string | null;
  clave?: string | number | null;
  producto?: string | number | null;
  frgnName?: string | number | null;
}

const CAT_ORDEN_OPEN_WITH_ORDEN_ENDPOINT = "http://172.16.10.31/api/CatOrden/open-with-orden";
const DEFAULT_UNIT = "PIEZAS";
const DEFAULT_NET_WEIGHT = "700";

const toCleanString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizePoKey = (value: string | null | undefined) => {
  const cleaned = (value || "").trim().toUpperCase();
  if (!cleaned) return "";
  const compact = cleaned.replace(/\s+/g, "");
  return /^\d+$/.test(compact) ? String(Number(compact)) : compact;
};

const getPOCode = (po: ActivePO) =>
  po.sap_pt_code || po.product?.pt_code || po.product?.codigo_producto || "";

const getPODescription = (po: ActivePO) =>
  po.sap_item_description || po.product?.item_description || po.product?.name || po.sap_product_name || "";

const getPOName = (po: ActivePO) =>
  po.sap_product_name || po.product?.name || po.sap_item_description || "";

const getPOLabel = (po: ActivePO) => {
  const code = getPOCode(po) || "—";
  const name = getPOName(po);
  return `PO ${po.po_number} · ${code} · ${name}`;
};

export function CreateVirtualPalletDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateVirtualPalletDialogProps) {
  const [activePOs, setActivePOs] = useState<ActivePO[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [poSearch, setPOSearch] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [traceability, setTraceability] = useState("");
  const [netWeight, setNetWeight] = useState(DEFAULT_NET_WEIGHT);
  const [saving, setSaving] = useState(false);

  const selectedPO = useMemo(
    () => activePOs.find((po) => po.id === selectedPOId) || null,
    [activePOs, selectedPOId]
  );

  const filteredPOs = useMemo(() => {
    if (!poSearch.trim()) return activePOs;
    const q = poSearch.toLowerCase();
    return activePOs.filter((po) => {
      const label = getPOLabel(po).toLowerCase();
      return label.includes(q);
    });
  }, [activePOs, poSearch]);

  const ptCode = selectedPO ? getPOCode(selectedPO) : "";

  const description = selectedPO ? getPODescription(selectedPO) : "";

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
      const [poResult, sapItems] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(
            "id, po_number, sales_order_number, quantity, product:products(id, name, pt_code, codigo_producto, pieces_per_pallet, item_description)"
          )
          .eq("status", "accepted")
          .order("po_number"),
        fetch(CAT_ORDEN_OPEN_WITH_ORDEN_ENDPOINT, {
          method: "GET",
          headers: { accept: "*/*" },
        })
          .then(async (response) => {
            if (!response.ok) return [] as CatOrdenOpenItem[];
            const payload = await response.json();
            return Array.isArray(payload) ? (payload as CatOrdenOpenItem[]) : [];
          })
          .catch((error) => {
            console.warn("Error fetching SAP PO data for virtual pallets:", error);
            return [] as CatOrdenOpenItem[];
          }),
      ]);

      if (poResult.error) throw poResult.error;

      const sapByPo = sapItems.reduce<Record<string, Pick<ActivePO, "sap_pt_code" | "sap_product_name" | "sap_item_description">>>((acc, item) => {
        const key = normalizePoKey(item.u_PO2);
        if (!key || acc[key]) return acc;

        acc[key] = {
          sap_pt_code: toCleanString(item.clave) || null,
          sap_product_name: toCleanString(item.producto) || toCleanString(item.frgnName) || null,
          sap_item_description: toCleanString(item.frgnName) || toCleanString(item.producto) || null,
        };

        return acc;
      }, {});

      const mergedPOs = ((poResult.data as unknown as ActivePO[]) || []).map((po) => ({
        ...po,
        ...sapByPo[normalizePoKey(po.po_number)],
      }));

      setActivePOs(mergedPOs);
    } catch (err) {
      console.error("Error fetching active POs:", err);
    } finally {
      setLoadingPOs(false);
    }
  };

  const resetForm = () => {
    setSelectedPOId("");
    setStock("");
    setUnit(DEFAULT_UNIT);
    setTraceability("");
    setNetWeight(DEFAULT_NET_WEIGHT);
    setPOSearch("");
    setPopoverOpen(false);
  };

  const handleCreate = async () => {
    if (!selectedPOId) {
      toast.error("Selecciona una PO");
      return;
    }

    const parsedStock = parseLocalizedNumber(stock);
    const parsedNetWeight = parseLocalizedNumber(netWeight);

    if (!stock.trim() || parsedStock <= 0) {
      toast.error("Ingresa el stock de la tarima virtual en piezas");
      return;
    }

    if (!description) {
      toast.error("La PO seleccionada no tiene descripción de producto");
      return;
    }

    if (!ptCode) {
      toast.error("La PO seleccionada no tiene PT Code o código de producto");
      return;
    }

    setSaving(true);
    try {
      const baseTraceability = traceability.trim()
        ? `VIRTUAL-${traceability.trim()}`
        : `VIRTUAL-${selectedPO?.po_number || "N/A"}`;

      const buildPayload = (
        traceabilityValue: string,
      ): Database["public"]["Tables"]["inventory_pallets"]["Insert"] => ({
        pt_code: ptCode,
        description,
        stock: parsedStock,
        unit,
        traceability: traceabilityValue,
        bfx_order: selectedPO?.sales_order_number || selectedPO?.po_number || null,
        fecha: new Date().toISOString().split("T")[0],
        status: "available",
        is_virtual: true,
        net_weight: parsedNetWeight > 0 ? parsedNetWeight : null,
      });

      let { error } = await supabase
        .from("inventory_pallets")
        .insert(buildPayload(`${baseTraceability}-${Date.now()}`));

      if (error?.message?.includes("inventory_pallets_traceability_unique")) {
        const fallbackTraceability = `${baseTraceability}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        ({ error } = await supabase
          .from("inventory_pallets")
          .insert(buildPayload(fallbackTraceability)));
      }

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
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-accent" />
            Crear Tarima Virtual
          </DialogTitle>
          <DialogDescription>
            Selecciona una PO activa para crear una tarima virtual. Deberá
            ligarse a una tarima real antes de pasar a In Transit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-x-hidden">
          {/* PO Selector */}
          <div className="space-y-2 min-w-0">
            <Label>Purchase Order *</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full min-w-0 justify-between gap-2 overflow-hidden font-normal h-auto min-h-10 py-2"
                >
                  {selectedPO ? (
                    <span className="min-w-0 flex-1 truncate text-left">{getPOLabel(selectedPO)}</span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
                      {loadingPOs ? "Cargando POs..." : "Buscar PO activa..."}
                    </span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar por PO, PT Code o producto..."
                    value={poSearch}
                    onValueChange={setPOSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No se encontraron POs activas.</CommandEmpty>
                    <CommandGroup>
                      {filteredPOs.map((po) => (
                        <CommandItem
                          key={po.id}
                          value={po.id}
                          className="items-start gap-2"
                          onSelect={() => {
                            setSelectedPOId(po.id);
                            setPopoverOpen(false);
                            setPOSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              selectedPOId === po.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              PO {po.po_number}
                            </span>
                            <span className="block break-words text-xs text-muted-foreground">
                              {getPOCode(po) || "—"} · {getPOName(po) || "Sin producto"}
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

          {/* Auto-filled PT Code, Description & Pieces per Pallet */}
          {selectedPO && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border p-3 bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">PT Code</p>
                <p className="text-sm font-medium">{ptCode || "—"}</p>
              </div>
              <div className="sm:col-span-1">
                <p className="text-xs text-muted-foreground">Producto</p>
                <p className="text-sm font-medium break-words">{description || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pzas / Tarima</p>
                <p className="text-sm font-medium">{selectedPO.product?.pieces_per_pallet?.toLocaleString() || "—"}</p>
              </div>
            </div>
          )}

          {/* Stock & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vp-stock">Stock (piezas) *</Label>
              <Input
                id="vp-stock"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 45000"
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

          {/* Traceability & Net Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vp-traceability">Trazabilidad</Label>
              <Input
                id="vp-traceability"
                placeholder="Lote esperado (opcional)"
                value={traceability}
                onChange={(e) => setTraceability(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vp-net-weight">Peso Neto (kg)</Label>
              <Input
                id="vp-net-weight"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 700"
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
          <Button onClick={handleCreate} disabled={saving || !selectedPOId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Virtual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

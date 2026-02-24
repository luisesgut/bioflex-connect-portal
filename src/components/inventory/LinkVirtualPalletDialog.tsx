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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Link2, Ghost } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkVirtualPalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  virtualPalletId: string;
  virtualPtCode: string;
  loadPalletId?: string; // The load_pallets row for the virtual pallet
  onLinked: () => void;
}

interface RealPalletCandidate {
  id: string;
  pt_code: string;
  description: string;
  stock: number;
  traceability: string;
  fecha: string;
  unit: string;
}

export function LinkVirtualPalletDialog({
  open,
  onOpenChange,
  virtualPalletId,
  virtualPtCode,
  loadPalletId,
  onLinked,
}: LinkVirtualPalletDialogProps) {
  const [candidates, setCandidates] = useState<RealPalletCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedRealId, setSelectedRealId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    fetchCandidates();
  }, [open, virtualPtCode]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // Get pallets already in loads
      const { data: assignedData } = await supabase
        .from("load_pallets")
        .select("pallet_id");
      const assignedIds = new Set((assignedData || []).map((p) => p.pallet_id));

      // Get available real pallets matching PT code
      const { data, error } = await supabase
        .from("inventory_pallets")
        .select("id, pt_code, description, stock, traceability, fecha, unit")
        .eq("status", "available")
        .eq("is_virtual", false)
        .eq("pt_code", virtualPtCode);

      if (error) throw error;

      // Filter out already assigned
      const available = (data || []).filter((p) => !assignedIds.has(p.id));
      setCandidates(available);
    } catch (error) {
      console.error("Error fetching candidates:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (p) =>
        p.traceability.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const handleLink = async () => {
    if (!selectedRealId || !virtualPalletId) return;

    // Find the selected real pallet to get its values
    const realPallet = candidates.find((p) => p.id === selectedRealId);
    if (!realPallet) return;

    setLinking(true);
    try {
      if (loadPalletId) {
        // Update load_pallets to point to the real pallet, copying quantity from real pallet
        const { error: updateLoadError } = await supabase
          .from("load_pallets")
          .update({
            pallet_id: selectedRealId,
            quantity: realPallet.stock,
          })
          .eq("id", loadPalletId);

        if (updateLoadError) throw updateLoadError;

        // Mark real pallet as assigned
        await supabase
          .from("inventory_pallets")
          .update({ status: "assigned" })
          .eq("id", selectedRealId);
      } else {
        // Just link without load context
        await supabase
          .from("inventory_pallets")
          .update({ linked_real_pallet_id: selectedRealId })
          .eq("id", virtualPalletId);
      }

      // Delete the virtual pallet from inventory
      await supabase
        .from("inventory_pallets")
        .delete()
        .eq("id", virtualPalletId);

      toast.success("Tarima virtual reemplazada por la tarima real");
      setSelectedRealId(null);
      onOpenChange(false);
      onLinked();
    } catch (error) {
      console.error("Error linking pallet:", error);
      toast.error("Error al ligar tarima");
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-500" />
            Ligar Tarima Virtual → Real
          </DialogTitle>
          <DialogDescription>
            Selecciona la tarima real de PT <strong>{virtualPtCode}</strong> para reemplazar la virtual.
            El número de release y la información de liberación se mantendrán.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por trazabilidad o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ghost className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay tarimas reales disponibles con PT Code: {virtualPtCode}</p>
              <p className="text-xs mt-1">Sincroniza SAP para actualizar el inventario</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Traceability</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${selectedRealId === p.id ? "bg-primary/10" : ""}`}
                      onClick={() => setSelectedRealId(p.id)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          checked={selectedRealId === p.id}
                          onChange={() => setSelectedRealId(p.id)}
                          className="accent-primary"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.traceability}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{p.description}</TableCell>
                      <TableCell className="text-right">
                        {p.stock.toLocaleString()} {p.unit}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(p.fecha).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleLink} disabled={!selectedRealId || linking}>
            {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reemplazar Virtual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

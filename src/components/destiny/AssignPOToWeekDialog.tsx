import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { POForPlan, AssignmentRow, DestinyFamily } from "@/hooks/useDestinyPlan";
import { toISODate } from "@/utils/destinyWeek";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  family: DestinyFamily;
  weekStart: Date;
  pos: POForPlan[];
  poDetails: Map<string, { customer: string | null; product_name: string | null; pt_code: string | null; item_type: string | null }>;
  allAssignments: AssignmentRow[];
}

export function AssignPOToWeekDialog({ open, onOpenChange, family, weekStart, pos, poDetails, allAssignments }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPO, setSelectedPO] = useState<POForPlan | null>(null);
  const [qty, setQty] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const assignedByPO = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allAssignments) {
      m.set(a.purchase_order_id, (m.get(a.purchase_order_id) ?? 0) + Number(a.assigned_quantity));
    }
    return m;
  }, [allAssignments]);

  const matchesFamily = (po: POForPlan): boolean => {
    if (!family.item_type_mapping?.length) return true;
    const it = poDetails.get(po.id)?.item_type;
    if (!it) return true;
    return family.item_type_mapping.includes(it);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pos
      .filter((p) => (assignedByPO.get(p.id) ?? 0) < p.quantity)
      .filter((p) => {
        if (!s) return true;
        const d = poDetails.get(p.id);
        return (
          p.po_number.toLowerCase().includes(s) ||
          (d?.customer ?? "").toLowerCase().includes(s) ||
          (d?.product_name ?? "").toLowerCase().includes(s) ||
          (d?.pt_code ?? "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (matchesFamily(b) ? 1 : 0) - (matchesFamily(a) ? 1 : 0));
  }, [pos, poDetails, search, assignedByPO, family]);

  const pending = selectedPO ? selectedPO.quantity - (assignedByPO.get(selectedPO.id) ?? 0) : 0;

  const handleSelect = (po: POForPlan) => {
    setSelectedPO(po);
    const remaining = po.quantity - (assignedByPO.get(po.id) ?? 0);
    setQty(String(remaining));
  };

  const handleSave = async () => {
    if (!selectedPO || !user) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (n > pending) {
      toast.error(`Only ${pending.toLocaleString()} available to assign`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("destiny_weekly_assignments").insert({
      family_id: family.id,
      purchase_order_id: selectedPO.id,
      week_start: toISODate(weekStart),
      assigned_quantity: n,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("PO assigned to week");
    qc.invalidateQueries({ queryKey: ["destiny-assignments"] });
    qc.invalidateQueries({ queryKey: ["destiny-assignments-all"] });
    onOpenChange(false);
    setSelectedPO(null);
    setQty("");
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign PO — {family.name}</DialogTitle>
        </DialogHeader>
        {!selectedPO ? (
          <Command className="border rounded-md">
            <CommandInput placeholder="Search PO #, customer, item, PT code..." value={search} onValueChange={setSearch} />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>No POs available.</CommandEmpty>
              <CommandGroup>
                {filtered.map((po) => {
                  const d = poDetails.get(po.id);
                  const remaining = po.quantity - (assignedByPO.get(po.id) ?? 0);
                  const suggested = matchesFamily(po);
                  return (
                    <CommandItem key={po.id} onSelect={() => handleSelect(po)} className="flex flex-col items-start gap-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold">PO {po.po_number} {suggested && <span className="ml-2 text-xs text-primary">★ suggested</span>}</span>
                        <span className="text-sm text-muted-foreground">{remaining.toLocaleString()} left</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{d?.customer ?? ""} · {d?.product_name ?? ""} {d?.pt_code ? `(${d.pt_code})` : ""}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="font-semibold">PO {selectedPO.po_number}</div>
              <div className="text-sm text-muted-foreground">{poDetails.get(selectedPO.id)?.customer ?? ""} · {poDetails.get(selectedPO.id)?.product_name ?? ""}</div>
              <div className="text-sm mt-1">Total: {selectedPO.quantity.toLocaleString()} · Pending: {pending.toLocaleString()}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity to assign</Label>
              <Input id="qty" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          {selectedPO && (
            <Button variant="ghost" onClick={() => setSelectedPO(null)}>Back</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedPO || saving}>{saving ? "Saving..." : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

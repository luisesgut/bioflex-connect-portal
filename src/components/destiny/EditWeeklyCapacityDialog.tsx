import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DestinyFamily, WeeklyCapacityRow } from "@/hooks/useDestinyPlan";
import { toISODate, getWeekRangeLabel } from "@/utils/destinyWeek";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  family: DestinyFamily;
  weekStart: Date;
  existing: WeeklyCapacityRow | undefined;
}

export function EditWeeklyCapacityDialog({ open, onOpenChange, family, weekStart, existing }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(String(existing?.weekly_capacity ?? family.default_weekly_capacity));
    }
  }, [open, existing, family]);

  const handleSave = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Invalid capacity");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("destiny_weekly_capacity")
      .upsert({ family_id: family.id, week_start: toISODate(weekStart), weekly_capacity: n }, { onConflict: "family_id,week_start" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Capacity updated");
    qc.invalidateQueries({ queryKey: ["destiny-weekly-capacity"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capacity — {family.name}</DialogTitle>
          <DialogDescription>{getWeekRangeLabel(weekStart)} · default {family.default_weekly_capacity.toLocaleString()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cap">Weekly capacity</Label>
          <Input id="cap" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

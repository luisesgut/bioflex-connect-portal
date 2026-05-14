import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { toISODate, getWeekRangeLabel } from "@/utils/destinyWeek";
import type { WeekStatusRow } from "@/hooks/useDestinyPlan";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekStart: Date;
  existing: WeekStatusRow | undefined;
}

export function FreezeWeekDialog({ open, onOpenChange, weekStart, existing }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isFrozen = existing?.is_frozen ?? false;

  const handle = async () => {
    if (!user) return;
    setSaving(true);
    const payload = isFrozen
      ? { week_start: toISODate(weekStart), is_frozen: false, frozen_at: null, frozen_by: null }
      : { week_start: toISODate(weekStart), is_frozen: true, frozen_at: new Date().toISOString(), frozen_by: user.id };
    const { error } = await supabase
      .from("destiny_week_status")
      .upsert(payload, { onConflict: "week_start" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isFrozen ? "Week unfrozen" : "Week frozen");
    qc.invalidateQueries({ queryKey: ["destiny-week-status"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isFrozen ? "Unfreeze" : "Freeze"} {getWeekRangeLabel(weekStart)}</DialogTitle>
          <DialogDescription>
            {isFrozen
              ? "Unfreezing will allow assignments to be created, edited or removed for this week."
              : "Freezing locks all assignments for this week. They cannot be changed until you unfreeze."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={isFrozen ? "default" : "destructive"} onClick={handle} disabled={saving}>
            {saving ? "Saving..." : isFrozen ? "Unfreeze" : "Freeze week"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

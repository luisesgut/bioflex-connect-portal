import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, Unlock, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Download, AlertTriangle, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useDestinyFamilies,
  useDestinyWeeks,
  useDestinyEligiblePOs,
  type DestinyFamily,
} from "@/hooks/useDestinyPlan";
import { addWeeks, getWeekStart, getWeekRangeLabel, isTuesday, toISODate } from "@/utils/destinyWeek";
import { AssignPOToWeekDialog } from "@/components/destiny/AssignPOToWeekDialog";
import { EditWeeklyCapacityDialog } from "@/components/destiny/EditWeeklyCapacityDialog";
import { FreezeWeekDialog } from "@/components/destiny/FreezeWeekDialog";
import { useAdmin } from "@/hooks/useAdmin";
import { generateDestinyPOTR, type POMeta, type FacilityClosure } from "@/utils/generateDestinyPOTR";

export default function DestinyPlan() {
  const { isAdmin } = useAdmin();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<Date>(getWeekStart(new Date()));

  const weeks = useMemo(() => [anchor, addWeeks(anchor, 1), addWeeks(anchor, 2)], [anchor]);
  const isoWeeks = useMemo(() => weeks.map(toISODate), [weeks]);

  const familiesQ = useDestinyFamilies();
  const { capacities, statuses, assignments } = useDestinyWeeks(weeks);
  const posQ = useDestinyEligiblePOs();

  // Fetch product details for assigned + eligible POs
  const allPoIds = useMemo(() => {
    const s = new Set<string>();
    (posQ.data ?? []).forEach((p) => s.add(p.id));
    (assignments.data ?? []).forEach((a) => s.add(a.purchase_order_id));
    return Array.from(s);
  }, [posQ.data, assignments.data]);

  const poDetailsQ = useQuery({
    queryKey: ["destiny-po-details", allPoIds.join(",")],
    enabled: allPoIds.length > 0,
    queryFn: async () => {
      const { data: pos } = await supabase
        .from("purchase_orders")
        .select("id, po_number, quantity, requested_delivery_date, product_id, user_id")
        .in("id", allPoIds);
      const productIds = Array.from(new Set((pos ?? []).map((p) => p.product_id).filter(Boolean) as string[]));
      const userIds = Array.from(new Set((pos ?? []).map((p) => p.user_id).filter(Boolean)));
      const [{ data: products }, { data: profiles }] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id, name, pt_code, item_type, item_description").in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("user_id, company").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const productById = new Map((products ?? []).map((p: any) => [p.id, p]));
      const customerByUser = new Map((profiles ?? []).map((p: any) => [p.user_id, p.company as string | null]));
      const map = new Map<string, { customer: string | null; product_name: string | null; pt_code: string | null; item_type: string | null }>();
      for (const po of pos ?? []) {
        const prod = po.product_id ? productById.get(po.product_id) : null;
        map.set(po.id, {
          customer: customerByUser.get(po.user_id) ?? null,
          product_name: prod?.item_description ?? prod?.name ?? null,
          pt_code: prod?.pt_code ?? null,
          item_type: prod?.item_type ?? null,
        });
      }
      const poMeta = new Map<string, POMeta>();
      for (const po of pos ?? []) {
        const d = map.get(po.id);
        poMeta.set(po.id, {
          id: po.id,
          po_number: po.po_number,
          customer: d?.customer ?? null,
          product_name: d?.product_name ?? null,
          pt_code: d?.pt_code ?? null,
          total_quantity: po.quantity,
          requested_delivery_date: po.requested_delivery_date,
        });
      }
      return { details: map, poMeta };
    },
  });

  const families = familiesQ.data ?? [];
  const allAssignments = assignments.data ?? [];
  const allCapacities = capacities.data ?? [];
  const allStatuses = statuses.data ?? [];

  // Dialog state
  const [assignTarget, setAssignTarget] = useState<{ family: DestinyFamily; week: Date } | null>(null);
  const [capTarget, setCapTarget] = useState<{ family: DestinyFamily; week: Date } | null>(null);
  const [freezeTarget, setFreezeTarget] = useState<Date | null>(null);

  const getCapacity = (familyId: string, isoWeek: string) => {
    const override = allCapacities.find((c) => c.family_id === familyId && c.week_start === isoWeek);
    if (override) return Number(override.weekly_capacity);
    return Number(families.find((f) => f.id === familyId)?.default_weekly_capacity ?? 0);
  };

  const getUsed = (familyId: string, isoWeek: string) =>
    allAssignments
      .filter((a) => a.family_id === familyId && a.week_start === isoWeek)
      .reduce((s, a) => s + Number(a.assigned_quantity), 0);

  const getStatus = (isoWeek: string) => allStatuses.find((s) => s.week_start === isoWeek);

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    const { error } = await supabase.from("destiny_weekly_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["destiny-assignments"] });
  };

  const handleExport = async () => {
    const { data: closures } = await supabase.from("facility_closures").select("*");
    if (!poDetailsQ.data) {
      toast.error("Loading data, try again");
      return;
    }
    await generateDestinyPOTR({
      weekStarts: isoWeeks,
      families,
      capacities: allCapacities,
      assignments: allAssignments,
      poMap: poDetailsQ.data.poMeta,
      closures: (closures ?? []) as FacilityClosure[],
    });
    toast.success("POTR downloaded");
  };

  const today = new Date();
  const showFreezeBanner = isTuesday(today);

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="text-muted-foreground">Admin only.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Destiny Weekly Plan</h1>
            <p className="text-muted-foreground">3-week production planning · Friday to Thursday</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor(addWeeks(anchor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(getWeekStart(new Date()))}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(addWeeks(anchor, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="default" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export POTR</Button>
          </div>
        </div>

        {showFreezeBanner && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-amber-600" />
            <span>Today is freeze day — remember to lock the current week and the next one.</span>
          </div>
        )}

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {weeks.map((w, idx) => {
            const iso = isoWeeks[idx];
            const status = getStatus(iso);
            const frozen = status?.is_frozen ?? false;
            return (
              <Card key={iso} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-base">{getWeekRangeLabel(w)}</div>
                    {frozen ? (
                      <Badge variant="destructive" className="mt-1 gap-1"><Lock className="h-3 w-3" />FROZEN</Badge>
                    ) : (
                      <Badge variant="secondary" className="mt-1">Open</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setFreezeTarget(w)} title={frozen ? "Unfreeze" : "Freeze week"}>
                    {frozen ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                </div>

                {families.map((family) => {
                  const cap = getCapacity(family.id, iso);
                  const used = getUsed(family.id, iso);
                  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                  const over = cap > 0 && used > cap;
                  const familyAssignments = allAssignments.filter((a) => a.family_id === family.id && a.week_start === iso);
                  return (
                    <div key={family.id} className="rounded-md border p-2.5 space-y-2 bg-card">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{family.name}</span>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          onClick={() => setCapTarget({ family, week: w })}
                          disabled={frozen}
                        >
                          <Pencil className="h-3 w-3" /> {used.toLocaleString()} / {cap.toLocaleString()}
                        </button>
                      </div>
                      <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
                      {over && (
                        <div className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Over capacity</div>
                      )}
                      <div className="space-y-1">
                        {familyAssignments.length === 0 && (
                          <div className="text-xs text-muted-foreground italic">No assignments</div>
                        )}
                        {familyAssignments.map((a) => {
                          const meta = poDetailsQ.data?.poMeta.get(a.purchase_order_id);
                          return (
                            <div key={a.id} className="flex items-center justify-between text-xs rounded bg-muted/40 px-2 py-1">
                              <div className="flex-1 truncate">
                                <span className="font-medium">PO {meta?.po_number ?? "—"}</span>
                                <span className="text-muted-foreground"> · {Number(a.assigned_quantity).toLocaleString()}</span>
                              </div>
                              {!frozen && (
                                <button onClick={() => handleDeleteAssignment(a.id)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        disabled={frozen}
                        onClick={() => setAssignTarget({ family, week: w })}
                      >
                        <Plus className="h-3 w-3 mr-1" />Assign PO
                      </Button>
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
      </div>

      {assignTarget && (
        <AssignPOToWeekDialog
          open={!!assignTarget}
          onOpenChange={(v) => !v && setAssignTarget(null)}
          family={assignTarget.family}
          weekStart={assignTarget.week}
          pos={posQ.data ?? []}
          poDetails={poDetailsQ.data?.details ?? new Map()}
          allAssignments={allAssignments}
        />
      )}
      {capTarget && (
        <EditWeeklyCapacityDialog
          open={!!capTarget}
          onOpenChange={(v) => !v && setCapTarget(null)}
          family={capTarget.family}
          weekStart={capTarget.week}
          existing={allCapacities.find((c) => c.family_id === capTarget.family.id && c.week_start === toISODate(capTarget.week))}
        />
      )}
      {freezeTarget && (
        <FreezeWeekDialog
          open={!!freezeTarget}
          onOpenChange={(v) => !v && setFreezeTarget(null)}
          weekStart={freezeTarget}
          existing={getStatus(toISODate(freezeTarget))}
        />
      )}
    </MainLayout>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Family {
  id: string;
  name: string;
  default_weekly_capacity: number;
  item_type_mapping: string[];
  sort_order: number;
  is_active: boolean;
}

export function DestinyFamiliesManagement() {
  const qc = useQueryClient();
  const { data: families = [] } = useQuery({
    queryKey: ["destiny-families-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("destiny_families").select("*").order("sort_order");
      if (error) throw error;
      return data as Family[];
    },
  });

  const { data: itemTypes = [] } = useQuery({
    queryKey: ["dropdown-item-types-for-families"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dropdown_options")
        .select("label")
        .eq("category", "item_type")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []).map((d: any) => d.label as string);
    },
  });

  const [edit, setEdit] = useState<Record<string, Partial<Family>>>({});

  const update = (id: string, patch: Partial<Family>) =>
    setEdit((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const save = async (f: Family) => {
    const patch = edit[f.id];
    if (!patch) return;
    const { error } = await supabase
      .from("destiny_families")
      .update({
        default_weekly_capacity: Number(patch.default_weekly_capacity ?? f.default_weekly_capacity),
        item_type_mapping: patch.item_type_mapping ?? f.item_type_mapping,
      })
      .eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit((s) => { const c = { ...s }; delete c[f.id]; return c; });
    qc.invalidateQueries({ queryKey: ["destiny-families-admin"] });
    qc.invalidateQueries({ queryKey: ["destiny-families"] });
  };

  const toggleType = (f: Family, t: string) => {
    const current = edit[f.id]?.item_type_mapping ?? f.item_type_mapping ?? [];
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    update(f.id, { item_type_mapping: next });
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Destiny Families</h2>
          <p className="text-sm text-muted-foreground">Default weekly capacity and item-type mapping for the Destiny plan.</p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Family</TableHead>
            <TableHead>Default weekly capacity</TableHead>
            <TableHead>Item types</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {families.map((f) => {
            const cap = edit[f.id]?.default_weekly_capacity ?? f.default_weekly_capacity;
            const mapping = edit[f.id]?.item_type_mapping ?? f.item_type_mapping ?? [];
            return (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-32"
                    value={cap as number}
                    onChange={(e) => update(f.id, { default_weekly_capacity: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {itemTypes.length === 0 && <span className="text-xs text-muted-foreground">No item types in dropdowns</span>}
                    {itemTypes.map((t) => {
                      const on = mapping.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleType(f, t)}
                          className={`text-xs rounded-full px-2 py-0.5 border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  {edit[f.id] && (
                    <Button size="sm" onClick={() => save(f)}>Save</Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Layers, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MaterialRow {
  id?: string;
  label: string;
  density: number | null;
  finish: string;
  thickness_value: number | null;
  thickness_unit: string;
  sort_order: number;
  is_active: boolean;
  isNew?: boolean;
  // IDs for linked rows
  finishId?: string | null;
  presetId?: string | null;
}

interface RawOption {
  id: string;
  category: string;
  label: string;
  parent_material?: string | null;
  default_value?: number | null;
  default_unit?: string | null;
  density?: number | null;
  sort_order: number;
  is_active: boolean;
}

export function StructureLayerOptionsManagement() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [finishOptions, setFinishOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("structure_layer_options")
      .select("*")
      .order("sort_order");

    if (error) {
      console.error("Error fetching options:", error);
      setLoading(false);
      return;
    }

    const all = (data || []) as RawOption[];
    const mats = all.filter((r) => r.category === "material");
    const fins = all.filter((r) => r.category === "finish");
    const presets = all.filter((r) => r.category === "thickness_preset");

    // Build unique finish labels for the dropdown
    setFinishOptions(fins.filter((f) => f.is_active).map((f) => f.label));

    // Build merged rows: one per material
    const merged: MaterialRow[] = mats.map((mat) => {
      const preset = presets.find((p) => p.parent_material === mat.label);
      // Find a finish linked to this material (via parent_material) or leave empty
      const linkedFinish = fins.find((f) => f.parent_material === mat.label);
      return {
        id: mat.id,
        label: mat.label,
        density: (mat as any).density ?? null,
        finish: linkedFinish?.label || "",
        thickness_value: preset?.default_value ?? null,
        thickness_unit: preset?.default_unit || "gauge",
        sort_order: mat.sort_order,
        is_active: mat.is_active,
        finishId: linkedFinish?.id || null,
        presetId: preset?.id || null,
      };
    });

    setRows(merged);
    setLoading(false);
  };

  const updateRow = (index: number, field: keyof MaterialRow, value: any) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => {
    const maxSort = rows.reduce((max, r) => Math.max(max, r.sort_order), 0);
    setRows((prev) => [
      ...prev,
      {
        label: "",
        density: null,
        finish: "",
        thickness_value: null,
        thickness_unit: "gauge",
        sort_order: maxSort + 1,
        is_active: true,
        isNew: true,
      },
    ]);
  };

  const removeRow = async (index: number) => {
    const row = rows[index];
    // Delete material, its preset, and its linked finish from DB
    const idsToDelete = [row.id, row.presetId, row.finishId].filter(Boolean);
    for (const id of idsToDelete) {
      await supabase.from("structure_layer_options").delete().eq("id", id!);
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
    toast.success("Material removed");
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        if (!row.label.trim()) continue;

        // 1. Upsert material
        const matPayload: any = {
          category: "material",
          label: row.label.trim(),
          sort_order: row.sort_order,
          is_active: row.is_active,
          density: row.density || null,
        };
        if (row.id) {
          await supabase.from("structure_layer_options").update(matPayload).eq("id", row.id);
        } else {
          const { data } = await supabase.from("structure_layer_options").insert(matPayload).select("id").single();
          if (data) row.id = data.id;
        }

        // 2. Upsert thickness preset (only if value is set)
        if (row.thickness_value !== null && row.thickness_value !== undefined) {
          const presetPayload: any = {
            category: "thickness_preset",
            label: row.label.trim(),
            parent_material: row.label.trim(),
            default_value: row.thickness_value,
            default_unit: row.thickness_unit || "gauge",
            sort_order: row.sort_order,
            is_active: row.is_active,
          };
          if (row.presetId) {
            await supabase.from("structure_layer_options").update(presetPayload).eq("id", row.presetId);
          } else {
            const { data } = await supabase.from("structure_layer_options").insert(presetPayload).select("id").single();
            if (data) row.presetId = data.id;
          }
        } else if (row.presetId) {
          // Remove preset if value was cleared
          await supabase.from("structure_layer_options").delete().eq("id", row.presetId);
          row.presetId = null;
        }
      }

      toast.success("All changes saved");
      await fetchAll();
    } catch {
      toast.error("Error saving");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <p className="text-muted-foreground">Loading structure options...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            Structure Layer Options
          </h2>
          <p className="text-sm text-muted-foreground">
            Materials, density, finish and default thickness in a single view
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <th className="text-left py-2 pr-2">Material</th>
              <th className="text-left py-2 px-2 w-[100px]">Density (g/cm³)</th>
              <th className="text-left py-2 px-2 w-[140px]">Finish</th>
              <th className="text-left py-2 px-2 w-[90px]">Thickness</th>
              <th className="text-left py-2 px-2 w-[110px]">Unit</th>
              <th className="text-center py-2 px-2 w-[60px]">Order</th>
              <th className="text-center py-2 px-2 w-[50px]">Active</th>
              <th className="w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id || `new-${index}`}
                className="border-b last:border-0 hover:bg-muted/40 transition-colors"
              >
                <td className="py-1.5 pr-2">
                  <Input
                    value={row.label}
                    onChange={(e) => updateRow(index, "label", e.target.value)}
                    placeholder="Material name"
                    className="h-8"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={row.density ?? ""}
                    onChange={(e) =>
                      updateRow(index, "density", parseFloat(e.target.value) || null)
                    }
                    placeholder="0.92"
                    className="h-8"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <Select
                    value={row.finish || "__none__"}
                    onValueChange={(val) =>
                      updateRow(index, "finish", val === "__none__" ? "" : val)
                    }
                  >
                    <SelectTrigger className="h-8 bg-background">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {finishOptions.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-1.5 px-2">
                  <Input
                    type="number"
                    step="0.1"
                    value={row.thickness_value ?? ""}
                    onChange={(e) =>
                      updateRow(index, "thickness_value", parseFloat(e.target.value) || null)
                    }
                    placeholder="—"
                    className="h-8"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <Select
                    value={row.thickness_unit}
                    onValueChange={(val) => updateRow(index, "thickness_unit", val)}
                  >
                    <SelectTrigger className="h-8 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gauge">Gauge</SelectItem>
                      <SelectItem value="microns">Microns</SelectItem>
                      <SelectItem value="mils">Mils</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-1.5 px-2 text-center">
                  <Input
                    type="number"
                    value={row.sort_order}
                    onChange={(e) =>
                      updateRow(index, "sort_order", parseInt(e.target.value) || 0)
                    }
                    className="h-8 w-16 mx-auto text-center"
                  />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(val) => updateRow(index, "is_active", val)}
                  />
                </td>
                <td className="py-1.5 pl-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeRow(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
          <Plus className="h-4 w-4" /> Add Material
        </Button>
        <Button variant="accent" onClick={saveAll} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All"}
        </Button>
      </div>
    </div>
  );
}

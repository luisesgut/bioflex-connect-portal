import { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface OptionRow {
  id?: string;
  category: string;
  label: string;
  parent_material?: string | null;
  default_value?: number | null;
  default_unit?: string | null;
  density?: number | null;
  sort_order: number;
  is_active: boolean;
  isNew?: boolean;
}

export function StructureLayerOptionsManagement() {
  const [materials, setMaterials] = useState<OptionRow[]>([]);
  const [finishes, setFinishes] = useState<OptionRow[]>([]);
  const [thicknessPresets, setThicknessPresets] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      console.error(error);
      setLoading(false);
      return;
    }

    const all = (data || []) as OptionRow[];
    setMaterials(all.filter((r) => r.category === "material"));
    setFinishes(all.filter((r) => r.category === "finish"));
    setThicknessPresets(all.filter((r) => r.category === "thickness_preset"));
    setLoading(false);
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const update = <T extends OptionRow>(
    idx: number,
    field: string,
    value: any,
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => setter((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const remove = async (
    idx: number,
    list: OptionRow[],
    setter: React.Dispatch<React.SetStateAction<OptionRow[]>>
  ) => {
    const row = list[idx];
    if (row.id) {
      const { error } = await supabase.from("structure_layer_options").delete().eq("id", row.id);
      if (error) { toast.error("Error deleting"); return; }
    }
    setter((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Removed");
  };

  const addMaterial = () => {
    const max = materials.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setMaterials((prev) => [
      ...prev,
      { category: "material", label: "", density: null, sort_order: max + 1, is_active: true, isNew: true },
    ]);
  };

  const addFinish = (parentMaterial: string) => {
    const siblings = finishes.filter((f) => f.parent_material === parentMaterial);
    const max = siblings.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setFinishes((prev) => [
      ...prev,
      { category: "finish", label: "", parent_material: parentMaterial, sort_order: max + 1, is_active: true, isNew: true },
    ]);
  };

  const addPreset = (parentMaterial: string) => {
    const siblings = thicknessPresets.filter((p) => p.parent_material === parentMaterial);
    const max = siblings.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setThicknessPresets((prev) => [
      ...prev,
      {
        category: "thickness_preset",
        label: parentMaterial,
        parent_material: parentMaterial,
        default_value: null,
        default_unit: "gauge",
        sort_order: max + 1,
        is_active: true,
        isNew: true,
      },
    ]);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const allRows = [...materials, ...finishes, ...thicknessPresets];
      for (const row of allRows) {
        const label = row.category === "thickness_preset" ? (row.parent_material || "") : row.label.trim();
        if (!label) continue;

        const payload: any = {
          category: row.category,
          label,
          sort_order: row.sort_order,
          is_active: row.is_active,
          parent_material: row.parent_material || null,
        };

        if (row.category === "material") payload.density = row.density || null;
        if (row.category === "thickness_preset") {
          payload.default_value = row.default_value || null;
          payload.default_unit = row.default_unit || null;
        }

        if (row.id) {
          await supabase.from("structure_layer_options").update(payload).eq("id", row.id);
        } else {
          await supabase.from("structure_layer_options").insert(payload);
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
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Structure Layer Options</h2>
          <p className="text-sm text-muted-foreground">
            Materials with their finishes and thickness presets
          </p>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[minmax(0,1fr)_100px_70px_50px_40px] gap-2 px-2 pb-2 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        <span>Material</span>
        <span>Density (g/cm³)</span>
        <span className="text-center">Order</span>
        <span className="text-center">Active</span>
        <span />
      </div>

      {/* Materials */}
      <div className="divide-y">
        {materials.map((mat, matIdx) => {
          const key = mat.id || `new-${matIdx}`;
          const isOpen = expanded.has(key);
          const matFinishes = finishes.filter((f) => f.parent_material === mat.label);
          const matPresets = thicknessPresets.filter((p) => p.parent_material === mat.label);

          return (
            <Collapsible key={key} open={isOpen} onOpenChange={() => toggle(key)}>
              {/* Material row */}
              <div className="grid grid-cols-[minmax(0,1fr)_100px_70px_50px_40px] gap-2 items-center py-2 px-2 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-1.5">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <Input
                    value={mat.label}
                    onChange={(e) => update(matIdx, "label", e.target.value, setMaterials)}
                    placeholder="Material name"
                    className="h-8"
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={mat.density ?? ""}
                  onChange={(e) => update(matIdx, "density", parseFloat(e.target.value) || null, setMaterials)}
                  placeholder="0.92"
                  className="h-8"
                />
                <Input
                  type="number"
                  value={mat.sort_order}
                  onChange={(e) => update(matIdx, "sort_order", parseInt(e.target.value) || 0, setMaterials)}
                  className="h-8 text-center"
                />
                <div className="flex justify-center">
                  <Switch
                    checked={mat.is_active}
                    onCheckedChange={(val) => update(matIdx, "is_active", val, setMaterials)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => remove(matIdx, materials, setMaterials)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Expanded sub-sections */}
              <CollapsibleContent>
                <div className="ml-8 pl-4 border-l-2 border-muted pb-3 space-y-4">
                  {/* Finishes */}
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 mt-2">
                      Finishes
                    </p>
                    <div className="space-y-1.5">
                      {matFinishes.map((fin) => {
                        const fIdx = finishes.indexOf(fin);
                        return (
                          <div key={fin.id || `fin-${fIdx}`} className="flex items-center gap-2">
                            <Input
                              value={fin.label}
                              onChange={(e) => update(fIdx, "label", e.target.value, setFinishes)}
                              placeholder="Finish name"
                              className="h-7 flex-1 text-sm"
                            />
                            <Switch
                              checked={fin.is_active}
                              onCheckedChange={(val) => update(fIdx, "is_active", val, setFinishes)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => remove(fIdx, finishes, setFinishes)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      {matFinishes.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No finishes configured</p>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs h-7"
                        onClick={() => addFinish(mat.label)}
                      >
                        <Plus className="h-3 w-3" /> Add Finish
                      </Button>
                    </div>
                  </div>

                  {/* Thickness Presets */}
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Thickness Presets
                    </p>
                    <div className="space-y-1.5">
                      {matPresets.map((preset) => {
                        const pIdx = thicknessPresets.indexOf(preset);
                        return (
                          <div key={preset.id || `p-${pIdx}`} className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              value={preset.default_value ?? ""}
                              onChange={(e) =>
                                update(pIdx, "default_value", parseFloat(e.target.value) || null, setThicknessPresets)
                              }
                              placeholder="Value"
                              className="h-7 w-24 text-sm"
                            />
                            <Select
                              value={preset.default_unit || "gauge"}
                              onValueChange={(val) => update(pIdx, "default_unit", val, setThicknessPresets)}
                            >
                              <SelectTrigger className="h-7 w-28 bg-background text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gauge">Gauge</SelectItem>
                                <SelectItem value="microns">Microns</SelectItem>
                                <SelectItem value="mils">Mils</SelectItem>
                              </SelectContent>
                            </Select>
                            <Switch
                              checked={preset.is_active}
                              onCheckedChange={(val) => update(pIdx, "is_active", val, setThicknessPresets)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => remove(pIdx, thicknessPresets, setThicknessPresets)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      {matPresets.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No presets — thickness will be entered manually
                        </p>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs h-7"
                        onClick={() => addPreset(mat.label)}
                      >
                        <Plus className="h-3 w-3" /> Add Preset
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" size="sm" onClick={addMaterial} className="gap-1">
          <Plus className="h-4 w-4" /> Add Material
        </Button>
        <Button variant="accent" onClick={saveAll} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save All"}
        </Button>
      </div>
    </div>
  );
}

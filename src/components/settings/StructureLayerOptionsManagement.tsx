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
import { Label } from "@/components/ui/label";
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
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>( new Set());

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

    const rows = (data || []) as OptionRow[];
    setMaterials(rows.filter((r) => r.category === "material"));
    setFinishes(rows.filter((r) => r.category === "finish"));
    setThicknessPresets(rows.filter((r) => r.category === "thickness_preset"));
    setLoading(false);
  };

  const toggleExpand = (key: string) => {
    setExpandedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateRow = (
    index: number,
    field: string,
    value: any,
    setter: React.Dispatch<React.SetStateAction<OptionRow[]>>
  ) => {
    setter((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const removeRow = async (
    index: number,
    list: OptionRow[],
    setter: React.Dispatch<React.SetStateAction<OptionRow[]>>
  ) => {
    const row = list[index];
    if (row.id) {
      const { error } = await supabase
        .from("structure_layer_options")
        .delete()
        .eq("id", row.id);
      if (error) {
        toast.error("Error deleting option");
        return;
      }
    }
    setter((prev) => prev.filter((_, i) => i !== index));
    toast.success("Option removed");
  };

  const addMaterial = () => {
    const maxSort = materials.reduce((max, r) => Math.max(max, r.sort_order), 0);
    setMaterials((prev) => [
      ...prev,
      { category: "material", label: "", sort_order: maxSort + 1, is_active: true, density: null, isNew: true },
    ]);
  };

  const addThicknessPreset = (parentMaterial: string) => {
    const existing = thicknessPresets.filter((p) => p.parent_material === parentMaterial);
    const maxSort = existing.reduce((max, r) => Math.max(max, r.sort_order), 0);
    setThicknessPresets((prev) => [
      ...prev,
      {
        category: "thickness_preset",
        label: parentMaterial,
        parent_material: parentMaterial,
        default_value: null,
        default_unit: "gauge",
        sort_order: maxSort + 1,
        is_active: true,
        isNew: true,
      },
    ]);
  };

  const addFinish = () => {
    const maxSort = finishes.reduce((max, r) => Math.max(max, r.sort_order), 0);
    setFinishes((prev) => [
      ...prev,
      { category: "finish", label: "", sort_order: maxSort + 1, is_active: true, isNew: true },
    ]);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const allRows = [...materials, ...finishes, ...thicknessPresets];
      for (const row of allRows) {
        if (!row.label.trim() && row.category !== "thickness_preset") continue;
        const payload: any = {
          category: row.category,
          label: row.category === "thickness_preset" ? (row.parent_material || row.label) : row.label.trim(),
          sort_order: row.sort_order,
          is_active: row.is_active,
        };
        if (row.category === "material") {
          payload.density = row.density || null;
        }
        if (row.category === "thickness_preset") {
          payload.parent_material = row.parent_material || null;
          payload.default_value = row.default_value || null;
          payload.default_unit = row.default_unit || null;
        }
        if (row.id) {
          await supabase.from("structure_layer_options").update(payload).eq("id", row.id);
        } else {
          await supabase.from("structure_layer_options").insert(payload);
        }
      }
      toast.success("All options saved");
      await fetchAll();
    } catch {
      toast.error("Error saving options");
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
            Manage materials, finishes, and default thickness presets
          </p>
        </div>
      </div>

      {/* MATERIALS MATRIX */}
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_100px_60px_40px_40px] gap-2 px-2 pb-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Material</span>
          <span>Density (g/cm³)</span>
          <span>Order</span>
          <span>Active</span>
          <span></span>
          <span></span>
        </div>

        {materials.map((mat, matIdx) => {
          const matKey = mat.id || `new-${matIdx}`;
          const isExpanded = expandedMaterials.has(matKey);
          const matPresets = thicknessPresets.filter(
            (p) => p.parent_material === mat.label
          );

          return (
            <Collapsible
              key={matKey}
              open={isExpanded}
              onOpenChange={() => toggleExpand(matKey)}
            >
              {/* Material row */}
              <div className="grid grid-cols-[1fr_100px_100px_60px_40px_40px] gap-2 items-center py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <Input
                    value={mat.label}
                    onChange={(e) => updateRow(matIdx, "label", e.target.value, setMaterials)}
                    placeholder="Material name"
                    className="h-8"
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={mat.density ?? ""}
                  onChange={(e) =>
                    updateRow(matIdx, "density", parseFloat(e.target.value) || null, setMaterials)
                  }
                  placeholder="e.g. 0.92"
                  className="h-8"
                />
                <Input
                  type="number"
                  value={mat.sort_order}
                  onChange={(e) =>
                    updateRow(matIdx, "sort_order", parseInt(e.target.value) || 0, setMaterials)
                  }
                  className="h-8"
                />
                <div className="flex justify-center">
                  <Switch
                    checked={mat.is_active}
                    onCheckedChange={(val) => updateRow(matIdx, "is_active", val, setMaterials)}
                  />
                </div>
                <div />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeRow(matIdx, materials, setMaterials)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Sub-rows: thickness presets */}
              <CollapsibleContent>
                <div className="ml-10 pl-4 border-l-2 border-muted space-y-1 py-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Thickness Presets
                  </p>
                  {matPresets.map((preset) => {
                    const presetIdx = thicknessPresets.indexOf(preset);
                    return (
                      <div
                        key={preset.id || `preset-${presetIdx}`}
                        className="flex items-center gap-2"
                      >
                        <Input
                          type="number"
                          step="0.1"
                          value={preset.default_value ?? ""}
                          onChange={(e) =>
                            updateRow(
                              presetIdx,
                              "default_value",
                              parseFloat(e.target.value) || null,
                              setThicknessPresets
                            )
                          }
                          className="h-8 w-24"
                          placeholder="Value"
                        />
                        <Select
                          value={preset.default_unit || "gauge"}
                          onValueChange={(val) =>
                            updateRow(presetIdx, "default_unit", val, setThicknessPresets)
                          }
                        >
                          <SelectTrigger className="h-8 w-28 bg-background">
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
                          onCheckedChange={(val) =>
                            updateRow(presetIdx, "is_active", val, setThicknessPresets)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            removeRow(presetIdx, thicknessPresets, setThicknessPresets)
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    onClick={() => addThicknessPreset(mat.label)}
                  >
                    <Plus className="h-3 w-3" /> Add Preset
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        <Button variant="outline" size="sm" onClick={addMaterial} className="gap-1 mt-3">
          <Plus className="h-4 w-4" /> Add Material
        </Button>
      </div>

      {/* FINISHES SECTION */}
      <div className="mt-8 pt-6 border-t">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Finishes</h3>
        <div className="space-y-2">
          {finishes.map((row, index) => (
            <div key={row.id || `fin-${index}`} className="flex items-center gap-3">
              <Input
                value={row.label}
                onChange={(e) => updateRow(index, "label", e.target.value, setFinishes)}
                placeholder="Finish name"
                className="h-8 flex-1"
              />
              <Input
                type="number"
                value={row.sort_order}
                onChange={(e) =>
                  updateRow(index, "sort_order", parseInt(e.target.value) || 0, setFinishes)
                }
                className="h-8 w-20"
                placeholder="Order"
              />
              <Switch
                checked={row.is_active}
                onCheckedChange={(val) => updateRow(index, "is_active", val, setFinishes)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeRow(index, finishes, setFinishes)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addFinish} className="gap-1">
            <Plus className="h-4 w-4" /> Add Finish
          </Button>
        </div>
      </div>

      {/* SAVE ALL */}
      <div className="mt-6 flex justify-end">
        <Button variant="accent" onClick={saveAll} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}

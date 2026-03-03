import { useState, useEffect } from "react";
import { Layers, Plus, Trash2, Save } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OptionRow {
  id?: string;
  category: string;
  label: string;
  parent_material?: string | null;
  default_value?: number | null;
  default_unit?: string | null;
  sort_order: number;
  is_active: boolean;
  isNew?: boolean;
}

export function StructureLayerOptionsManagement() {
  const [materials, setMaterials] = useState<OptionRow[]>([]);
  const [finishes, setFinishes] = useState<OptionRow[]>([]);
  const [thicknessPresets, setThicknessPresets] = useState<OptionRow[]>([]);
  const [materialOptions, setMaterialOptions] = useState<string[]>([]);
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

    const rows = data || [];
    const mats = rows.filter((r) => r.category === "material");
    const fins = rows.filter((r) => r.category === "finish");
    const presets = rows.filter((r) => r.category === "thickness_preset");

    setMaterials(mats);
    setFinishes(fins);
    setThicknessPresets(presets);
    setMaterialOptions(mats.filter((m) => m.is_active).map((m) => m.label));
    setLoading(false);
  };

  const addRow = (
    category: string,
    setter: React.Dispatch<React.SetStateAction<OptionRow[]>>,
    list: OptionRow[]
  ) => {
    const maxSort = list.reduce((max, r) => Math.max(max, r.sort_order), 0);
    setter((prev) => [
      ...prev,
      {
        category,
        label: "",
        sort_order: maxSort + 1,
        is_active: true,
        isNew: true,
        ...(category === "thickness_preset"
          ? { parent_material: "", default_value: null, default_unit: "gauge" }
          : {}),
      },
    ]);
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

  const saveCategory = async (
    list: OptionRow[],
    category: string
  ) => {
    setSaving(true);
    try {
      for (const row of list) {
        if (!row.label.trim()) continue;
        const payload: any = {
          category,
          label: row.label.trim(),
          sort_order: row.sort_order,
          is_active: row.is_active,
        };
        if (category === "thickness_preset") {
          payload.parent_material = row.parent_material || null;
          payload.default_value = row.default_value || null;
          payload.default_unit = row.default_unit || null;
        }
        if (row.id) {
          await supabase
            .from("structure_layer_options")
            .update(payload)
            .eq("id", row.id);
        } else {
          await supabase.from("structure_layer_options").insert(payload);
        }
      }
      toast.success("Options saved");
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

      <Tabs defaultValue="materials">
        <TabsList className="mb-4">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="finishes">Finishes</TabsTrigger>
          <TabsTrigger value="thickness">Thickness Presets</TabsTrigger>
        </TabsList>

        {/* MATERIALS TAB */}
        <TabsContent value="materials">
          <SimpleOptionList
            items={materials}
            onUpdate={(i, field, val) => updateRow(i, field, val, setMaterials)}
            onRemove={(i) => removeRow(i, materials, setMaterials)}
            onAdd={() => addRow("material", setMaterials, materials)}
            onSave={() => saveCategory(materials, "material")}
            saving={saving}
          />
        </TabsContent>

        {/* FINISHES TAB */}
        <TabsContent value="finishes">
          <SimpleOptionList
            items={finishes}
            onUpdate={(i, field, val) => updateRow(i, field, val, setFinishes)}
            onRemove={(i) => removeRow(i, finishes, setFinishes)}
            onAdd={() => addRow("finish", setFinishes, finishes)}
            onSave={() => saveCategory(finishes, "finish")}
            saving={saving}
          />
        </TabsContent>

        {/* THICKNESS PRESETS TAB */}
        <TabsContent value="thickness">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Define default thickness values per material. These will auto-fill
              when a user selects that material in the structure builder.
            </p>
            {thicknessPresets.map((row, index) => (
              <div
                key={row.id || `new-${index}`}
                className="flex items-end gap-2 flex-wrap"
              >
                <div className="flex-1 min-w-[140px] space-y-1">
                  <Label className="text-xs text-muted-foreground">Material</Label>
                  <Select
                    value={row.parent_material || ""}
                    onValueChange={(val) =>
                      updateRow(index, "parent_material", val, setThicknessPresets)
                    }
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialOptions.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={row.default_value ?? ""}
                    onChange={(e) =>
                      updateRow(
                        index,
                        "default_value",
                        parseFloat(e.target.value) || null,
                        setThicknessPresets
                      )
                    }
                    className="h-9"
                    placeholder="0"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs text-muted-foreground">Unit</Label>
                  <Select
                    value={row.default_unit || "gauge"}
                    onValueChange={(val) =>
                      updateRow(index, "default_unit", val, setThicknessPresets)
                    }
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gauge">Gauge</SelectItem>
                      <SelectItem value="microns">Microns</SelectItem>
                      <SelectItem value="mils">Mils</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pb-0.5">
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(val) =>
                      updateRow(index, "is_active", val, setThicknessPresets)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() =>
                      removeRow(index, thicknessPresets, setThicknessPresets)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addRow("thickness_preset", setThicknessPresets, thicknessPresets)
                }
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> Add Preset
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={() =>
                  saveCategory(thicknessPresets, "thickness_preset")
                }
                disabled={saving}
                className="gap-1"
              >
                <Save className="h-4 w-4" />{" "}
                {saving ? "Saving..." : "Save Presets"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* Reusable simple list for materials & finishes */
function SimpleOptionList({
  items,
  onUpdate,
  onRemove,
  onAdd,
  onSave,
  saving,
}: {
  items: OptionRow[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      {items.map((row, index) => (
        <div
          key={row.id || `new-${index}`}
          className="flex items-center gap-3"
        >
          <Input
            value={row.label}
            onChange={(e) => onUpdate(index, "label", e.target.value)}
            placeholder="Option name"
            className="h-9 flex-1"
          />
          <Input
            type="number"
            value={row.sort_order}
            onChange={(e) =>
              onUpdate(index, "sort_order", parseInt(e.target.value) || 0)
            }
            className="h-9 w-20"
            placeholder="Order"
          />
          <Switch
            checked={row.is_active}
            onCheckedChange={(val) => onUpdate(index, "is_active", val)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-3 mt-4">
        <Button variant="outline" size="sm" onClick={onAdd} className="gap-1">
          <Plus className="h-4 w-4" /> Add Option
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="gap-1"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All"}
        </Button>
      </div>
    </div>
  );
}

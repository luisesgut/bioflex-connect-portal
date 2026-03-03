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
  const [presets, setPresets] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedMats, setExpandedMats] = useState<Set<string>>(new Set());
  const [expandedFins, setExpandedFins] = useState<Set<string>>(new Set());

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("structure_layer_options")
      .select("*")
      .order("sort_order");
    if (error) { console.error(error); setLoading(false); return; }
    const all = (data || []) as OptionRow[];
    setMaterials(all.filter((r) => r.category === "material"));
    setFinishes(all.filter((r) => r.category === "finish"));
    setPresets(all.filter((r) => r.category === "thickness_preset"));
    setLoading(false);
  };

  const toggle = (key: string, set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const update = (idx: number, field: string, value: any, setter: React.Dispatch<React.SetStateAction<OptionRow[]>>) =>
    setter((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const remove = async (idx: number, list: OptionRow[], setter: React.Dispatch<React.SetStateAction<OptionRow[]>>) => {
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
    setMaterials((p) => [...p, { category: "material", label: "", density: null, sort_order: max + 1, is_active: true, isNew: true }]);
  };

  const addFinish = (parentMaterial: string) => {
    const siblings = finishes.filter((f) => f.parent_material === parentMaterial);
    const max = siblings.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setFinishes((p) => [...p, { category: "finish", label: "", parent_material: parentMaterial, sort_order: max + 1, is_active: true, isNew: true }]);
  };

  // Presets use parent_material = material name, label = finish name
  const addPreset = (materialName: string, finishLabel: string) => {
    const siblings = presets.filter((p) => p.parent_material === materialName && p.label === finishLabel);
    const max = siblings.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setPresets((p) => [...p, {
      category: "thickness_preset",
      label: finishLabel,
      parent_material: materialName,
      default_value: null,
      default_unit: "gauge",
      sort_order: max + 1,
      is_active: true,
      isNew: true,
    }]);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const row of [...materials, ...finishes, ...presets]) {
        const label = row.category === "thickness_preset" ? (row.label || row.parent_material || "") : row.label.trim();
        if (!label && row.category !== "thickness_preset") continue;

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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Structure Layer Options</h2>
          <p className="text-sm text-muted-foreground">
            Materials → Finishes → Thickness presets
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

      <div className="divide-y">
        {materials.map((mat, matIdx) => {
          const matKey = mat.id || `m-${matIdx}`;
          const matOpen = expandedMats.has(matKey);
          const matFinishes = finishes.filter((f) => f.parent_material === mat.label);

          return (
            <Collapsible key={matKey} open={matOpen} onOpenChange={() => toggle(matKey, expandedMats, setExpandedMats)}>
              {/* Material row */}
              <div className="grid grid-cols-[minmax(0,1fr)_100px_70px_50px_40px] gap-2 items-center py-2 px-2 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-1.5">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      {matOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <Input value={mat.label} onChange={(e) => update(matIdx, "label", e.target.value, setMaterials)} placeholder="Material" className="h-8" />
                </div>
                <Input type="number" step="0.01" value={mat.density ?? ""} onChange={(e) => update(matIdx, "density", parseFloat(e.target.value) || null, setMaterials)} placeholder="0.92" className="h-8" />
                <Input type="number" value={mat.sort_order} onChange={(e) => update(matIdx, "sort_order", parseInt(e.target.value) || 0, setMaterials)} className="h-8 text-center" />
                <div className="flex justify-center">
                  <Switch checked={mat.is_active} onCheckedChange={(val) => update(matIdx, "is_active", val, setMaterials)} />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(matIdx, materials, setMaterials)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Finishes under this material */}
              <CollapsibleContent>
                <div className="ml-8 pl-4 border-l-2 border-muted pb-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 mt-2">
                    Finishes
                  </p>
                  <div className="space-y-1">
                    {matFinishes.map((fin) => {
                      const fIdx = finishes.indexOf(fin);
                      const finKey = fin.id || `f-${fIdx}`;
                      const finOpen = expandedFins.has(finKey);
                      const finPresets = presets.filter(
                        (p) => p.parent_material === mat.label && p.label === fin.label
                      );

                      return (
                        <Collapsible key={finKey} open={finOpen} onOpenChange={() => toggle(finKey, expandedFins, setExpandedFins)}>
                          {/* Finish row */}
                          <div className="flex items-center gap-2 py-1">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
                                {finOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </Button>
                            </CollapsibleTrigger>
                            <Input value={fin.label} onChange={(e) => update(fIdx, "label", e.target.value, setFinishes)} placeholder="Finish name" className="h-7 flex-1 text-sm" />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {finPresets.length} preset{finPresets.length !== 1 ? "s" : ""}
                            </span>
                            <Switch checked={fin.is_active} onCheckedChange={(val) => update(fIdx, "is_active", val, setFinishes)} />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => remove(fIdx, finishes, setFinishes)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Thickness presets under this finish */}
                          <CollapsibleContent>
                            <div className="ml-7 pl-3 border-l border-muted/60 py-1 space-y-1">
                              {finPresets.map((preset) => {
                                const pIdx = presets.indexOf(preset);
                                return (
                                  <div key={preset.id || `p-${pIdx}`} className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={preset.default_value ?? ""}
                                      onChange={(e) => update(pIdx, "default_value", parseFloat(e.target.value) || null, setPresets)}
                                      placeholder="Value"
                                      className="h-7 w-20 text-sm"
                                    />
                                    <Select value={preset.default_unit || "gauge"} onValueChange={(val) => update(pIdx, "default_unit", val, setPresets)}>
                                      <SelectTrigger className="h-7 w-24 bg-background text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="gauge">Gauge</SelectItem>
                                        <SelectItem value="microns">Microns</SelectItem>
                                        <SelectItem value="mils">Mils</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Switch checked={preset.is_active} onCheckedChange={(val) => update(pIdx, "is_active", val, setPresets)} />
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => remove(pIdx, presets, setPresets)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                              {finPresets.length === 0 && (
                                <p className="text-[11px] text-muted-foreground italic">No presets — thickness entered manually</p>
                              )}
                              <Button variant="ghost" size="sm" className="gap-1 text-xs h-6" onClick={() => addPreset(mat.label, fin.label)}>
                                <Plus className="h-3 w-3" /> Add Thickness
                              </Button>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {matFinishes.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">No finishes configured</p>
                    )}
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => addFinish(mat.label)}>
                      <Plus className="h-3 w-3" /> Add Finish
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

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

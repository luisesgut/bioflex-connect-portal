import { useEffect, useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface StructureLayer {
  id: string;
  material: string;
  finish: string;
  thickness_value: string;
  thickness_unit: string; // gauge | microns | mils
  print_side: string; // external | internal | both | none
}

interface StructureLayersInputProps {
  layers: StructureLayer[];
  onChange: (layers: StructureLayer[]) => void;
  productType: string;
}

interface ThicknessPreset {
  parent_material: string;
  default_value: number;
  default_unit: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function createEmptyLayer(): StructureLayer {
  return {
    id: generateId(),
    material: "",
    finish: "",
    thickness_value: "",
    thickness_unit: "gauge",
    print_side: "",
  };
}

/** Convert layers array to a structure string for DB storage */
export function layersToStructureString(layers: StructureLayer[]): string {
  return layers
    .filter((l) => l.material)
    .map((l) => {
      const unitLabel =
        l.thickness_unit === "gauge"
          ? "ga"
          : l.thickness_unit === "microns"
          ? "μm"
          : "mil";
      const thicknessPart = l.thickness_value
        ? ` ${l.thickness_value}${unitLabel}`
        : "";
      const finishPart = l.finish ? ` (${l.finish})` : "";
      return `${l.material}${thicknessPart}${finishPart}`;
    })
    .join(" / ");
}

function getMaxLayers(productType: string): number {
  const pt = productType.toLowerCase();
  const isBag =
    pt.includes("wicket") ||
    pt.includes("zipper") ||
    pt.includes("no wicket") ||
    pt.includes("sello") ||
    pt.includes("side seal");
  if (isBag) return 2;
  return 10;
}

// Fallbacks if DB is empty
const FALLBACK_MATERIALS = [
  "LDPE","LLDPE","HDPE","PP","CPP","BOPP","PET","BOPET","PA","Nylon",
  "EVA","Metallized PET","Metallized BOPP","Aluminum Foil","Paper","Other",
];
const FALLBACK_FINISHES = [
  "Natural","White","Pigmented","Metallic","Matte","Glossy","Satin",
];

export function StructureLayersInput({
  layers,
  onChange,
  productType,
}: StructureLayersInputProps) {
  const maxLayers = getMaxLayers(productType);
  const [materials, setMaterials] = useState<string[]>(FALLBACK_MATERIALS);
  const [finishes, setFinishes] = useState<string[]>(FALLBACK_FINISHES);
  const [thicknessPresets, setThicknessPresets] = useState<ThicknessPreset[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      const { data } = await supabase
        .from("structure_layer_options")
        .select("category, label, parent_material, default_value, default_unit")
        .eq("is_active", true)
        .order("sort_order");

      if (data && data.length > 0) {
        const mats = data.filter((d) => d.category === "material").map((d) => d.label);
        const fins = data.filter((d) => d.category === "finish").map((d) => d.label);
        const presets = data
          .filter((d) => d.category === "thickness_preset" && d.parent_material && d.default_value)
          .map((d) => ({
            parent_material: d.parent_material!,
            default_value: d.default_value!,
            default_unit: d.default_unit || "gauge",
          }));

        if (mats.length > 0) setMaterials(mats);
        if (fins.length > 0) setFinishes(fins);
        setThicknessPresets(presets);
      }
    };
    fetchOptions();
  }, []);

  const updateLayer = (id: string, updates: Partial<StructureLayer>) => {
    const newLayers = layers.map((l) => {
      if (l.id !== id) return l;
      const updated = { ...l, ...updates };

      // Auto-fill thickness from preset when material changes
      if (updates.material && thicknessPresets.length > 0) {
        const preset = thicknessPresets.find(
          (p) => p.parent_material === updates.material
        );
        if (preset) {
          updated.thickness_value = String(preset.default_value);
          updated.thickness_unit = preset.default_unit;
        }
      }

      return updated;
    });
    onChange(newLayers);
  };

  const addLayer = () => {
    if (layers.length >= maxLayers) return;
    onChange([...layers, createEmptyLayer()]);
  };

  const removeLayer = (id: string) => {
    if (layers.length <= 1) return;
    onChange(layers.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Structure Layers
        </Label>
        <span className="text-xs text-muted-foreground">
          {layers.length} / {maxLayers} layers
        </span>
      </div>

      <div className="space-y-2">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30"
          >
            <span className="text-xs text-muted-foreground mt-2.5 w-5 shrink-0 font-semibold">
              {index + 1}.
            </span>

            <div className="flex-1 grid gap-2 sm:grid-cols-4">
              {/* Material */}
              <div className="space-y-1">
                <Label className="text-xs">Material</Label>
                <Select
                  value={layer.material}
                  onValueChange={(val) => updateLayer(layer.id, { material: val })}
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((mat) => (
                      <SelectItem key={mat} value={mat}>
                        {mat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Finish */}
              <div className="space-y-1">
                <Label className="text-xs">Finish</Label>
                <Select
                  value={layer.finish}
                  onValueChange={(val) => updateLayer(layer.id, { finish: val })}
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {finishes.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thickness */}
              <div className="space-y-1">
                <Label className="text-xs">Thickness</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={layer.thickness_value}
                    onChange={(e) =>
                      updateLayer(layer.id, { thickness_value: e.target.value })
                    }
                    placeholder="0"
                    className="h-9 flex-1"
                  />
                  <Select
                    value={layer.thickness_unit}
                    onValueChange={(val) =>
                      updateLayer(layer.id, { thickness_unit: val })
                    }
                  >
                    <SelectTrigger className="h-9 w-24 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gauge">Gauge</SelectItem>
                      <SelectItem value="microns">Microns</SelectItem>
                      <SelectItem value="mils">Mils</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Print Side - only on first layer */}
              {index === 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Print Side</Label>
                  <Select
                    value={layer.print_side}
                    onValueChange={(val) => updateLayer(layer.id, { print_side: val })}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external">External (Front)</SelectItem>
                      <SelectItem value="internal">Internal (Reverse)</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="none">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {layers.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 mt-6"
                onClick={() => removeLayer(layer.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {layers.length < maxLayers && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLayer}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Layer
        </Button>
      )}
    </div>
  );
}

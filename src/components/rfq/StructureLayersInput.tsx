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

const MATERIALS = [
  "LDPE",
  "LLDPE",
  "HDPE",
  "PP",
  "CPP",
  "BOPP",
  "PET",
  "BOPET",
  "PA",
  "Nylon",
  "EVA",
  "Metallized PET",
  "Metallized BOPP",
  "Aluminum Foil",
  "Paper",
  "Other",
] as const;

const FINISHES = [
  "Natural",
  "White",
  "Pigmented",
  "Metallic",
  "Matte",
  "Glossy",
  "Satin",
] as const;

export interface StructureLayer {
  id: string;
  material: string;
  finish: string;
  thickness_value: string;
  thickness_unit: string; // gauge | microns | mils
}

interface StructureLayersInputProps {
  layers: StructureLayer[];
  onChange: (layers: StructureLayer[]) => void;
  productType: string; // to determine max layers
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
  };
}

/** Convert layers array to a structure string for DB storage */
export function layersToStructureString(layers: StructureLayer[]): string {
  return layers
    .filter((l) => l.material)
    .map((l) => {
      const unitLabel =
        l.thickness_unit === "gauge" ? "ga" : l.thickness_unit === "microns" ? "μm" : "mil";
      const thicknessPart = l.thickness_value ? ` ${l.thickness_value}${unitLabel}` : "";
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
  // Film, Pouch, etc. — unlimited (practical max 10)
  return 10;
}

export function StructureLayersInput({
  layers,
  onChange,
  productType,
}: StructureLayersInputProps) {
  const maxLayers = getMaxLayers(productType);

  const updateLayer = (id: string, updates: Partial<StructureLayer>) => {
    onChange(layers.map((l) => (l.id === id ? { ...l, ...updates } : l)));
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
                    {MATERIALS.map((mat) => (
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
                    {FINISHES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thickness */}
              <div className="space-y-1 sm:col-span-2">
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

import { useState } from "react";
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
import { cn } from "@/lib/utils";

// Common materials used in packaging
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

interface MaterialLayer {
  id: string;
  material: string;
  thickness: string;
  unit: "gauge" | "microns";
}

interface MaterialStructureInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Parse structure string back to layers (e.g., "PET 12μm / CPP 30μm" -> layers)
function parseStructure(structure: string): MaterialLayer[] {
  if (!structure) {
    return [{ id: generateId(), material: "", thickness: "", unit: "microns" }];
  }

  const parts = structure.split(" / ").map((p) => p.trim());
  const layers: MaterialLayer[] = [];

  for (const part of parts) {
    // Match patterns like "PET 12μm", "LDPE 150ga", "PET 12", etc.
    const match = part.match(/^(\w+(?:\s+\w+)?)\s+(\d+(?:\.\d+)?)\s*(μm|ga)?$/i);
    if (match) {
      const [, material, thickness, unitStr] = match;
      const unit = unitStr?.toLowerCase() === "ga" ? "gauge" : "microns";
      layers.push({ id: generateId(), material, thickness, unit });
    } else {
      // If can't parse, just use the whole thing as material
      layers.push({ id: generateId(), material: part, thickness: "", unit: "microns" });
    }
  }

  if (layers.length === 0) {
    return [{ id: generateId(), material: "", thickness: "", unit: "microns" }];
  }

  return layers;
}

// Convert layers to structure string
function layersToStructure(layers: MaterialLayer[]): string {
  return layers
    .filter((l) => l.material && l.thickness)
    .map((l) => {
      const unitStr = l.unit === "gauge" ? "ga" : "μm";
      return `${l.material} ${l.thickness}${unitStr}`;
    })
    .join(" / ");
}

export function MaterialStructureInput({
  value,
  onChange,
  className,
  label = "Material Structure",
}: MaterialStructureInputProps) {
  const [layers, setLayers] = useState<MaterialLayer[]>(() => parseStructure(value));

  const updateLayers = (newLayers: MaterialLayer[]) => {
    setLayers(newLayers);
    onChange(layersToStructure(newLayers));
  };

  const addLayer = () => {
    updateLayers([...layers, { id: generateId(), material: "", thickness: "", unit: "microns" }]);
  };

  const removeLayer = (id: string) => {
    if (layers.length > 1) {
      updateLayers(layers.filter((l) => l.id !== id));
    }
  };

  const updateLayer = (id: string, updates: Partial<MaterialLayer>) => {
    updateLayers(
      layers.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>{label}</Label>
      
      <div className="space-y-2">
        {layers.map((layer, index) => (
          <div key={layer.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-6 shrink-0">
              {index + 1}.
            </span>
            
            <Select
              value={layer.material}
              onValueChange={(val) => updateLayer(layer.id, { material: val })}
            >
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {MATERIALS.map((mat) => (
                  <SelectItem key={mat} value={mat}>
                    {mat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 max-w-[120px]">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={layer.thickness}
                onChange={(e) => updateLayer(layer.id, { thickness: e.target.value })}
                placeholder="Thickness"
                className="pr-14"
              />
              <select
                value={layer.unit}
                onChange={(e) =>
                  updateLayer(layer.id, { unit: e.target.value as "gauge" | "microns" })
                }
                className="absolute right-1 top-1/2 -translate-y-1/2 text-xs bg-transparent border-0 focus:ring-0 cursor-pointer text-muted-foreground"
              >
                <option value="gauge">ga</option>
                <option value="microns">μm</option>
              </select>
            </div>

            {layers.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeLayer(layer.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

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

      {value && (
        <p className="text-xs text-muted-foreground">
          Structure: <span className="font-mono">{value}</span>
        </p>
      )}
    </div>
  );
}

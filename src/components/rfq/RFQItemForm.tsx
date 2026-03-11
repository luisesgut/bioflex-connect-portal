import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileText, Plus, Trash2, Upload, X, ChevronDown, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  StructureLayersInput,
  type StructureLayer,
  createEmptyLayer,
  layersToStructureString,
} from "@/components/rfq/StructureLayersInput";

export interface VolumeData {
  volume_quantity: string;
  unit: string;
  notes: string;
}

export interface RFQItemData {
  // Section 1 - Product Information
  product_name: string;
  product_type: string;
  item_code: string;
  dp_sales_csr_names: string[];

  // Section 2 - Dimensions & Structure
  width: string;
  length: string;
  thickness_value: string;
  thickness_unit: string;
  structure: string;
  material: string;
  structure_layers: StructureLayer[];
  seal_type: string;
  gusset: string;
  zipper: string;
  lip_front: string;
  lip_back: string;
  flip_size: string;
  flip_position: string;
  film_type: string;
  finish: string;
  printing_side: string;
  ink_type: string;
  perforations: string;
  perforation_size: string;
  pre_cut_wicket: boolean;
  pre_cut_dotted: boolean;
  wicket_separation: string;
  zipper_header: boolean;
  tear_top: boolean;
  wicket_less: boolean;
  vents_across: string;
  vents_down: string;
  slits_above_wicket: boolean;
  land_area: string;
  wicket_position: string;
  rubber_bands: boolean;
  front_chipboard: string;
  back_chipboard: string;
  wicket_wire_end: string;
  wicket_wire_gauge: string;
  rubber_washers: boolean;
  extrusion_type: string;
  clarity_grade: string;
  // Printing section
  number_of_colors: string;
  // Film-specific fields
  core_size_inches: string;
  max_splices_per_roll: string;
  weight_kg_per_roll: string;
  core_plug: boolean;
  prints_per_roll: string;
  meters_per_roll: string;
  diameter_per_roll: string;

  // Section 3 - Packaging & Shipping Format
  wicket_hole: string;
  wicket_size: string;
  wicket_type: string;
  wire_type: string;
  vent_size: string;
  vents_count: string;
  bags_per_wicket: string;
  bags_per_case: string;
  cases_per_pallet: string;
  pallet_dimensions: string;
  max_pallet_height: string;
  pieces_per_wicket: string;
  pieces_per_case: string;
  wickets_per_case: string;
  rolls_per_floor: string;
  floors_per_pallet: string;
  cornerboards: boolean;
  heat_treated: boolean;
  pallet_covers: boolean;
  poly_wrap: boolean;
  four_way_strap: boolean;
  box_size: string;
  box_color: string;

  // Section 4 - Complementary Info
  pantone_base: boolean;
  sample_base: boolean;
  client_visit: boolean;
  color_proof: boolean;
  editable_files_needed: boolean;
  physical_samples_needed: boolean;
  prepress_cost_by: string;
  observations: string;
  notes: string;
  reference_files: File[];

  // Section 5 - Volumes
  volumes: VolumeData[];
}

export interface ProductTypeOption {
  value: string;
  label: string;
}

interface RFQItemFormProps {
  data: RFQItemData;
  onChange: (data: RFQItemData) => void;
  productTypes: ProductTypeOption[];
  dpContacts: { label: string }[];
}

// Conversion helpers
const IN_TO_MM = 25.4;
const toMm = (inches: string) => {
  const n = parseFloat(inches);
  return isNaN(n) ? "" : (n * IN_TO_MM).toFixed(2);
};
const toIn = (mm: string) => {
  const n = parseFloat(mm);
  return isNaN(n) ? "" : (n / IN_TO_MM).toFixed(4);
};
// --- Metric helpers for roll calculations ---

/** Convert a layer's thickness value to microns based on its unit */
const toMicrons = (value: number, unit: string): number => {
  if (unit === "micron" || unit === "microns") return value;
  if (unit === "mil" || unit === "mils") return value * 25.4;
  // gauge: 1 gauge = 0.254 microns (100 gauge = 1 mil = 25.4 µm)
  return value * 0.254;
};

/** Map nominal core size (inner diameter in inches) to outer diameter in mm.
 *  Standard paper cores have wall thickness ~6mm per side. */
const CORE_OD_MM: Record<string, number> = {
  "3": 88,   // 3" ID → ~88mm OD
  "5": 139,  // 5" ID → ~139mm OD (5*25.4 + 12)
  "6": 165,  // 6" ID → ~165mm OD
};
const getCoreOdMm = (coreSizeInches: string): number => {
  return CORE_OD_MM[coreSizeInches] ?? (Number(coreSizeInches) * IN_TO_MM + 12);
};

/** Sum total thickness in mm across all structure layers */
const getTotalThicknessMm = (layers: StructureLayer[]): number => {
  return layers.reduce((sum, l) => {
    const v = Number(l.thickness_value);
    if (!v || v <= 0) return sum;
    return sum + toMicrons(v, l.thickness_unit || "gauge") / 1000;
  }, 0);
};

/** Gramaje Total (g/m²) = Σ(thickness_µm × density_g_cm3) + adhesive */
const getGramajeTotal = (
  layers: StructureLayer[],
  densityMap: Record<string, number>,
  adhesiveGsm: number = 2.0,
): number => {
  const layerGsm = layers.reduce((sum, l) => {
    const v = Number(l.thickness_value);
    if (!v || v <= 0) return sum;
    const microns = toMicrons(v, l.thickness_unit || "gauge");
    const density = densityMap[l.material] ?? 0.92; // fallback LDPE
    return sum + microns * density;
  }, 0);
  // Each lamination bond between layers adds adhesive weight
  const laminationJoints = layers.length > 1 ? layers.length - 1 : 0;
  return layerGsm + laminationJoints * adhesiveGsm;
};

interface RollCalcResult {
  diameterMm: number | null;
  weightKg: number | null;
}

/** Calculate roll diameter (mm) and net weight (kg) using proper formulas */
const calcRollDimensions = (
  metersPerRoll: number,
  widthMm: number,
  layers: StructureLayer[],
  densityMap: Record<string, number>,
  coreDiaMm: number,
): RollCalcResult => {
  const thicknessMm = getTotalThicknessMm(layers);
  const gramaje = getGramajeTotal(layers, densityMap);

  let diameterMm: number | null = null;
  if (thicknessMm > 0 && metersPerRoll > 0) {
    const metrajeMm = metersPerRoll * 1000;
    diameterMm = Math.sqrt((4 * metrajeMm * thicknessMm) / Math.PI + coreDiaMm * coreDiaMm);
  }

  let weightKg: number | null = null;
  if (gramaje > 0 && widthMm > 0 && metersPerRoll > 0) {
    const widthM = widthMm / 1000;
    weightKg = (widthM * metersPerRoll * gramaje) / 1000;
  }

  return { diameterMm, weightKg };
};

function MeasureField({
  label,
  value,
  onChange,
  unit,
  placeholder = "0.00",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: "in" | "mm";
  placeholder?: string;
}) {
  const converted = unit === "in" ? toMm(value) : toIn(value);
  const otherUnit = unit === "in" ? "mm" : "in";

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || parseFloat(val) >= 0) onChange(val);
            }}
            placeholder={placeholder}
            className="pr-8"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        </div>
        <div className="relative w-20">
          <Input
            type="text"
            value={converted}
            disabled
            className="bg-muted pr-8 text-muted-foreground text-xs"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {otherUnit}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  number,
  open,
}: {
  title: string;
  number: number;
  open: boolean;
}) {
  return (
    <CollapsibleTrigger className="flex w-full items-center gap-3 py-3 hover:bg-muted/30 rounded-lg px-3 transition-colors">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
        {number}
      </div>
      <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex-1 text-left">
        {title}
      </span>
      <ChevronDown
        className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
      />
    </CollapsibleTrigger>
  );
}

export function RFQItemForm({ data, onChange, productTypes, dpContacts }: RFQItemFormProps) {
  const [measureUnit, setMeasureUnit] = useState<"in" | "mm">("in");
  const [openSections, setOpenSections] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [materialDensityMap, setMaterialDensityMap] = useState<Record<string, number>>({});

  // Fetch material densities from structure_layer_options
  useEffect(() => {
    const fetchDensities = async () => {
      const { data: opts } = await supabase
        .from("structure_layer_options")
        .select("label, density")
        .eq("category", "material")
        .eq("is_active", true);
      if (opts) {
        const map: Record<string, number> = {};
        for (const o of opts) {
          if (o.label && o.density) map[o.label] = o.density;
        }
        setMaterialDensityMap(map);
      }
    };
    fetchDensities();
  }, []);

  const update = (partial: Partial<RFQItemData>) => onChange({ ...data, ...partial });

  /** Compute diameter & weight and merge into updates object */
  const computeRollUpdates = useCallback(
    (metersPerRoll: number, currentData: RFQItemData): Partial<RFQItemData> => {
      const widthVal = Number(currentData.width);
      // Width is always in the current measureUnit
      const widthMm = measureUnit === "in" ? widthVal * IN_TO_MM : widthVal;
      const coreSizeStr = currentData.core_size_inches || "3";
      const coreDiaMm = getCoreOdMm(coreSizeStr);

      const { diameterMm, weightKg } = calcRollDimensions(
        metersPerRoll,
        widthMm,
        currentData.structure_layers,
        materialDensityMap,
        coreDiaMm,
      );

      const result: Partial<RFQItemData> = {};
      if (diameterMm !== null) {
        result.diameter_per_roll = String(Math.round(diameterMm * 100) / 100);
      }
      if (weightKg !== null) {
        result.weight_kg_per_roll = String(Math.round(weightKg * 100) / 100);
      }
      return result;
    },
    [measureUnit, materialDensityMap],
  );

  const toggleSection = (n: number) => {
    setOpenSections((prev) =>
      prev.includes(n) ? prev.filter((s) => s !== n) : [...prev, n]
    );
  };

  const updateVolume = (index: number, partial: Partial<VolumeData>) => {
    const volumes = data.volumes.map((v, i) => (i === index ? { ...v, ...partial } : v));
    update({ volumes });
  };

  const addVolume = () => {
    update({ volumes: [...data.volumes, { volume_quantity: "", unit: "MIL", notes: "" }] });
  };

  const removeVolume = (index: number) => {
    if (data.volumes.length <= 1) return;
    update({ volumes: data.volumes.filter((_, i) => i !== index) });
  };

  // Auto-recalculate roll dimensions when structure, core, or width changes
  const isFilmForEffect = data.product_type.toLowerCase().includes("film") || data.product_type.toLowerCase().includes("bobina");
  const layersJson = JSON.stringify(data.structure_layers);
  useEffect(() => {
    if (!isFilmForEffect) return;
    const meters = Number(data.meters_per_roll);
    if (!meters || meters <= 0) return;

    const updates = computeRollUpdates(meters, data);
    if (
      updates.diameter_per_roll !== data.diameter_per_roll ||
      updates.weight_kg_per_roll !== data.weight_kg_per_roll
    ) {
      onChange({ ...data, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersJson, data.core_size_inches, data.width, measureUnit, computeRollUpdates]);

  // Dynamic field visibility based on product type
  const pt = data.product_type.toLowerCase();
  const isWicket = pt.includes("wicket");
  const isPouch = pt.includes("pouch") || pt.includes("stand");
  const isSideSeal = pt.includes("side seal") || pt.includes("sello lateral");
  const isFilm = pt.includes("film") || pt.includes("bobina");
  const isBag = isWicket || isPouch || isSideSeal || pt.includes("bolsa");

  const showGusset = isWicket || isPouch || isBag;
  const showZipper = isPouch || isSideSeal;
  const showLips = isPouch || isSideSeal;
  const showFlip = isPouch;
  const showWicketFields = isWicket;
  const showVents = isWicket;

  // For the measurement field, handle conversion when unit changes
  const handleUnitToggle = () => {
    setMeasureUnit((prev) => (prev === "in" ? "mm" : "in"));
  };

  return (
    <div className="space-y-2">

      {/* ═══════════ SECTION 1: Product Information ═══════════ */}
      <Collapsible open={openSections.includes(1)} onOpenChange={() => toggleSection(1)}>
        <SectionHeader title="Product Information" number={1} open={openSections.includes(1)} />
        <CollapsibleContent>
          <div className="px-3 pb-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Item Code</Label>
                <Input
                  value={data.item_code}
                  onChange={(e) => update({ item_code: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Item Description *</Label>
                <Input
                  value={data.product_name}
                  onChange={(e) => update({ product_name: e.target.value })}
                  placeholder="e.g., 61370-17 TA Romaine Hearts 3 Count"
                />
              </div>
              <div className="space-y-2">
                <Label>Item Type *</Label>
                <Select value={data.product_type} onValueChange={(v) => update({ product_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DP Sales/CSR Name</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-10">
                      <span className="truncate text-sm">
                        {data.dp_sales_csr_names.length > 0
                          ? data.dp_sales_csr_names.join(", ")
                          : "Select contacts..."}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {dpContacts.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">No contacts available</p>
                      )}
                      {dpContacts.map((c) => (
                        <label
                          key={c.label}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={data.dp_sales_csr_names.includes(c.label)}
                            onCheckedChange={(checked) => {
                              const names = checked
                                ? [...data.dp_sales_csr_names, c.label]
                                : data.dp_sales_csr_names.filter((n) => n !== c.label);
                              update({ dp_sales_csr_names: names });
                            }}
                          />
                          <span className="text-sm">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 2: Dimensions & Structure ═══════════ */}
      <Collapsible open={openSections.includes(2)} onOpenChange={() => toggleSection(2)}>
        <SectionHeader title="Dimensions & Structure" number={2} open={openSections.includes(2)} />
        <CollapsibleContent>
          {!data.product_type ? (
            <div className="px-3 pb-4 pt-2">
              <p className="text-sm text-muted-foreground italic">Select an Item Type first to configure dimensions & structure.</p>
            </div>
          ) : (
          <div className="px-3 pb-4 pt-2 space-y-4">
            {/* Unit toggle */}
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <Button
                  variant={measureUnit === "in" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setMeasureUnit("in")}
                >
                  Inches
                </Button>
                <Button
                  variant={measureUnit === "mm" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setMeasureUnit("mm")}
                >
                  mm
                </Button>
              </div>
            </div>
            {/* Core dimensions */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MeasureField label="Width" value={data.width} onChange={(v) => update({ width: v })} unit={measureUnit} />
              <MeasureField label="Length / Height" value={data.length} onChange={(v) => update({ length: v })} unit={measureUnit} />
              {showGusset && (
                <MeasureField label="Bottom Gusset" value={data.gusset} onChange={(v) => update({ gusset: v })} unit={measureUnit} />
              )}
              {isBag && !isFilm && (
                <>
                  <MeasureField label="Back Flip" value={data.lip_front} onChange={(v) => update({ lip_front: v })} unit={measureUnit} />
                  <MeasureField label="Lip / Flap" value={data.lip_back} onChange={(v) => update({ lip_back: v })} unit={measureUnit} />
                </>
              )}
              {showZipper && (
                <MeasureField label="Zipper" value={data.zipper} onChange={(v) => update({ zipper: v })} unit={measureUnit} />
              )}
              {showLips && (
                <>
                  <MeasureField label="Lip Front" value={data.lip_front} onChange={(v) => update({ lip_front: v })} unit={measureUnit} />
                  <MeasureField label="Lip Back" value={data.lip_back} onChange={(v) => update({ lip_back: v })} unit={measureUnit} />
                </>
              )}
            </div>

            {/* Structure Layers */}
            <StructureLayersInput
              layers={data.structure_layers}
              onChange={(layers) => update({ structure_layers: layers })}
              productType={data.product_type}
            />
          </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 3: Printing ═══════════ */}
      <Collapsible open={openSections.includes(3)} onOpenChange={() => toggleSection(3)}>
        <SectionHeader title="Printing" number={3} open={openSections.includes(3)} />
        <CollapsibleContent>
          {!data.product_type ? (
            <div className="px-3 pb-4 pt-2">
              <p className="text-sm text-muted-foreground italic">Select an Item Type first to configure printing.</p>
            </div>
          ) : (
          <div className="px-3 pb-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Number of Colors</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={data.number_of_colors}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (Number.isInteger(Number(val)) && Number(val) >= 0)) update({ number_of_colors: val });
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ink Type</Label>
                <Select value={data.ink_type} onValueChange={(v) => update({ ink_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lamination">Lamination</SelectItem>
                    <SelectItem value="front_varnish">Front + Varnish</SelectItem>
                    <SelectItem value="thermo_resistant">Thermo-resistant Front</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="na">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isFilm ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Winding Direction</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-primary transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <img src="/images/winding-directions.png" alt="Winding direction reference FIG 1-8" className="w-full rounded-md" />
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal h-14">
                        {data.printing_side ? (
                          <span className="flex items-center gap-2">
                            <img src={`/images/winding-fig${data.printing_side.replace('fig', '')}.png`} alt="" className="h-11 object-contain" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select</span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-3" align="start">
                      <div className="grid grid-cols-2 gap-2">
                        {[1,2,3,4,5,6,7,8].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => update({ printing_side: `fig${n}` })}
                            className={cn(
                              "flex items-center justify-center p-2 rounded-md hover:bg-muted cursor-pointer transition-colors border border-transparent",
                              data.printing_side === `fig${n}` && "bg-accent text-accent-foreground border-primary"
                            )}
                          >
                            <img src={`/images/winding-fig${n}.png`} alt={`FIG ${n}`} className="h-20 object-contain" />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : !isWicket ? (
                <div className="space-y-1">
                  <Label className="text-xs">Printing Side</Label>
                  <Select value={data.printing_side} onValueChange={(v) => update({ printing_side: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inside">Inside</SelectItem>
                      <SelectItem value="outside">Outside</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="none">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 4: Complementos ═══════════ */}
      <Collapsible open={openSections.includes(4)} onOpenChange={() => toggleSection(4)}>
        <SectionHeader title="Complements" number={4} open={openSections.includes(4)} />
        <CollapsibleContent>
          {!data.product_type ? (
            <div className="px-3 pb-4 pt-2">
              <p className="text-sm text-muted-foreground italic">Select an Item Type first to configure complements.</p>
            </div>
          ) : (
          <div className="px-3 pb-4 pt-2 space-y-4">
            {/* Film & Printing */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {!isWicket && !isFilm && (
                <div className="space-y-1">
                  <Label className="text-xs">Film Type</Label>
                  <Input value={data.film_type} onChange={(e) => update({ film_type: e.target.value })} placeholder="e.g., LDPE" />
                </div>
              )}
              {isWicket ? (
                <div className="space-y-1">
                  <Label className="text-xs">Seal Type</Label>
                  <Input value="Side Seal" disabled className="bg-muted text-muted-foreground" />
                </div>
              ) : !isFilm ? (
                <div className="space-y-1">
                  <Label className="text-xs">Seal Type</Label>
                  <Input value={data.seal_type} onChange={(e) => update({ seal_type: e.target.value })} placeholder="Seal type" />
                </div>
              ) : null}
            </div>

            {/* Film-specific roll fields */}
            {isFilm && (
              <div className="space-y-4 mt-3">
                {/* Row 1: Core, Max Splices, Core Plug */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Roll Specifications</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Core (in)</Label>
                      <Select value={data.core_size_inches} onValueChange={(v) => update({ core_size_inches: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3"</SelectItem>
                          <SelectItem value="5">5"</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Splices per Roll</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={data.max_splices_per_roll}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || (Number.isInteger(Number(val)) && Number(val) >= 0)) update({ max_splices_per_roll: val });
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Checkbox checked={data.core_plug} onCheckedChange={(c) => update({ core_plug: !!c })} />
                      <Label className="text-xs">Core Plug</Label>
                    </div>
                  </div>
                </div>

                {/* Row 2: Impressions, Inches/Meters, Diameter, Weight — with auto-fill */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Roll Dimensions</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Impressions per Roll</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={data.prints_per_roll}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || (Number.isInteger(Number(val)) && Number(val) >= 0)) {
                            const updates: Partial<RFQItemData> = { prints_per_roll: val };
                            const impressions = Number(val);
                            const repeatLength = Number(data.length);
                            if (impressions > 0 && repeatLength > 0) {
                              // When in mm mode, length is in mm → divide by 1000 to get meters
                              // When in inches mode, length is in inches → convert to meters
                              const totalMeters = measureUnit === "in"
                                ? impressions * repeatLength * IN_TO_MM / 1000
                                : (impressions * repeatLength) / 1000;
                              updates.meters_per_roll = String(Math.round(totalMeters * 100) / 100);
                              Object.assign(updates, computeRollUpdates(totalMeters, data));
                            }
                            update(updates);
                          }
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Meters per Roll</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={data.meters_per_roll}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || Number(val) >= 0) {
                            const updates: Partial<RFQItemData> = { meters_per_roll: val };
                            const totalMeters = Number(val);
                            if (totalMeters > 0 && !data.prints_per_roll) {
                              Object.assign(updates, computeRollUpdates(totalMeters, data));
                            }
                            update(updates);
                          }
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Roll Diameter (mm)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={data.diameter_per_roll}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || Number(val) >= 0) update({ diameter_per_roll: val });
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Weight per Roll (kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={data.weight_kg_per_roll}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || Number(val) >= 0) update({ weight_kg_per_roll: val });
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Perforation Type - separate */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Perforations</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Perforation Type</Label>
                      <Select value={data.perforations} onValueChange={(v) => update({ perforations: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="laser">Laser</SelectItem>
                          <SelectItem value="macro_4mm">Macroperforated 4mm (5/32")</SelectItem>
                          <SelectItem value="macro_6mm">Macroperforated 6mm (1/4")</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showWicketFields && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Elements</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {parseFloat(data.lip_front) > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Flip Position</Label>
                      <Select value={data.flip_position} onValueChange={(v) => update({ flip_position: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="na">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.zipper_header} onCheckedChange={(c) => update({ zipper_header: !!c })} />
                    <Label className="text-xs">Zipper Header</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.tear_top} onCheckedChange={(c) => update({ tear_top: !!c })} />
                    <Label className="text-xs">Tear Top</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.wicket_less} onCheckedChange={(c) => update({ wicket_less: !!c })} />
                    <Label className="text-xs">Wicket-less</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.pre_cut_wicket} onCheckedChange={(c) => update({ pre_cut_wicket: !!c })} />
                    <Label className="text-xs">Pre-cut Wicket</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.pre_cut_dotted} onCheckedChange={(c) => update({ pre_cut_dotted: !!c })} />
                    <Label className="text-xs">Pre-cut Dotted on Flap</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Perforations</Label>
                    <Input value={data.perforations} onChange={(e) => update({ perforations: e.target.value })} placeholder="e.g., Yes - 6mm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Separation</Label>
                    <Input value={data.wicket_separation} onChange={(e) => update({ wicket_separation: e.target.value })} placeholder='e.g., 6"' />
                  </div>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Vents</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Vent Size</Label>
                    <Input value={data.vent_size} onChange={(e) => update({ vent_size: e.target.value })} placeholder='e.g., 1/4"' />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Across</Label>
                    <Input value={data.vents_across} onChange={(e) => update({ vents_across: e.target.value })} placeholder="e.g., See PDF" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Down</Label>
                    <Input value={data.vents_down} onChange={(e) => update({ vents_down: e.target.value })} placeholder="e.g., See PDF" />
                  </div>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Wicket Details</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Hole</Label>
                    <Input value={data.wicket_hole} onChange={(e) => update({ wicket_hole: e.target.value })} placeholder='e.g., 5/8"' />
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.slits_above_wicket} onCheckedChange={(c) => update({ slits_above_wicket: !!c })} />
                    <Label className="text-xs">Slits Above Wicket</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Land Area</Label>
                    <Input value={data.land_area} onChange={(e) => update({ land_area: e.target.value })} placeholder='e.g., 1/2"' />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Position</Label>
                    <Select value={data.wicket_position} onValueChange={(v) => update({ wicket_position: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="centered">Centered</SelectItem>
                        <SelectItem value="offset">Offset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Size</Label>
                    <Input value={data.wicket_size} onChange={(e) => update({ wicket_size: e.target.value })} placeholder="e.g., Standard" />
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.rubber_bands} onCheckedChange={(c) => update({ rubber_bands: !!c })} />
                    <Label className="text-xs">Rubber Bands</Label>
                  </div>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Chipboard & Wire</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Front Chipboard</Label>
                    <Input value={data.front_chipboard} onChange={(e) => update({ front_chipboard: e.target.value })} placeholder="e.g., 1.25 x 9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Back Chipboard</Label>
                    <Input value={data.back_chipboard} onChange={(e) => update({ back_chipboard: e.target.value })} placeholder="e.g., 13 x 9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Wire End</Label>
                    <Select value={data.wicket_wire_end} onValueChange={(v) => update({ wicket_wire_end: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ball">Ball</SelectItem>
                        <SelectItem value="straight">Straight</SelectItem>
                        <SelectItem value="loop">Loop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Wire Gauge</Label>
                    <Input value={data.wicket_wire_gauge} onChange={(e) => update({ wicket_wire_gauge: e.target.value })} placeholder="e.g., 10 gauge" />
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.rubber_washers} onCheckedChange={(c) => update({ rubber_washers: !!c })} />
                    <Label className="text-xs">Rubber Washers</Label>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 5: Packaging & Packing ═══════════ */}
      <Collapsible open={openSections.includes(5)} onOpenChange={() => toggleSection(5)}>
        <SectionHeader title="Packaging & Shipping Format" number={5} open={openSections.includes(5)} />
        <CollapsibleContent>
          {!data.product_type ? (
            <div className="px-3 pb-4 pt-2">
              <p className="text-sm text-muted-foreground italic">Select an Item Type first to configure packaging & shipping format.</p>
            </div>
          ) : (
          <div className="px-3 pb-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {showWicketFields && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Bags / Cs / Rl</Label>
                    <Input type="number" value={data.pieces_per_case} onChange={(e) => update({ pieces_per_case: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bags / Wicket</Label>
                    <Input type="number" value={data.pieces_per_wicket} onChange={(e) => update({ pieces_per_wicket: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wickets / Case</Label>
                    <Input value={data.wickets_per_case} onChange={(e) => update({ wickets_per_case: e.target.value })} placeholder="e.g., N/A" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cases / Pallet</Label>
                    <Input type="number" value={data.cases_per_pallet} onChange={(e) => update({ cases_per_pallet: e.target.value })} placeholder="0" />
                  </div>
                </>
              )}

              {isFilm && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Rolls / Layer</Label>
                    <Input type="number" value={data.rolls_per_floor} onChange={(e) => update({ rolls_per_floor: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Layers / Pallet</Label>
                    <Input type="number" value={data.floors_per_pallet} onChange={(e) => update({ floors_per_pallet: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Rolls / Pallet</Label>
                    <Input
                      type="number"
                      value={
                        data.rolls_per_floor && data.floors_per_pallet
                          ? String(Number(data.rolls_per_floor) * Number(data.floors_per_pallet))
                          : ""
                      }
                      disabled
                      className="bg-muted text-muted-foreground"
                      placeholder="—"
                    />
                  </div>
                </>
              )}

              {!showWicketFields && !isFilm && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Pieces / Case</Label>
                    <Input type="number" value={data.pieces_per_case} onChange={(e) => update({ pieces_per_case: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cases / Pallet</Label>
                    <Input type="number" value={data.cases_per_pallet} onChange={(e) => update({ cases_per_pallet: e.target.value })} placeholder="0" />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Pallet Size</Label>
                <Select value={data.pallet_dimensions} onValueChange={(v) => update({ pallet_dimensions: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pallet size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 x 1.1 mts">1 x 1.1 mts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Pallet Height</Label>
                <Input value={data.max_pallet_height} onChange={(e) => update({ max_pallet_height: e.target.value })} placeholder="e.g., 1.4 mts" />
              </div>

              {showWicketFields && (
                <>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.cornerboards} onCheckedChange={(c) => update({ cornerboards: !!c })} />
                    <Label className="text-xs">Cornerboards</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.heat_treated} onCheckedChange={(c) => update({ heat_treated: !!c })} />
                    <Label className="text-xs">Heat Treated</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.pallet_covers} onCheckedChange={(c) => update({ pallet_covers: !!c })} />
                    <Label className="text-xs">Pallet Covers</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.poly_wrap} onCheckedChange={(c) => update({ poly_wrap: !!c })} />
                    <Label className="text-xs">Poly Wrap</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox checked={data.four_way_strap} onCheckedChange={(c) => update({ four_way_strap: !!c })} />
                    <Label className="text-xs">4-Way Strap</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Box Size</Label>
                    <Input value={data.box_size} onChange={(e) => update({ box_size: e.target.value })} placeholder="e.g., 24 x 12 x 8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Box Color</Label>
                    <Input value={data.box_color} onChange={(e) => update({ box_color: e.target.value })} placeholder="e.g., White" />
                  </div>
                </>
              )}
            </div>
          </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 6: Complementary Information ═══════════ */}
      <Collapsible open={openSections.includes(6)} onOpenChange={() => toggleSection(6)}>
        <SectionHeader title="Complementary Information" number={6} open={openSections.includes(6)} />
        <CollapsibleContent>
          <div className="px-3 pb-4 pt-2 space-y-4">
            {/* Authorization */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Product Authorization</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.pantone_base} onCheckedChange={(c) => update({ pantone_base: !!c })} />
                  <Label className="text-xs">Pantone Base</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.sample_base} onCheckedChange={(c) => update({ sample_base: !!c })} />
                  <Label className="text-xs">Sample Base</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.client_visit} onCheckedChange={(c) => update({ client_visit: !!c })} />
                  <Label className="text-xs">Client Visit</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.color_proof} onCheckedChange={(c) => update({ color_proof: !!c })} />
                  <Label className="text-xs">Color Proof</Label>
                </div>
              </div>
            </div>

            {/* Complements */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Complements</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.editable_files_needed} onCheckedChange={(c) => update({ editable_files_needed: !!c })} />
                  <Label className="text-xs">Editable Files</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.physical_samples_needed} onCheckedChange={(c) => update({ physical_samples_needed: !!c })} />
                  <Label className="text-xs">Physical Samples</Label>
                </div>
              </div>
            </div>

            {/* Reference files */}
            <div className="space-y-2">
              <Label>Reference Images / Documents</Label>
              <label className="cursor-pointer inline-block">
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="h-4 w-4 mr-1" /> Attach</span>
                </Button>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.ai,.ps,.svg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      update({ reference_files: [...data.reference_files, ...Array.from(e.target.files)] });
                    }
                  }}
                />
              </label>
              {data.reference_files.length > 0 && (
                <div className="space-y-1 mt-2">
                  {data.reference_files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm truncate max-w-xs">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => update({ reference_files: data.reference_files.filter((_, fi) => fi !== i) })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observations */}
            <div className="space-y-2">
              <Label>Observations / Critical Points</Label>
              <Textarea
                value={data.observations}
                onChange={(e) => update({ observations: e.target.value })}
                placeholder="Any observations or critical points..."
                rows={2}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 7: Volumes to Quote ═══════════ */}
      <Collapsible open={openSections.includes(7)} onOpenChange={() => toggleSection(7)}>
        <SectionHeader title="Volumes to Quote" number={7} open={openSections.includes(7)} />
        <CollapsibleContent>
          <div className="px-3 pb-4 pt-2">
            <div className="flex items-center justify-end mb-3">
              <Button variant="ghost" size="sm" onClick={addVolume}>
                <Plus className="h-3 w-3 mr-1" /> Add Volume
              </Button>
            </div>
            <div className="space-y-2">
              {data.volumes.map((vol, vi) => (
                <div key={vi} className="flex items-center gap-2">
                  <div className="flex-1 flex gap-2">
                    <Input
                      type="number"
                      value={vol.volume_quantity}
                      onChange={(e) => updateVolume(vi, { volume_quantity: e.target.value })}
                      placeholder="Quantity"
                      className="flex-1"
                    />
                    <Select value={vol.unit} onValueChange={(v) => updateVolume(vi, { unit: v })}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIL">MIL</SelectItem>
                        <SelectItem value="CASES">Cases</SelectItem>
                        <SelectItem value="ROLLS">Rolls</SelectItem>
                        <SelectItem value="PCS">PCS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={vol.notes}
                      onChange={(e) => updateVolume(vi, { notes: e.target.value })}
                      placeholder="Notes (optional)"
                      className="flex-1"
                    />
                  </div>
                  {data.volumes.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeVolume(vi)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

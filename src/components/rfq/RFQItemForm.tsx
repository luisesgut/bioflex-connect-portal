import { useState } from "react";
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
import { FileText, Plus, Trash2, Upload, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  seal_type: string;
  gusset: string;
  zipper: string;
  lip_front: string;
  lip_back: string;
  flip_size: string;
  film_type: string;
  finish: string;
  printing_side: string;
  ink_type: string;
  perforations: string;
  perforation_size: string;
  pre_cut_wicket: boolean;
  pre_cut_dotted: boolean;
  wicket_separation: string;

  // Section 3 - Packaging
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
            value={value}
            onChange={(e) => onChange(e.target.value)}
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
  const [openSections, setOpenSections] = useState<number[]>([1, 2, 3, 4, 5]);

  const update = (partial: Partial<RFQItemData>) => onChange({ ...data, ...partial });

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
          <div className="px-3 pb-4 pt-2 space-y-4">
            {/* Core dimensions */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MeasureField label="Width" value={data.width} onChange={(v) => update({ width: v })} unit={measureUnit} />
              <MeasureField label="Length / Height" value={data.length} onChange={(v) => update({ length: v })} unit={measureUnit} />
              {showGusset && (
                <MeasureField label="Gusset" value={data.gusset} onChange={(v) => update({ gusset: v })} unit={measureUnit} />
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
              {showFlip && (
                <MeasureField label="Flip Size" value={data.flip_size} onChange={(v) => update({ flip_size: v })} unit={measureUnit} />
              )}
            </div>

            {/* Thickness */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Thickness</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    value={data.thickness_value}
                    onChange={(e) => update({ thickness_value: e.target.value })}
                    placeholder="0"
                    className="flex-1"
                  />
                  <Select value={data.thickness_unit} onValueChange={(v) => update({ thickness_unit: v })}>
                    <SelectTrigger className="w-24">
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
              <div className="space-y-1">
                <Label className="text-xs">Structure</Label>
                <Input value={data.structure} onChange={(e) => update({ structure: e.target.value })} placeholder="e.g., LDPE" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Material</Label>
                <Input value={data.material} onChange={(e) => update({ material: e.target.value })} placeholder="Material" />
              </div>
            </div>

            {/* Film & Printing */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Film Type</Label>
                <Input value={data.film_type} onChange={(e) => update({ film_type: e.target.value })} placeholder="e.g., LDPE" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Finish</Label>
                <Select value={data.finish} onValueChange={(v) => update({ finish: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">Natural</SelectItem>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="pigmented">Pigmented</SelectItem>
                    <SelectItem value="metallic">Metallic</SelectItem>
                    <SelectItem value="matte">Matte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Seal Type</Label>
                <Input value={data.seal_type} onChange={(e) => update({ seal_type: e.target.value })} placeholder="Seal type" />
              </div>
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
              <div className="space-y-1">
                <Label className="text-xs">Ink Type</Label>
                <Input value={data.ink_type} onChange={(e) => update({ ink_type: e.target.value })} placeholder="e.g., Thermo-resistant" />
              </div>
            </div>

            {/* Wicket-specific elements */}
            {showWicketFields && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Elements</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={data.pre_cut_wicket}
                      onCheckedChange={(c) => update({ pre_cut_wicket: !!c })}
                    />
                    <Label className="text-xs">Pre-cut Wicket</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={data.pre_cut_dotted}
                      onCheckedChange={(c) => update({ pre_cut_dotted: !!c })}
                    />
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
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 3: Packaging & Packing ═══════════ */}
      <Collapsible open={openSections.includes(3)} onOpenChange={() => toggleSection(3)}>
        <SectionHeader title="Packaging & Packing" number={3} open={openSections.includes(3)} />
        <CollapsibleContent>
          <div className="px-3 pb-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {showWicketFields && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Pieces / Wicket</Label>
                    <Input type="number" value={data.pieces_per_wicket} onChange={(e) => update({ pieces_per_wicket: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Type</Label>
                    <Select value={data.wicket_type} onValueChange={(v) => update({ wicket_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="reverse">Reverse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wire Type</Label>
                    <Select value={data.wire_type} onValueChange={(v) => update({ wire_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smooth">Smooth</SelectItem>
                        <SelectItem value="drop">Drop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Hole</Label>
                    <Input value={data.wicket_hole} onChange={(e) => update({ wicket_hole: e.target.value })} placeholder='e.g., 1/4 inch' />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Wicket Size</Label>
                    <Input value={data.wicket_size} onChange={(e) => update({ wicket_size: e.target.value })} placeholder="e.g., Standard" />
                  </div>
                </>
              )}
              {showVents && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Vent Size</Label>
                    <Input value={data.vent_size} onChange={(e) => update({ vent_size: e.target.value })} placeholder="e.g., Micro" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vents Count</Label>
                    <Input type="number" value={data.vents_count} onChange={(e) => update({ vents_count: e.target.value })} placeholder="0" />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Pieces / Case</Label>
                <Input type="number" value={data.pieces_per_case} onChange={(e) => update({ pieces_per_case: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cases / Pallet</Label>
                <Input type="number" value={data.cases_per_pallet} onChange={(e) => update({ cases_per_pallet: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pallet Dimensions</Label>
                <Input value={data.pallet_dimensions} onChange={(e) => update({ pallet_dimensions: e.target.value })} placeholder="e.g., 40 x 48" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Pallet Height</Label>
                <Input value={data.max_pallet_height} onChange={(e) => update({ max_pallet_height: e.target.value })} placeholder="e.g., 1.4 mts" />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════ SECTION 4: Complementary Information ═══════════ */}
      <Collapsible open={openSections.includes(4)} onOpenChange={() => toggleSection(4)}>
        <SectionHeader title="Complementary Information" number={4} open={openSections.includes(4)} />
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
                <div className="space-y-1">
                  <Label className="text-xs">Prepress Cost By</Label>
                  <Select value={data.prepress_cost_by} onValueChange={(v) => update({ prepress_cost_by: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bioflex">Bioflex</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
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

      {/* ═══════════ SECTION 5: Volumes to Quote ═══════════ */}
      <Collapsible open={openSections.includes(5)} onOpenChange={() => toggleSection(5)}>
        <SectionHeader title="Volumes to Quote" number={5} open={openSections.includes(5)} />
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

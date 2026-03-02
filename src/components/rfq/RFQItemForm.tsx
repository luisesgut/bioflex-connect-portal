import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Trash2, Upload, X } from "lucide-react";

export interface VolumeData {
  volume_quantity: string;
  unit: string;
  notes: string;
}

export interface RFQItemData {
  product_name: string;
  product_type: string;
  item_code: string;
  width_inches: string;
  length_inches: string;
  thickness_value: string;
  thickness_unit: string;
  structure: string;
  material: string;
  seal_type: string;
  gusset_inches: string;
  zipper_inches: string;
  lip_front_inches: string;
  lip_back_inches: string;
  flip_size_inches: string;
  wicket_hole: string;
  wicket_size: string;
  vent_size: string;
  vents_count: string;
  bags_per_wicket: string;
  bags_per_case: string;
  cases_per_pallet: string;
  item_description: string;
  notes: string;
  reference_files: File[];
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
}

export function RFQItemForm({ data, onChange, productTypes }: RFQItemFormProps) {
  const update = (partial: Partial<RFQItemData>) => onChange({ ...data, ...partial });

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

  const showGusset = data.product_type === "wicket" || data.product_type === "pouch";
  const showZipper = data.product_type === "pouch" || data.product_type === "side_seal";
  const showLips = data.product_type === "pouch" || data.product_type === "side_seal";
  const showWicket = data.product_type === "wicket";
  const showVents = data.product_type === "wicket";
  const showFlip = data.product_type === "pouch";

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Product Name *</Label>
          <Input
            value={data.product_name}
            onChange={(e) => update({ product_name: e.target.value })}
            placeholder="e.g., Green Onion Bags 12oz"
          />
        </div>
        <div className="space-y-2">
          <Label>Product Type *</Label>
          <Select value={data.product_type} onValueChange={(v) => update({ product_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {productTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={data.item_description}
          onChange={(e) => update({ item_description: e.target.value })}
          placeholder="Describe the product..."
          rows={2}
        />
      </div>

      {/* Dimensions - Common */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Dimensions & Specs</h4>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Width (in)</Label>
            <Input
              type="number"
              step="0.01"
              value={data.width_inches}
              onChange={(e) => update({ width_inches: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Length (in)</Label>
            <Input
              type="number"
              step="0.01"
              value={data.length_inches}
              onChange={(e) => update({ length_inches: e.target.value })}
              placeholder="0.00"
            />
          </div>
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
            <Input
              value={data.structure}
              onChange={(e) => update({ structure: e.target.value })}
              placeholder="e.g., LDPE"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Material</Label>
            <Input
              value={data.material}
              onChange={(e) => update({ material: e.target.value })}
              placeholder="Material"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Seal Type</Label>
            <Input
              value={data.seal_type}
              onChange={(e) => update({ seal_type: e.target.value })}
              placeholder="Seal type"
            />
          </div>

          {/* Conditional specs */}
          {showGusset && (
            <div className="space-y-1">
              <Label className="text-xs">Gusset (in)</Label>
              <Input
                type="number"
                step="0.01"
                value={data.gusset_inches}
                onChange={(e) => update({ gusset_inches: e.target.value })}
                placeholder="0.00"
              />
            </div>
          )}
          {showZipper && (
            <div className="space-y-1">
              <Label className="text-xs">Zipper (in)</Label>
              <Input
                type="number"
                step="0.01"
                value={data.zipper_inches}
                onChange={(e) => update({ zipper_inches: e.target.value })}
                placeholder="0.00"
              />
            </div>
          )}
          {showLips && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Lip Front (in)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.lip_front_inches}
                  onChange={(e) => update({ lip_front_inches: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lip Back (in)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.lip_back_inches}
                  onChange={(e) => update({ lip_back_inches: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </>
          )}
          {showFlip && (
            <div className="space-y-1">
              <Label className="text-xs">Flip Size (in)</Label>
              <Input
                type="number"
                step="0.01"
                value={data.flip_size_inches}
                onChange={(e) => update({ flip_size_inches: e.target.value })}
                placeholder="0.00"
              />
            </div>
          )}
          {showWicket && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Wicket Hole</Label>
                <Input
                  value={data.wicket_hole}
                  onChange={(e) => update({ wicket_hole: e.target.value })}
                  placeholder="e.g., 1/4 inch"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wicket Size</Label>
                <Input
                  value={data.wicket_size}
                  onChange={(e) => update({ wicket_size: e.target.value })}
                  placeholder="e.g., Standard"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bags/Wicket</Label>
                <Input
                  type="number"
                  value={data.bags_per_wicket}
                  onChange={(e) => update({ bags_per_wicket: e.target.value })}
                  placeholder="0"
                />
              </div>
            </>
          )}
          {showVents && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Vent Size</Label>
                <Input
                  value={data.vent_size}
                  onChange={(e) => update({ vent_size: e.target.value })}
                  placeholder="e.g., Micro"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vents Count</Label>
                <Input
                  type="number"
                  value={data.vents_count}
                  onChange={(e) => update({ vents_count: e.target.value })}
                  placeholder="0"
                />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Bags/Case</Label>
            <Input
              type="number"
              value={data.bags_per_case}
              onChange={(e) => update({ bags_per_case: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cases/Pallet</Label>
            <Input
              type="number"
              value={data.cases_per_pallet}
              onChange={(e) => update({ cases_per_pallet: e.target.value })}
              placeholder="0"
            />
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

      {/* Volumes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Volumes to Quote
          </h4>
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

      {/* Notes */}
      <div className="space-y-2">
        <Label>Product Notes</Label>
        <Textarea
          value={data.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Any additional notes for this product..."
          rows={2}
        />
      </div>
    </div>
  );
}

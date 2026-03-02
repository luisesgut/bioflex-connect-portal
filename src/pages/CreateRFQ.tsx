import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, FileText, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RFQItemForm, type RFQItemData, type ProductTypeOption } from "@/components/rfq/RFQItemForm";

interface DropdownOption {
  id: string;
  label: string;
}

const EMPTY_ITEM: RFQItemData = {
  product_name: "",
  product_type: "",
  item_code: "",
  width_inches: "",
  length_inches: "",
  thickness_value: "",
  thickness_unit: "gauge",
  structure: "",
  material: "",
  seal_type: "",
  gusset_inches: "",
  zipper_inches: "",
  lip_front_inches: "",
  lip_back_inches: "",
  flip_size_inches: "",
  wicket_hole: "",
  wicket_size: "",
  vent_size: "",
  vents_count: "",
  bags_per_wicket: "",
  bags_per_case: "",
  cases_per_pallet: "",
  item_description: "",
  notes: "",
  reference_files: [],
  volumes: [{ volume_quantity: "", unit: "MIL", notes: "" }],
};

export default function CreateRFQ() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  // RFQ header
  const [rfqNumber, setRfqNumber] = useState("");
  const [customer, setCustomer] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);

  // Items
  const [items, setItems] = useState<RFQItemData[]>([{ ...EMPTY_ITEM }]);
  const [expandedItems, setExpandedItems] = useState<number[]>([0]);
  const [uploading, setUploading] = useState(false);

  // Dropdown data
  const [customerOptions, setCustomerOptions] = useState<DropdownOption[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeOption[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  useEffect(() => {
    fetchDropdownOptions();
    fetchProductTypes();
  }, []);

  const fetchDropdownOptions = async () => {
    const { data } = await supabase
      .from("dropdown_options")
      .select("id, label")
      .eq("category", "final_customer")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setCustomerOptions(data);
  };

  const fetchProductTypes = async () => {
    const { data } = await supabase
      .from("production_capacity")
      .select("item_type")
      .order("item_type");
    if (data) {
      setProductTypes(data.map((d) => ({ value: d.item_type, label: d.item_type })));
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    setAddingCustomer(true);
    try {
      const maxSort = customerOptions.length > 0
        ? Math.max(...customerOptions.map(() => 0)) + 1
        : 0;
      const { data, error } = await supabase
        .from("dropdown_options")
        .insert({
          category: "final_customer",
          label: newCustomerName.trim(),
          sort_order: maxSort,
        })
        .select("id, label")
        .single();
      if (error) throw error;
      if (data) {
        setCustomerOptions((prev) => [...prev, data]);
        setCustomer(data.label);
        setNewCustomerName("");
        toast.success("Customer added");
      }
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setAddingCustomer(false);
    }
  };

  const addItem = () => {
    const newIndex = items.length;
    setItems((prev) => [...prev, { ...EMPTY_ITEM, volumes: [{ volume_quantity: "", unit: "MIL", notes: "" }] }]);
    setExpandedItems((prev) => [...prev, newIndex]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setExpandedItems((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
  };

  const updateItem = (index: number, data: RFQItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("You must be logged in"); return; }
    if (!rfqNumber.trim()) { toast.error("RFQ Number is required"); return; }
    if (items.some((item) => !item.product_name.trim())) {
      toast.error("All items must have a product name");
      return;
    }

    setUploading(true);
    try {
      const { data: rfq, error: rfqError } = await supabase
        .from("rfqs")
        .insert({
          rfq_number: rfqNumber.trim(),
          customer: customer || null,
          response_deadline: responseDeadline || null,
          notes: notes.trim() || null,
          created_by: user.id,
          status: "submitted",
        } as any)
        .select()
        .single();

      if (rfqError) throw rfqError;

      if (referenceFiles.length > 0) {
        const fileUrls: string[] = [];
        for (const file of referenceFiles) {
          const ext = file.name.split(".").pop();
          const fileName = `${rfq.id}/ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const { error } = await supabase.storage.from("rfq-files").upload(fileName, file);
          if (!error) fileUrls.push(`rfq-files:${fileName}`);
        }
        if (fileUrls.length > 0) {
          await supabase.from("rfqs").update({ reference_files: fileUrls }).eq("id", rfq.id);
        }
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const { data: rfqItem, error: itemError } = await supabase
          .from("rfq_items")
          .insert({
            rfq_id: rfq.id,
            product_name: item.product_name.trim(),
            product_type: item.product_type,
            item_code: item.item_code.trim() || null,
            width_inches: item.width_inches ? Number(item.width_inches) : null,
            length_inches: item.length_inches ? Number(item.length_inches) : null,
            thickness_value: item.thickness_value ? Number(item.thickness_value) : null,
            thickness_unit: item.thickness_unit || null,
            structure: item.structure || null,
            material: item.material || null,
            seal_type: item.seal_type || null,
            gusset_inches: item.gusset_inches ? Number(item.gusset_inches) : null,
            zipper_inches: item.zipper_inches ? Number(item.zipper_inches) : null,
            lip_front_inches: item.lip_front_inches ? Number(item.lip_front_inches) : null,
            lip_back_inches: item.lip_back_inches ? Number(item.lip_back_inches) : null,
            flip_size_inches: item.flip_size_inches ? Number(item.flip_size_inches) : null,
            wicket_hole: item.wicket_hole || null,
            wicket_size: item.wicket_size || null,
            vent_size: item.vent_size || null,
            vents_count: item.vents_count ? Number(item.vents_count) : null,
            bags_per_wicket: item.bags_per_wicket ? Number(item.bags_per_wicket) : null,
            bags_per_case: item.bags_per_case ? Number(item.bags_per_case) : null,
            cases_per_pallet: item.cases_per_pallet ? Number(item.cases_per_pallet) : null,
            item_description: item.item_description || null,
            notes: item.notes || null,
            sort_order: i,
          } as any)
          .select()
          .single();

        if (itemError) throw itemError;

        if (item.reference_files.length > 0) {
          const itemFileUrls: string[] = [];
          for (const file of item.reference_files) {
            const ext = file.name.split(".").pop();
            const fileName = `${rfq.id}/items/${rfqItem.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const { error } = await supabase.storage.from("rfq-files").upload(fileName, file);
            if (!error) itemFileUrls.push(`rfq-files:${fileName}`);
          }
          if (itemFileUrls.length > 0) {
            await supabase.from("rfq_items").update({
              reference_files: itemFileUrls,
              reference_image_url: itemFileUrls[0],
            }).eq("id", rfqItem.id);
          }
        }

        const validVolumes = item.volumes.filter((v) => v.volume_quantity);
        if (validVolumes.length > 0) {
          const volumeInserts = validVolumes.map((v, vi) => ({
            rfq_item_id: rfqItem.id,
            volume_quantity: Number(v.volume_quantity),
            unit: v.unit,
            notes: v.notes || null,
            sort_order: vi,
          }));
          const { error: volError } = await supabase
            .from("rfq_item_volumes")
            .insert(volumeInserts as any);
          if (volError) throw volError;
        }
      }

      toast.success("RFQ created successfully!");
      navigate("/products");
    } catch (error) {
      console.error("Error creating RFQ:", error);
      toast.error("Failed to create RFQ");
    } finally {
      setUploading(false);
    }
  };

  const getItemTypeLabel = (type: string) => {
    const found = productTypes.find((t) => t.value === type);
    return found ? found.label : type || "No type";
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New RFQ</h1>
          <p className="text-muted-foreground mt-1">
            Submit a Request for Quote with product specifications and volumes.
          </p>
        </div>

        {/* RFQ Header */}
        <Card>
          <CardHeader>
            <CardTitle>RFQ Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rfq_number">RFQ Number *</Label>
                <Input
                  id="rfq_number"
                  value={rfqNumber}
                  onChange={(e) => setRfqNumber(e.target.value)}
                  placeholder="e.g., RFQ-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customer} onValueChange={setCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.label}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    {/* Inline add new customer */}
                    <div className="border-t p-2 mt-1">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="New customer..."
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="h-8 text-sm"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleAddCustomer();
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0"
                          disabled={!newCustomerName.trim() || addingCustomer}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddCustomer();
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="response_deadline">Response Deadline</Label>
                <Input
                  id="response_deadline"
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfq_notes">Notes</Label>
              <Textarea
                id="rfq_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="General notes about this RFQ..."
                rows={2}
              />
            </div>

            {/* RFQ-level reference files */}
            <div className="space-y-2">
              <Label>Reference Documents</Label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span><Upload className="h-4 w-4 mr-1" /> Attach Files</span>
                  </Button>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) setReferenceFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }}
                  />
                </label>
              </div>
              {referenceFiles.length > 0 && (
                <div className="space-y-1 mt-2">
                  {referenceFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm truncate max-w-xs">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReferenceFiles((prev) => prev.filter((_, fi) => fi !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Products ({items.length})
            </h2>
            <Button onClick={addItem} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>

          {items.map((item, index) => {
            const isExpanded = expandedItems.includes(index);
            return (
              <Card key={index} className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(index)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">
                        {item.item_code && item.product_name
                          ? `${item.item_code} - ${item.product_name}`
                          : item.product_name || `Product ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getItemTypeLabel(item.product_type)} · {item.volumes.filter((v) => v.volume_quantity).length} volume(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getItemTypeLabel(item.product_type)}</Badge>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="border-t pt-4">
                    <RFQItemForm
                      data={item}
                      onChange={(data) => updateItem(index, data)}
                      productTypes={productTypes}
                    />
                  </CardContent>
                )}
              </Card>
            );
          })}

          <Button onClick={addItem} variant="outline" className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-1" /> Add Another Product
          </Button>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate("/products")} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploading || !rfqNumber.trim()}>
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              "Submit RFQ"
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

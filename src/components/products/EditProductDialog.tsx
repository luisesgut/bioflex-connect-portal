import { useState, useRef, useEffect } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, X, ChevronDown } from "lucide-react";

interface Product {
  id: string;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  tipo_empaque: string | null;
  pt_code: string | null;
  pieces_per_pallet: number | null;
  print_card: string | null;
  print_card_url: string | null;
  customer_tech_spec_url: string | null;
  bfx_spec_url: string | null;
  dp_sales_csr_names: string | null;
  activa: boolean | null;
}

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditProductDialog({ product, open, onOpenChange, onSaved }: EditProductDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingPC, setUploadingPC] = useState(false);
  const [uploadingCustomerSpec, setUploadingCustomerSpec] = useState(false);
  const [uploadingBFXSpec, setUploadingBFXSpec] = useState(false);
  const pcFileRef = useRef<HTMLInputElement>(null);
  const customerSpecRef = useRef<HTMLInputElement>(null);
  const bfxSpecRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<Product>>({});

  const { data: dpContacts } = useQuery({
    queryKey: ["dp-contacts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dp_contacts")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: dropdownOptions } = useQuery({
    queryKey: ["dropdown-options-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dropdown_options")
        .select("id, category, label")
        .eq("is_active", true)
        .order("sort_order")
        .order("label");
      if (error) throw error;
      return data;
    },
  });

  const getOptions = (category: string) =>
    (dropdownOptions || []).filter((o) => o.category === category);

  // Initialize form when product changes
  useEffect(() => {
    if (product && open) {
      setForm({
        customer_item: product.customer_item,
        item_description: product.item_description,
        customer: product.customer,
        item_type: product.item_type,
        tipo_empaque: product.tipo_empaque,
        pt_code: product.pt_code,
        pieces_per_pallet: product.pieces_per_pallet,
        print_card: product.print_card,
        print_card_url: product.print_card_url,
        customer_tech_spec_url: product.customer_tech_spec_url,
        bfx_spec_url: (product as any).bfx_spec_url || null,
        dp_sales_csr_names: product.dp_sales_csr_names,
        activa: product.activa,
      });
    }
  }, [product, open]);

  // Reset form when product changes
  const resetForm = () => {
    if (product) {
      setForm({
        customer_item: product.customer_item,
        item_description: product.item_description,
        customer: product.customer,
        item_type: product.item_type,
        tipo_empaque: product.tipo_empaque,
        pt_code: product.pt_code,
        pieces_per_pallet: product.pieces_per_pallet,
        print_card: product.print_card,
        print_card_url: product.print_card_url,
        customer_tech_spec_url: product.customer_tech_spec_url,
        bfx_spec_url: (product as any).bfx_spec_url || null,
        dp_sales_csr_names: product.dp_sales_csr_names,
        activa: product.activa,
      });
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (val && product) resetForm();
    onOpenChange(val);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}.${ext}`;
    const path = `${folder}/${product?.id}/${safeName}`;
    const { error } = await supabase.storage.from("print-cards").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    return `print-cards:${path}`;
  };

  const handleFileUpload = async (
    file: File,
    folder: string,
    fieldKey: keyof Product,
    setUploading: (v: boolean) => void
  ) => {
    setUploading(true);
    const url = await uploadFile(file, folder);
    if (url) {
      setForm((prev) => ({ ...prev, [fieldKey]: url }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        customer_item: form.customer_item || null,
        item_description: form.item_description || null,
        customer: form.customer || null,
        item_type: form.item_type || null,
        tipo_empaque: form.tipo_empaque || null,
        pt_code: form.pt_code || null,
        pieces_per_pallet: form.pieces_per_pallet || null,
        print_card: form.print_card || null,
        print_card_url: form.print_card_url || null,
        customer_tech_spec_url: form.customer_tech_spec_url || null,
        bfx_spec_url: form.bfx_spec_url || null,
        dp_sales_csr_names: form.dp_sales_csr_names || null,
        activa: form.activa,
      })
      .eq("id", product.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product updated", description: "Changes saved successfully." });
      onSaved();
      onOpenChange(false);
    }
    setSaving(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Item Code</Label>
              <Input value={form.customer_item || ""} onChange={(e) => setForm({ ...form, customer_item: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Final Customer</Label>
              <Select value={form.customer || ""} onValueChange={(v) => setForm({ ...form, customer: v || null })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {getOptions("final_customer").map((o) => (
                    <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Item Description</Label>
            <Input value={form.item_description || ""} onChange={(e) => setForm({ ...form, item_description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select value={form.item_type || ""} onValueChange={(v) => setForm({ ...form, item_type: v || null })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {getOptions("item_type").map((o) => (
                    <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo Empaque</Label>
              <Select value={form.tipo_empaque || ""} onValueChange={(v) => setForm({ ...form, tipo_empaque: v || null })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {getOptions("tipo_empaque").map((o) => (
                    <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PT Code</Label>
              <Input value={form.pt_code || ""} onChange={(e) => setForm({ ...form, pt_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pieces per Pallet</Label>
              <Input type="number" value={form.pieces_per_pallet ?? ""} onChange={(e) => setForm({ ...form, pieces_per_pallet: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>

          {/* PC Number + PDF */}
          <div className="space-y-2">
            <Label>PC Number</Label>
            <Input value={form.print_card || ""} onChange={(e) => setForm({ ...form, print_card: e.target.value })} placeholder="e.g. PC-001" />
          </div>
          <div className="space-y-2">
            <Label>PC PDF</Label>
            <div className="flex items-center gap-2">
              {form.print_card_url && (
                <button onClick={() => openStorageFile(form.print_card_url, 'print-cards')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer bg-transparent border-none p-0">
                  <FileText className="h-4 w-4" /> View current
                </button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => pcFileRef.current?.click()} disabled={uploadingPC}>
                <Upload className="h-4 w-4 mr-1" />
                {uploadingPC ? "Uploading..." : "Upload PDF"}
              </Button>
              <input ref={pcFileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, "pc-files", "print_card_url", setUploadingPC);
              }} />
              {form.print_card_url && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setForm({ ...form, print_card_url: null })}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Customer Spec Sheet */}
          <div className="space-y-2">
            <Label>Customer Spec Sheet (PDF)</Label>
            <div className="flex items-center gap-2">
              {form.customer_tech_spec_url && (
                <button onClick={() => openStorageFile(form.customer_tech_spec_url, 'print-cards')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer bg-transparent border-none p-0">
                  <FileText className="h-4 w-4" /> View current
                </button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => customerSpecRef.current?.click()} disabled={uploadingCustomerSpec}>
                <Upload className="h-4 w-4 mr-1" />
                {uploadingCustomerSpec ? "Uploading..." : "Upload PDF"}
              </Button>
              <input ref={customerSpecRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, "customer-specs", "customer_tech_spec_url", setUploadingCustomerSpec);
              }} />
              {form.customer_tech_spec_url && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setForm({ ...form, customer_tech_spec_url: null })}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* BFX Spec Sheet */}
          <div className="space-y-2">
            <Label>BFX Spec Sheet (PDF)</Label>
            <div className="flex items-center gap-2">
              {form.bfx_spec_url && (
                <button onClick={() => openStorageFile(form.bfx_spec_url, 'print-cards')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer bg-transparent border-none p-0">
                  <FileText className="h-4 w-4" /> View current
                </button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => bfxSpecRef.current?.click()} disabled={uploadingBFXSpec}>
                <Upload className="h-4 w-4 mr-1" />
                {uploadingBFXSpec ? "Uploading..." : "Upload PDF"}
              </Button>
              <input ref={bfxSpecRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, "bfx-specs", "bfx_spec_url" as keyof Product, setUploadingBFXSpec);
              }} />
              {form.bfx_spec_url && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setForm({ ...form, bfx_spec_url: null })}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* DP Sales/CSR Multi-Selection */}
          <div className="space-y-2">
            <Label>DP Sales/CSR</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between bg-background font-normal">
                  {(() => {
                    const selected = form.dp_sales_csr_names ? form.dp_sales_csr_names.split(", ").filter(Boolean) : [];
                    if (selected.length === 0) return <span className="text-muted-foreground">Select DP contacts...</span>;
                    return <span className="truncate">{selected.join(", ")}</span>;
                  })()}
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <ScrollArea className="h-60">
                  <div className="p-2 space-y-1">
                    {dpContacts?.map((c) => {
                      const selected = form.dp_sales_csr_names ? form.dp_sales_csr_names.split(", ").filter(Boolean) : [];
                      const isChecked = selected.includes(c.full_name);
                      return (
                        <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {
                              const updated = isChecked
                                ? selected.filter((n) => n !== c.full_name)
                                : [...selected, c.full_name];
                              setForm({ ...form, dp_sales_csr_names: updated.join(", ") || null });
                            }}
                          />
                          <span>{c.full_name} ({c.email})</span>
                        </label>
                      );
                    })}
                    {(!dpContacts || dpContacts.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No contacts available. Add them in Settings.</p>
                    )}
                  </div>
                </ScrollArea>
                {form.dp_sales_csr_names && (
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setForm({ ...form, dp_sales_csr_names: null })}>
                      Clear all
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

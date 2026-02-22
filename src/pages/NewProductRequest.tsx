import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, FileText, Loader2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DropdownOption {
  id: string;
  label: string;
  sort_order: number;
}

interface DestinyUser {
  user_id: string;
  full_name: string;
  email: string;
}

export default function NewProductRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [productName, setProductName] = useState("");
  const [itemIdCode, setItemIdCode] = useState("");
  const [customer, setCustomer] = useState("");
  const [itemType, setItemType] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [assignedDesigner, setAssignedDesigner] = useState("");
  const [dpSalesCsr, setDpSalesCsr] = useState<string[]>([]);
  const [designNotes, setDesignNotes] = useState("");

  // Files
  const [techSpecFile, setTechSpecFile] = useState<File | null>(null);
  const [artworkFiles, setArtworkFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Dropdown data
  const [customerOptions, setCustomerOptions] = useState<DropdownOption[]>([]);
  const [itemTypeOptions, setItemTypeOptions] = useState<DropdownOption[]>([]);
  const [destinyUsers, setDestinyUsers] = useState<DestinyUser[]>([]);

  // Drag state
  const [isDraggingSpec, setIsDraggingSpec] = useState(false);
  const [isDraggingArt, setIsDraggingArt] = useState(false);

  useEffect(() => {
    fetchDropdownOptions();
    fetchDestinyUsers();
  }, []);

  const fetchDropdownOptions = async () => {
    const { data } = await supabase
      .from("dropdown_options")
      .select("id, label, sort_order, category")
      .in("category", ["final_customer", "item_type"])
      .eq("is_active", true)
      .order("sort_order");

    if (data) {
      setCustomerOptions(data.filter((d) => d.category === "final_customer"));
      setItemTypeOptions(data.filter((d) => d.category === "item_type"));
    }
  };

  const fetchDestinyUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .eq("user_type", "external")
      .like("email", "%destinypkg%")
      .order("full_name");

    if (data) {
      setDestinyUsers(data as DestinyUser[]);
      // Default Assigned Designer to Cynthia McGovern
      const cynthia = data.find((u) =>
        u.full_name?.toLowerCase().includes("cynthia")
      );
      if (cynthia) {
        setAssignedDesigner(cynthia.user_id);
      }
    }
  };

  const handleSpecFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTechSpecFile(file);
  };

  const handleArtworkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArtworkFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeArtworkFile = (index: number) => {
    setArtworkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (
    requestId: string
  ): Promise<{ artworkUrls: string[]; techSpecUrl: string | null }> => {
    const artworkUrls: string[] = [];
    let techSpecUrl: string | null = null;

    if (techSpecFile) {
      const fileExt = techSpecFile.name.split(".").pop();
      const fileName = `${requestId}/tech-spec.${fileExt}`;
      const { error } = await supabase.storage
        .from("product-request-files")
        .upload(fileName, techSpecFile);
      if (!error) {
        techSpecUrl = `product-request-files:${fileName}`;
      }
    }

    for (const file of artworkFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${requestId}/artwork-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const { error } = await supabase.storage
        .from("product-request-files")
        .upload(fileName, file);
      if (!error) {
        artworkUrls.push(`product-request-files:${fileName}`);
      }
    }

    return { artworkUrls, techSpecUrl };
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }
    if (!productName.trim()) {
      toast.error("Product Name is required");
      return;
    }

    setUploading(true);

    try {
      // Build comma-separated CSR names
      const csrNames = dpSalesCsr
        .map((id) => destinyUsers.find((u) => u.user_id === id)?.full_name)
        .filter(Boolean)
        .join(", ");

      // Concatenate Item ID + Product Name for display
      const displayName = itemIdCode.trim()
        ? `${itemIdCode.trim()} - ${productName.trim()}`
        : productName.trim();

      const { data: request, error: requestError } = await supabase
        .from("product_requests")
        .insert({
          created_by: user.id,
          product_name: displayName,
          item_id_code: itemIdCode.trim() || null,
          customer: customer || null,
          item_type: itemType || null,
          item_description: itemDescription.trim() || null,
          assigned_designer: assignedDesigner || null,
          dp_sales_csr_names: csrNames || null,
          tech_spec_filename: techSpecFile?.name || null,
          notes: designNotes.trim() || null,
          status: artworkFiles.length > 0 ? "artwork_uploaded" : "specs_submitted",
          engineering_status: "pending",
        } as any)
        .select()
        .single();

      if (requestError) throw requestError;

      if (request && (techSpecFile || artworkFiles.length > 0)) {
        const { artworkUrls, techSpecUrl } = await uploadFiles(request.id);
        await supabase
          .from("product_requests")
          .update({
            artwork_files: artworkUrls.length > 0 ? artworkUrls : null,
            tech_spec_pdf_url: techSpecUrl,
          })
          .eq("id", request.id);
      }

      toast.success("Product request created successfully!");
      navigate("/products");
    } catch (error) {
      console.error("Error creating request:", error);
      toast.error("Failed to create product request");
    } finally {
      setUploading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            New Product Request
          </h1>
          <p className="text-muted-foreground mt-1">
            Submit product details for engineering review and onboarding.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Item / Destiny ID */}
              <div className="space-y-2">
                <Label htmlFor="item_id">Item / Destiny ID</Label>
                <Input
                  id="item_id"
                  value={itemIdCode}
                  onChange={(e) => setItemIdCode(e.target.value)}
                  placeholder="e.g., 9801905 - 783916"
                />
              </div>

              {/* Customer */}
              <div className="space-y-2">
                <Label>Customer (Final Customer)</Label>
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
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Item Type */}
              <div className="space-y-2">
                <Label>Item Type</Label>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemTypeOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.label}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned Designer */}
              <div className="space-y-2">
                <Label>Assigned Designer</Label>
                <Select
                  value={assignedDesigner}
                  onValueChange={setAssignedDesigner}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select designer" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinyUsers.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DP Sales/CSR - Multi-select */}
            <div className="space-y-2">
              <Label>DP Sales / CSR</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {dpSalesCsr.length > 0
                      ? destinyUsers
                          .filter((u) => dpSalesCsr.includes(u.user_id))
                          .map((u) => u.full_name)
                          .join(", ")
                      : "Select DP Sales/CSR"}
                    <span className="ml-2 opacity-50">▼</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-2" align="start">
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {destinyUsers.map((u) => (
                      <label
                        key={u.user_id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={dpSalesCsr.includes(u.user_id)}
                          onCheckedChange={(checked) => {
                            setDpSalesCsr((prev) =>
                              checked
                                ? [...prev, u.user_id]
                                : prev.filter((id) => id !== u.user_id)
                            );
                          }}
                        />
                        {u.full_name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Item Description */}
            <div className="space-y-2">
              <Label htmlFor="item_description">Item Description</Label>
              <Textarea
                id="item_description"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Describe the product"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Spec Sheet Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Spec Sheet (PDF)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 transition-colors",
                isDraggingSpec
                  ? "border-primary bg-primary/5"
                  : "border-muted",
                techSpecFile && "border-solid"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingSpec(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingSpec(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingSpec(false);
                const file = e.dataTransfer.files[0];
                if (file) setTechSpecFile(file);
              }}
            >
              {!techSpecFile ? (
                <div className="flex flex-col items-center justify-center text-center">
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">
                    Upload customer Spec Sheet
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    PDF, AI, PS, SVG, PNG, or JPG
                  </p>
                  <label htmlFor="spec-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>Choose File</span>
                    </Button>
                    <input
                      id="spec-upload"
                      type="file"
                      accept=".pdf,.ai,.ps,.svg,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={handleSpecFileSelect}
                    />
                  </label>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium text-sm truncate max-w-xs">
                        {techSpecFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(techSpecFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTechSpecFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Artwork Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Artwork Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 transition-colors",
                isDraggingArt
                  ? "border-primary bg-primary/5"
                  : "border-muted"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingArt(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingArt(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingArt(false);
                const files = Array.from(e.dataTransfer.files);
                setArtworkFiles((prev) => [...prev, ...files]);
              }}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">
                  Upload artwork files
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  AI, PDF, PS, SVG, PNG, JPG
                </p>
                <label htmlFor="artwork-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>Choose Files</span>
                  </Button>
                  <input
                    id="artwork-upload"
                    type="file"
                    accept=".pdf,.ai,.ps,.svg,.png,.jpg,.jpeg"
                    multiple
                    className="hidden"
                    onChange={handleArtworkFileSelect}
                  />
                </label>
              </div>
            </div>

            {artworkFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {artworkFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm truncate max-w-xs">
                        {file.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArtworkFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Initial Design Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Initial Design Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              placeholder="Add any initial notes, annotations or instructions for the design team..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/products")}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading || !productName.trim()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

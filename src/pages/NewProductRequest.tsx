import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductLineSelector, ProductLine, getProductLineLabel } from "@/components/product-requests/ProductLineSelector";
import { TechSpecUploader } from "@/components/product-requests/TechSpecUploader";
import { MeasurementInput, ThicknessInput } from "@/components/product-requests/MeasurementInput";
import { ContactsManager, Contact } from "@/components/product-requests/ContactsManager";
import { MaterialStructureInput } from "@/components/product-requests/MaterialStructureInput";

interface FormData {
  // Basic info
  product_name: string;
  customer: string;
  item_description: string;
  item_id_code: string;
  customer_item_code: string;
  
  // Sello lateral zipper option
  has_zipper: boolean;
  
  // Measurements in inches
  width_inches: string;
  length_inches: string;
  gusset_inches: string;
  zipper_inches: string;
  lip_front_inches: string;
  lip_back_inches: string;
  flip_size_inches: string;
  
  // Thickness / Structure
  thickness_value: string;
  thickness_unit: "gauge" | "microns";
  estructura: string;
  
  // Film specs
  film_type: string;
  seal_type: string;
  extrusion_type: string;
  clarity_grade: string;
  
  // Vents
  vents_count: string;
  vent_size: string;
  vents_across: string;
  vents_down: string;
  
  // Wicket
  wicket_size: string;
  wicket_hole: string;
  bags_per_wicket: string;
  
  // Packaging
  bags_per_case: string;
  cases_per_pallet: string;
  pallet_size: string;
  box_color: string;
  
  // Print
  pms_colors: string[];
  eye_mark: string;
  upc_number: string;
  language: string;
  country_of_origin: string;
  
  // Notes
  notes: string;
}

const initialFormData: FormData = {
  product_name: "",
  customer: "",
  item_description: "",
  item_id_code: "",
  customer_item_code: "",
  has_zipper: false,
  width_inches: "",
  length_inches: "",
  gusset_inches: "",
  zipper_inches: "",
  lip_front_inches: "",
  lip_back_inches: "",
  flip_size_inches: "",
  thickness_value: "",
  thickness_unit: "gauge",
  estructura: "",
  film_type: "",
  seal_type: "",
  extrusion_type: "",
  clarity_grade: "",
  vents_count: "",
  vent_size: "",
  vents_across: "",
  vents_down: "",
  wicket_size: "",
  wicket_hole: "",
  bags_per_wicket: "",
  bags_per_case: "",
  cases_per_pallet: "",
  pallet_size: "",
  box_color: "",
  pms_colors: [],
  eye_mark: "",
  upc_number: "",
  language: "",
  country_of_origin: "",
  notes: "",
};

// Map UI product line to database enum
function getDbProductLine(uiProductLine: ProductLine, hasZipper: boolean): string {
  if (uiProductLine === "sello_lateral") {
    return hasZipper ? "bag_zipper" : "bag_no_wicket_zipper";
  }
  return uiProductLine;
}

function getSteps(productLine: ProductLine | null) {
  const baseSteps = [
    { id: 1, name: "Product Type", description: "Select product line" },
    { id: 2, name: "Tech Spec", description: "Upload & extract data" },
    { id: 3, name: "Basic Info", description: "Product details" },
    { id: 4, name: "Dimensions", description: "Measurements" },
  ];
  
  // Add product-specific steps
  if (productLine === "bag_wicket") {
    baseSteps.push({ id: 5, name: "Wicket Specs", description: "Wicket details" });
    baseSteps.push({ id: 6, name: "Packaging", description: "Packing info" });
    baseSteps.push({ id: 7, name: "Contacts", description: "Approvers & notifications" });
    baseSteps.push({ id: 8, name: "Artwork", description: "Upload artwork" });
    baseSteps.push({ id: 9, name: "Review", description: "Confirm & submit" });
  } else if (productLine === "film") {
    baseSteps.push({ id: 5, name: "Roll Specs", description: "Film specifications" });
    baseSteps.push({ id: 6, name: "Contacts", description: "Approvers & notifications" });
    baseSteps.push({ id: 7, name: "Artwork", description: "Upload artwork" });
    baseSteps.push({ id: 8, name: "Review", description: "Confirm & submit" });
  } else {
    baseSteps.push({ id: 5, name: "Film & Vents", description: "Material details" });
    baseSteps.push({ id: 6, name: "Packaging", description: "Packing info" });
    baseSteps.push({ id: 7, name: "Contacts", description: "Approvers & notifications" });
    baseSteps.push({ id: 8, name: "Artwork", description: "Upload artwork" });
    baseSteps.push({ id: 9, name: "Review", description: "Confirm & submit" });
  }
  
  return baseSteps;
}

export default function NewProductRequest() {
  const [currentStep, setCurrentStep] = useState(1);
  const [productLine, setProductLine] = useState<ProductLine | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [techSpecFile, setTechSpecFile] = useState<File | null>(null);
  const [artworkFiles, setArtworkFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pmsColorInput, setPmsColorInput] = useState("");
  const [clientApprovers, setClientApprovers] = useState<Contact[]>([]);
  const [internalContacts, setInternalContacts] = useState<Contact[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const steps = getSteps(productLine);
  const lastStep = steps[steps.length - 1].id;

  const updateField = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleExtractedData = (data: any) => {
    setFormData(prev => ({
      ...prev,
      product_name: data.product_name || prev.product_name,
      customer: data.customer || prev.customer,
      item_id_code: data.item_id_code || prev.item_id_code,
      customer_item_code: data.customer_item_code || prev.customer_item_code,
      width_inches: data.width_inches?.toString() || prev.width_inches,
      length_inches: data.length_inches?.toString() || prev.length_inches,
      gusset_inches: data.gusset_inches?.toString() || prev.gusset_inches,
      zipper_inches: data.zipper_inches?.toString() || prev.zipper_inches,
      lip_front_inches: data.lip_front_inches?.toString() || prev.lip_front_inches,
      lip_back_inches: data.lip_back_inches?.toString() || prev.lip_back_inches,
      flip_size_inches: data.flip_size_inches?.toString() || prev.flip_size_inches,
      thickness_value: data.thickness_value?.toString() || prev.thickness_value,
      thickness_unit: data.thickness_unit || prev.thickness_unit,
      film_type: data.film_type || prev.film_type,
      seal_type: data.seal_type || prev.seal_type,
      extrusion_type: data.extrusion_type || prev.extrusion_type,
      clarity_grade: data.clarity_grade || prev.clarity_grade,
      vents_count: data.vents_count?.toString() || prev.vents_count,
      vent_size: data.vent_size || prev.vent_size,
      vents_across: data.vents_across?.toString() || prev.vents_across,
      vents_down: data.vents_down?.toString() || prev.vents_down,
      wicket_size: data.wicket_size || prev.wicket_size,
      wicket_hole: data.wicket_hole || prev.wicket_hole,
      bags_per_wicket: data.bags_per_wicket?.toString() || prev.bags_per_wicket,
      bags_per_case: data.bags_per_case?.toString() || prev.bags_per_case,
      cases_per_pallet: data.cases_per_pallet?.toString() || prev.cases_per_pallet,
      pallet_size: data.pallet_size || prev.pallet_size,
      box_color: data.box_color || prev.box_color,
      pms_colors: data.pms_colors || prev.pms_colors,
      eye_mark: data.eye_mark || prev.eye_mark,
      upc_number: data.upc_number || prev.upc_number,
      language: data.language || prev.language,
      country_of_origin: data.country_of_origin || prev.country_of_origin,
      notes: data.notes || prev.notes,
    }));
    toast.success("Data extracted and form populated!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setArtworkFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeArtworkFile = (index: number) => {
    setArtworkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addPmsColor = () => {
    if (pmsColorInput.trim()) {
      updateField("pms_colors", [...formData.pms_colors, pmsColorInput.trim()]);
      setPmsColorInput("");
    }
  };

  const removePmsColor = (index: number) => {
    updateField("pms_colors", formData.pms_colors.filter((_, i) => i !== index));
  };

  const uploadFiles = async (requestId: string): Promise<{ artworkUrls: string[], techSpecUrl: string | null }> => {
    const artworkUrls: string[] = [];
    let techSpecUrl: string | null = null;
    
    // Upload tech spec PDF
    if (techSpecFile) {
      const fileExt = techSpecFile.name.split('.').pop();
      const fileName = `${requestId}/tech-spec.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('product-request-files')
        .upload(fileName, techSpecFile);
      
      if (!error) {
        techSpecUrl = `product-request-files:${fileName}`;
      }
    }
    
    // Upload artwork files
    for (const file of artworkFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${requestId}/artwork-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('product-request-files')
        .upload(fileName, file);
      
      if (!error) {
        const { data: urlData } = supabase.storage
          .from('product-request-files')
          .getPublicUrl(fileName);
        artworkUrls.push(urlData.publicUrl);
      }
    }
    
    return { artworkUrls, techSpecUrl };
  };

  const inchesToCm = (inches: string): number | null => {
    const val = parseFloat(inches);
    return !isNaN(val) ? val * 2.54 : null;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to create a request");
      return;
    }

    if (!formData.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!productLine) {
      toast.error("Product line is required");
      return;
    }

    setUploading(true);

    try {
      const { data: request, error: requestError } = await supabase
        .from('product_requests')
        .insert({
          created_by: user.id,
          product_name: formData.product_name,
          customer: formData.customer || null,
          item_description: formData.item_description || null,
          product_line: getDbProductLine(productLine, formData.has_zipper) as any,
          item_id_code: formData.item_id_code || null,
          customer_item_code: formData.customer_item_code || null,
          
          // Measurements in inches
          width_inches: formData.width_inches ? parseFloat(formData.width_inches) : null,
          length_inches: formData.length_inches ? parseFloat(formData.length_inches) : null,
          gusset_inches: formData.gusset_inches ? parseFloat(formData.gusset_inches) : null,
          zipper_inches: formData.zipper_inches ? parseFloat(formData.zipper_inches) : null,
          lip_front_inches: formData.lip_front_inches ? parseFloat(formData.lip_front_inches) : null,
          lip_back_inches: formData.lip_back_inches ? parseFloat(formData.lip_back_inches) : null,
          flip_size_inches: formData.flip_size_inches ? parseFloat(formData.flip_size_inches) : null,
          
          // Converted to cm
          width_cm: inchesToCm(formData.width_inches),
          length_cm: inchesToCm(formData.length_inches),
          gusset_cm: inchesToCm(formData.gusset_inches),
          zipper_cm: inchesToCm(formData.zipper_inches),
          lip_front_cm: inchesToCm(formData.lip_front_inches),
          lip_back_cm: inchesToCm(formData.lip_back_inches),
          flip_size_cm: inchesToCm(formData.flip_size_inches),
          
          // Thickness
          thickness_value: formData.thickness_value ? parseFloat(formData.thickness_value) : null,
          thickness_unit: formData.thickness_unit,
          
          // Film specs
          film_type: formData.film_type || null,
          seal_type: formData.seal_type || null,
          extrusion_type: formData.extrusion_type || null,
          clarity_grade: formData.clarity_grade || null,
          
          // Vents
          vents_count: formData.vents_count ? parseInt(formData.vents_count) : null,
          vent_size: formData.vent_size || null,
          vents_across: formData.vents_across ? parseInt(formData.vents_across) : null,
          vents_down: formData.vents_down ? parseInt(formData.vents_down) : null,
          
          // Wicket
          wicket_size: formData.wicket_size || null,
          wicket_hole: formData.wicket_hole || null,
          bags_per_wicket: formData.bags_per_wicket ? parseInt(formData.bags_per_wicket) : null,
          
          // Packaging
          bags_per_case: formData.bags_per_case ? parseInt(formData.bags_per_case) : null,
          cases_per_pallet: formData.cases_per_pallet ? parseInt(formData.cases_per_pallet) : null,
          pallet_size: formData.pallet_size || null,
          box_color: formData.box_color || null,
          
          // Print
          pms_colors: formData.pms_colors.length > 0 ? formData.pms_colors : null,
          eye_mark: formData.eye_mark || null,
          upc_number: formData.upc_number || null,
          language: formData.language || null,
          country_of_origin: formData.country_of_origin || null,
          
          estructura: formData.estructura || null,
          notes: formData.notes || null,
          tech_spec_filename: techSpecFile?.name || null,
          status: artworkFiles.length > 0 ? 'artwork_uploaded' : 'specs_submitted',
          engineering_status: 'pending',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload files
      if (request && (techSpecFile || artworkFiles.length > 0)) {
        const { artworkUrls, techSpecUrl } = await uploadFiles(request.id);
        
        await supabase
          .from('product_requests')
          .update({ 
            artwork_files: artworkUrls.length > 0 ? artworkUrls : null,
            tech_spec_pdf_url: techSpecUrl
          })
          .eq('id', request.id);
      }

      // Save contacts
      if (request && (clientApprovers.length > 0 || internalContacts.length > 0)) {
        const contactsToInsert = [
          ...clientApprovers.map(c => ({
            product_request_id: request.id,
            contact_type: 'client_approver' as const,
            name: c.name,
            email: c.email,
            role_description: c.role_description || null,
          })),
          ...internalContacts.map(c => ({
            product_request_id: request.id,
            contact_type: 'internal_notify' as const,
            name: c.name,
            email: c.email,
            role_description: c.role_description || null,
          })),
        ];
        
        await supabase
          .from('product_request_contacts')
          .insert(contactsToInsert);
      }

      toast.success("Product request created successfully!");
      navigate('/products');
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error("Failed to create product request");
    } finally {
      setUploading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return productLine !== null;
      case 3:
        return formData.product_name.trim().length > 0;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Select the type of product you're requesting. This helps us show the relevant specification fields.
            </p>
            <ProductLineSelector value={productLine} onChange={setProductLine} />
          </div>
        );

      case 2:
        return productLine ? (
          <TechSpecUploader
            productLine={productLine}
            file={techSpecFile}
            onFileChange={setTechSpecFile}
            onDataExtracted={handleExtractedData}
          />
        ) : null;

      case 3:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product_name">Product Name *</Label>
                <Input
                  id="product_name"
                  value={formData.product_name}
                  onChange={(e) => updateField("product_name", e.target.value)}
                  placeholder="Enter product name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Input
                  id="customer"
                  value={formData.customer}
                  onChange={(e) => updateField("customer", e.target.value)}
                  placeholder="Customer name"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item_id_code">Item ID / Destiny ID</Label>
                <Input
                  id="item_id_code"
                  value={formData.item_id_code}
                  onChange={(e) => updateField("item_id_code", e.target.value)}
                  placeholder="e.g., 9801905 - 783916"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_item_code">Customer Item Code</Label>
                <Input
                  id="customer_item_code"
                  value={formData.customer_item_code}
                  onChange={(e) => updateField("customer_item_code", e.target.value)}
                  placeholder="Customer's internal code"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_description">Item Description</Label>
              <Textarea
                id="item_description"
                value={formData.item_description}
                onChange={(e) => updateField("item_description", e.target.value)}
                placeholder="Describe the product"
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Zipper option for Sello Lateral */}
            {productLine === "sello_lateral" && (
              <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                <input
                  type="checkbox"
                  id="has_zipper"
                  checked={formData.has_zipper}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_zipper: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="has_zipper" className="cursor-pointer">
                  Includes Resealable Zipper
                </Label>
              </div>
            )}
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MeasurementInput
                id="width"
                label="Width"
                valueInches={formData.width_inches}
                onChange={(v) => updateField("width_inches", v)}
              />
              <MeasurementInput
                id="length"
                label="Length / Height"
                valueInches={formData.length_inches}
                onChange={(v) => updateField("length_inches", v)}
              />
              {(productLine === "pouch" || productLine === "sello_lateral" || productLine === "bag_wicket") && (
                <MeasurementInput
                  id="gusset"
                  label="Bottom Gusset"
                  valueInches={formData.gusset_inches}
                  onChange={(v) => updateField("gusset_inches", v)}
                />
              )}
              {(productLine === "sello_lateral" && formData.has_zipper) && (
                <MeasurementInput
                  id="zipper"
                  label="Zipper Header"
                  valueInches={formData.zipper_inches}
                  onChange={(v) => updateField("zipper_inches", v)}
                />
              )}
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MeasurementInput
                id="lip_front"
                label="Lip Front"
                valueInches={formData.lip_front_inches}
                onChange={(v) => updateField("lip_front_inches", v)}
              />
              <MeasurementInput
                id="lip_back"
                label="Lip Back"
                valueInches={formData.lip_back_inches}
                onChange={(v) => updateField("lip_back_inches", v)}
              />
              <MeasurementInput
                id="flip_size"
                label="Flip Size"
                valueInches={formData.flip_size_inches}
                onChange={(v) => updateField("flip_size_inches", v)}
              />
            </div>

            {/* Structure field for material layers */}
            <MaterialStructureInput
              value={formData.estructura}
              onChange={(v) => updateField("estructura", v)}
              label="Material Structure"
            />

            <ThicknessInput
              id="thickness"
              label="Total Film Thickness (optional)"
              value={formData.thickness_value}
              unit={formData.thickness_unit}
              onValueChange={(v) => updateField("thickness_value", v)}
              onUnitChange={(u) => updateField("thickness_unit", u)}
            />
          </div>
        );

      case 5:
        if (productLine === "bag_wicket") {
          return (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="wicket_size">Wicket Size</Label>
                  <Input
                    id="wicket_size"
                    value={formData.wicket_size}
                    onChange={(e) => updateField("wicket_size", e.target.value)}
                    placeholder="e.g., 8.5 x 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wicket_hole">Wicket Hole</Label>
                  <Input
                    id="wicket_hole"
                    value={formData.wicket_hole}
                    onChange={(e) => updateField("wicket_hole", e.target.value)}
                    placeholder="e.g., 1/4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bags_per_wicket">Bags per Wicket</Label>
                  <Input
                    id="bags_per_wicket"
                    type="number"
                    value={formData.bags_per_wicket}
                    onChange={(e) => updateField("bags_per_wicket", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          );
        }
        // Film & Vents for other product types
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="film_type">Film Type</Label>
                <Input
                  id="film_type"
                  value={formData.film_type}
                  onChange={(e) => updateField("film_type", e.target.value)}
                  placeholder="e.g., LDPE, HDPE, LLDPE"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seal_type">Seal Type</Label>
                <Input
                  id="seal_type"
                  value={formData.seal_type}
                  onChange={(e) => updateField("seal_type", e.target.value)}
                  placeholder="e.g., Side, Bottom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extrusion_type">Extrusion Type</Label>
                <Input
                  id="extrusion_type"
                  value={formData.extrusion_type}
                  onChange={(e) => updateField("extrusion_type", e.target.value)}
                  placeholder="e.g., Blown, Cast"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clarity_grade">Clarity Grade</Label>
                <Input
                  id="clarity_grade"
                  value={formData.clarity_grade}
                  onChange={(e) => updateField("clarity_grade", e.target.value)}
                  placeholder="e.g., Clear, High"
                />
              </div>
            </div>

            {productLine !== "film" && productLine !== "pouch" && (
              <>
                <h3 className="font-medium">Vent Specifications</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="vents_count">Total Vents</Label>
                    <Input
                      id="vents_count"
                      type="number"
                      value={formData.vents_count}
                      onChange={(e) => updateField("vents_count", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vent_size">Vent Size</Label>
                    <Input
                      id="vent_size"
                      value={formData.vent_size}
                      onChange={(e) => updateField("vent_size", e.target.value)}
                      placeholder='e.g., 1/4"'
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vents_across">Vents Across</Label>
                    <Input
                      id="vents_across"
                      type="number"
                      value={formData.vents_across}
                      onChange={(e) => updateField("vents_across", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vents_down">Vents Down</Label>
                    <Input
                      id="vents_down"
                      type="number"
                      value={formData.vents_down}
                      onChange={(e) => updateField("vents_down", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 6:
        if (productLine === "film") {
          // Contacts step for film
          return renderContactsStep();
        }
        // Packaging step for other types
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="bags_per_case">Bags per Case</Label>
                <Input
                  id="bags_per_case"
                  type="number"
                  value={formData.bags_per_case}
                  onChange={(e) => updateField("bags_per_case", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cases_per_pallet">Cases per Pallet</Label>
                <Input
                  id="cases_per_pallet"
                  type="number"
                  value={formData.cases_per_pallet}
                  onChange={(e) => updateField("cases_per_pallet", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pallet_size">Pallet Size</Label>
                <Input
                  id="pallet_size"
                  value={formData.pallet_size}
                  onChange={(e) => updateField("pallet_size", e.target.value)}
                  placeholder="e.g., 40 x 48"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box_color">Box Color</Label>
                <Input
                  id="box_color"
                  value={formData.box_color}
                  onChange={(e) => updateField("box_color", e.target.value)}
                  placeholder="e.g., White, Brown"
                />
              </div>
            </div>

            <h3 className="font-medium">Print Specifications</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>PMS Colors</Label>
                <div className="flex gap-2">
                  <Input
                    value={pmsColorInput}
                    onChange={(e) => setPmsColorInput(e.target.value)}
                    placeholder="e.g., PMS 186 Red"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPmsColor())}
                  />
                  <Button type="button" variant="outline" onClick={addPmsColor}>Add</Button>
                </div>
                {formData.pms_colors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.pms_colors.map((color, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {color}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removePmsColor(i)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eye_mark">Eye Mark</Label>
                  <Input
                    id="eye_mark"
                    value={formData.eye_mark}
                    onChange={(e) => updateField("eye_mark", e.target.value)}
                    placeholder="e.g., Date + DP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upc_number">UPC Number</Label>
                  <Input
                    id="upc_number"
                    value={formData.upc_number}
                    onChange={(e) => updateField("upc_number", e.target.value)}
                    placeholder="UPC barcode"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    value={formData.language}
                    onChange={(e) => updateField("language", e.target.value)}
                    placeholder="e.g., English / Spanish"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country_of_origin">Country of Origin</Label>
                  <Input
                    id="country_of_origin"
                    value={formData.country_of_origin}
                    onChange={(e) => updateField("country_of_origin", e.target.value)}
                    placeholder="e.g., USA, Mexico"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 7:
        if (productLine === "film") {
          // Artwork step for film
          return renderArtworkStep();
        }
        // Contacts step for other types
        return renderContactsStep();

      case 8:
        if (productLine === "film") {
          // Review step for film
          return renderReviewStep();
        }
        // Artwork step for other types
        return renderArtworkStep();

      case 9:
        // Review step for bag types
        return renderReviewStep();

      default:
        return null;
    }
  };

  const renderArtworkStep = () => (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-muted rounded-lg p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Upload Artwork Files</p>
          <p className="text-sm text-muted-foreground mb-4">
            Supports PDF, AI, PS, SVG, PNG, JPG
          </p>
          <label htmlFor="file-upload" className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>Choose Files</span>
            </Button>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.ai,.ps,.svg,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      </div>

      {artworkFiles.length > 0 && (
        <div className="space-y-2">
          <Label>Selected Files</Label>
          <div className="space-y-2">
            {artworkFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm truncate">{file.name}</span>
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
        </div>
      )}
    </div>
  );

  const renderContactsStep = () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Add contacts who will be involved in the design approval process and those who should receive notifications.
      </p>
      <ContactsManager
        clientApprovers={clientApprovers}
        internalContacts={internalContacts}
        onClientApproversChange={setClientApprovers}
        onInternalContactsChange={setInternalContacts}
      />
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Product Information</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Product Line</dt>
            <dd className="font-medium">{productLine ? getProductLineLabel(productLine) : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Product Name</dt>
            <dd className="font-medium">{formData.product_name || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Customer</dt>
            <dd className="font-medium">{formData.customer || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Item ID</dt>
            <dd className="font-medium">{formData.item_id_code || '-'}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Dimensions (Customer View: Inches)</h3>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Width</dt>
            <dd className="font-medium">{formData.width_inches ? `${formData.width_inches}"` : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Length</dt>
            <dd className="font-medium">{formData.length_inches ? `${formData.length_inches}"` : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Thickness</dt>
            <dd className="font-medium">
              {formData.thickness_value 
                ? `${formData.thickness_value} ${formData.thickness_unit === 'gauge' ? 'ga' : 'μm'}` 
                : '-'}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Technical Spec Sheet</h3>
        {techSpecFile ? (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <FileText className="h-5 w-5 text-primary" />
            <span>{techSpecFile.name}</span>
            <Badge variant="secondary">Will be saved</Badge>
          </div>
        ) : (
          <p className="text-muted-foreground">No spec sheet uploaded</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Artwork Files</h3>
        {artworkFiles.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {artworkFiles.map((file, index) => (
              <li key={index} className="text-sm">{file.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No files uploaded</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Any additional notes or requirements"
          rows={3}
        />
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Next steps:</strong> After submission, this request will be reviewed by 
          the engineering team. If any measurement adjustments are needed for manufacturing, 
          they will propose alternatives for your approval.
        </p>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/product-requests')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Product Request</h1>
            <p className="text-muted-foreground">
              Submit a new product for registration
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center min-w-[60px]">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                    currentStep > step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : currentStep === step.id
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className="text-xs mt-1 text-muted-foreground hidden sm:block text-center">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 sm:w-12 h-0.5 mx-1",
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps.find(s => s.id === currentStep)?.name}</CardTitle>
            <CardDescription>{steps.find(s => s.id === currentStep)?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {currentStep < lastStep ? (
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(lastStep, prev + 1))}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? "Submitting..." : "Submit Request"}
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
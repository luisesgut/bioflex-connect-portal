import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Check, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FormData {
  product_name: string;
  customer: string;
  item_description: string;
  item_type: string;
  ancho: string;
  alto: string;
  fuelle_de_fondo: string;
  pestana_al_ancho: string;
  pestana_al_alto: string;
  material: string;
  estructura: string;
  tipo_empaque: string;
  tipo_embalaje: string;
  piezas_por_paquete: string;
  paquete_por_caja: string;
  pieces_per_pallet: string;
  notes: string;
}

const initialFormData: FormData = {
  product_name: "",
  customer: "",
  item_description: "",
  item_type: "",
  ancho: "",
  alto: "",
  fuelle_de_fondo: "",
  pestana_al_ancho: "",
  pestana_al_alto: "",
  material: "",
  estructura: "",
  tipo_empaque: "",
  tipo_embalaje: "",
  piezas_por_paquete: "",
  paquete_por_caja: "",
  pieces_per_pallet: "",
  notes: "",
};

const steps = [
  { id: 1, name: "Basic Info", description: "Product name and customer" },
  { id: 2, name: "Dimensions", description: "Bag measurements" },
  { id: 3, name: "Materials", description: "Material and packaging" },
  { id: 4, name: "Artwork", description: "Upload artwork files" },
  { id: 5, name: "Review", description: "Review and submit" },
];

export default function NewProductRequest() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [artworkFiles, setArtworkFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setArtworkFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setArtworkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (requestId: string): Promise<string[]> => {
    const urls: string[] = [];
    
    for (const file of artworkFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('product-request-files')
        .upload(fileName, file);
      
      if (error) {
        console.error('Error uploading file:', error);
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('product-request-files')
        .getPublicUrl(fileName);
      
      urls.push(urlData.publicUrl);
    }
    
    return urls;
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

    setUploading(true);

    try {
      // Create the request first
      const { data: request, error: requestError } = await supabase
        .from('product_requests')
        .insert({
          created_by: user.id,
          product_name: formData.product_name,
          customer: formData.customer || null,
          item_description: formData.item_description || null,
          item_type: formData.item_type || null,
          ancho: formData.ancho ? parseFloat(formData.ancho) : null,
          alto: formData.alto ? parseFloat(formData.alto) : null,
          fuelle_de_fondo: formData.fuelle_de_fondo ? parseFloat(formData.fuelle_de_fondo) : null,
          pestana_al_ancho: formData.pestana_al_ancho ? parseFloat(formData.pestana_al_ancho) : null,
          pestana_al_alto: formData.pestana_al_alto ? parseFloat(formData.pestana_al_alto) : null,
          material: formData.material || null,
          estructura: formData.estructura || null,
          tipo_empaque: formData.tipo_empaque || null,
          tipo_embalaje: formData.tipo_embalaje || null,
          piezas_por_paquete: formData.piezas_por_paquete ? parseInt(formData.piezas_por_paquete) : null,
          paquete_por_caja: formData.paquete_por_caja ? parseInt(formData.paquete_por_caja) : null,
          pieces_per_pallet: formData.pieces_per_pallet ? parseInt(formData.pieces_per_pallet) : null,
          notes: formData.notes || null,
          status: artworkFiles.length > 0 ? 'artwork_uploaded' : 'specs_submitted',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload files if any
      if (artworkFiles.length > 0 && request) {
        const urls = await uploadFiles(request.id);
        
        if (urls.length > 0) {
          await supabase
            .from('product_requests')
            .update({ artwork_files: urls })
            .eq('id', request.id);
        }
      }

      toast.success("Product request created successfully!");
      navigate('/product-requests');
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
        return formData.product_name.trim().length > 0;
      default:
        return true;
    }
  };

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
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
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
                <span className="text-xs mt-1 text-muted-foreground hidden sm:block">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-12 sm:w-24 h-0.5 mx-2",
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
            <CardTitle>{steps[currentStep - 1].name}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep === 1 && (
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="item_type">Item Type</Label>
                  <Input
                    id="item_type"
                    value={formData.item_type}
                    onChange={(e) => updateField("item_type", e.target.value)}
                    placeholder="e.g., Bag, Pouch, etc."
                  />
                </div>
              </>
            )}

            {currentStep === 2 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ancho">Width (Ancho) mm</Label>
                  <Input
                    id="ancho"
                    type="number"
                    value={formData.ancho}
                    onChange={(e) => updateField("ancho", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alto">Height (Alto) mm</Label>
                  <Input
                    id="alto"
                    type="number"
                    value={formData.alto}
                    onChange={(e) => updateField("alto", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuelle_de_fondo">Bottom Gusset mm</Label>
                  <Input
                    id="fuelle_de_fondo"
                    type="number"
                    value={formData.fuelle_de_fondo}
                    onChange={(e) => updateField("fuelle_de_fondo", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pestana_al_ancho">Width Flap mm</Label>
                  <Input
                    id="pestana_al_ancho"
                    type="number"
                    value={formData.pestana_al_ancho}
                    onChange={(e) => updateField("pestana_al_ancho", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pestana_al_alto">Height Flap mm</Label>
                  <Input
                    id="pestana_al_alto"
                    type="number"
                    value={formData.pestana_al_alto}
                    onChange={(e) => updateField("pestana_al_alto", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="material">Material</Label>
                    <Input
                      id="material"
                      value={formData.material}
                      onChange={(e) => updateField("material", e.target.value)}
                      placeholder="e.g., LDPE, HDPE, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estructura">Structure</Label>
                    <Input
                      id="estructura"
                      value={formData.estructura}
                      onChange={(e) => updateField("estructura", e.target.value)}
                      placeholder="Material structure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_empaque">Packaging Type</Label>
                    <Input
                      id="tipo_empaque"
                      value={formData.tipo_empaque}
                      onChange={(e) => updateField("tipo_empaque", e.target.value)}
                      placeholder="Packaging type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_embalaje">Packing Type</Label>
                    <Input
                      id="tipo_embalaje"
                      value={formData.tipo_embalaje}
                      onChange={(e) => updateField("tipo_embalaje", e.target.value)}
                      placeholder="Packing type"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="piezas_por_paquete">Pieces per Package</Label>
                    <Input
                      id="piezas_por_paquete"
                      type="number"
                      value={formData.piezas_por_paquete}
                      onChange={(e) => updateField("piezas_por_paquete", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paquete_por_caja">Packages per Case</Label>
                    <Input
                      id="paquete_por_caja"
                      type="number"
                      value={formData.paquete_por_caja}
                      onChange={(e) => updateField("paquete_por_caja", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pieces_per_pallet">Pieces per Pallet</Label>
                    <Input
                      id="pieces_per_pallet"
                      type="number"
                      value={formData.pieces_per_pallet}
                      onChange={(e) => updateField("pieces_per_pallet", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 4 && (
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
                          <span className="text-sm truncate">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Basic Information</h3>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Product Name</dt>
                      <dd className="font-medium">{formData.product_name || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Customer</dt>
                      <dd className="font-medium">{formData.customer || '-'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm text-muted-foreground">Description</dt>
                      <dd className="font-medium">{formData.item_description || '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Dimensions</h3>
                  <dl className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-muted-foreground">Width</dt>
                      <dd className="font-medium">{formData.ancho ? `${formData.ancho} mm` : '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Height</dt>
                      <dd className="font-medium">{formData.alto ? `${formData.alto} mm` : '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Bottom Gusset</dt>
                      <dd className="font-medium">{formData.fuelle_de_fondo ? `${formData.fuelle_de_fondo} mm` : '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Materials & Packaging</h3>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Material</dt>
                      <dd className="font-medium">{formData.material || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Structure</dt>
                      <dd className="font-medium">{formData.estructura || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Pieces per Pallet</dt>
                      <dd className="font-medium">{formData.pieces_per_pallet || '-'}</dd>
                    </div>
                  </dl>
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
              </div>
            )}
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

          {currentStep < steps.length ? (
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length, prev + 1))}
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

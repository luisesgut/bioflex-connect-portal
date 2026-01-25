import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductLine } from "./ProductLineSelector";

interface ExtractedData {
  product_name?: string;
  customer?: string;
  item_id_code?: string;
  customer_item_code?: string;
  width_inches?: number;
  length_inches?: number;
  gusset_inches?: number;
  zipper_inches?: number;
  lip_front_inches?: number;
  lip_back_inches?: number;
  flip_size_inches?: number;
  width_cm?: number;
  length_cm?: number;
  gusset_cm?: number;
  zipper_cm?: number;
  lip_front_cm?: number;
  lip_back_cm?: number;
  flip_size_cm?: number;
  thickness_value?: number;
  thickness_unit?: "gauge" | "microns";
  film_type?: string;
  seal_type?: string;
  extrusion_type?: string;
  clarity_grade?: string;
  vents_count?: number;
  vent_size?: string;
  vents_across?: number;
  vents_down?: number;
  wicket_size?: string;
  wicket_hole?: string;
  bags_per_wicket?: number;
  bags_per_case?: number;
  cases_per_pallet?: number;
  pallet_size?: string;
  box_color?: string;
  pms_colors?: string[];
  eye_mark?: string;
  upc_number?: string;
  language?: string;
  country_of_origin?: string;
  notes?: string;
}

interface TechSpecUploaderProps {
  productLine: ProductLine;
  onFileChange: (file: File | null) => void;
  onDataExtracted: (data: ExtractedData) => void;
  file: File | null;
}

export function TechSpecUploader({ 
  productLine, 
  onFileChange, 
  onDataExtracted,
  file 
}: TechSpecUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState<"idle" | "success" | "error">("idle");
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      onFileChange(droppedFile);
      setExtractionStatus("idle");
    }
  }, [onFileChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      onFileChange(selectedFile);
      setExtractionStatus("idle");
    }
  };

  const isValidFile = (f: File) => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    const validExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".ai", ".ps", ".svg"];
    return validTypes.includes(f.type) || validExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
  };

  const removeFile = () => {
    onFileChange(null);
    setExtractionStatus("idle");
    setExtractionError(null);
  };

  const extractData = async () => {
    if (!file) return;

    setExtracting(true);
    setExtractionProgress(0);
    setExtractionError(null);
    setExtractionStatus("idle");

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExtractionProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("productLine", productLine);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-product-specs`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      clearInterval(progressInterval);
      setExtractionProgress(100);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to extract data");
      }

      if (result.success && result.data) {
        onDataExtracted(result.data);
        setExtractionStatus("success");
      } else {
        throw new Error("No data extracted");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      setExtractionError(error instanceof Error ? error.message : "Extraction failed");
      setExtractionStatus("error");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted",
          file && "border-solid"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!file ? (
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Upload Technical Spec Sheet</p>
            <p className="text-sm text-muted-foreground mb-4">
              PDF, AI, PS, SVG, PNG, or JPG file from customer
            </p>
            <label htmlFor="tech-spec-upload" className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>Choose File</span>
              </Button>
              <input
                id="tech-spec-upload"
                type="file"
                accept=".pdf,.ai,.ps,.svg,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium truncate max-w-xs">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={removeFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Extraction UI */}
            {extracting ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Extracting specifications with AI...</span>
                </div>
                <Progress value={extractionProgress} />
              </div>
            ) : extractionStatus === "success" ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>Data extracted successfully! Form fields have been populated.</span>
              </div>
            ) : extractionStatus === "error" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{extractionError || "Extraction failed"}</span>
                </div>
                <Button variant="outline" size="sm" onClick={extractData}>
                  Try Again
                </Button>
              </div>
            ) : (
              <Button onClick={extractData} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                Extract Data with AI
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Upload the customer's Technical Data Sheet (TDS/FT). Our AI will extract measurements 
        and specifications to pre-fill the form. All measurements will be captured in inches 
        and automatically converted to centimeters.
      </p>
    </div>
  );
}
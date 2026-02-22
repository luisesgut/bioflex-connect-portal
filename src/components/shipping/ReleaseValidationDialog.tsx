import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, CheckCircle, XCircle, AlertTriangle, Pause, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LoadPallet {
  id: string;
  pallet_id: string;
  quantity: number;
  is_on_hold: boolean;
  release_number: string | null;
  release_pdf_url: string | null;
  pallet: {
    pt_code: string;
    description: string;
    customer_lot: string | null;
  };
}

interface ReleaseValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPallets: LoadPallet[];
  loadId: string;
  destinationOptions?: { value: string; label: string }[];
  onAddDestination?: () => void;
  onComplete: () => void;
}

interface ValidationResult {
  valid: boolean;
  releaseNumber: string | null;
  matchedProducts: string[];
  unmatchedProducts: string[];
  message: string;
}

// predefinedDestinations removed – now passed via props

export function ReleaseValidationDialog({
  open,
  onOpenChange,
  selectedPallets,
  loadId,
  destinationOptions = [],
  onAddDestination,
  onComplete,
}: ReleaseValidationDialogProps) {
  const [activeTab, setActiveTab] = useState<"release" | "hold">("release");
  const [processing, setProcessing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualReleaseNumber, setManualReleaseNumber] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setValidating(true);
    setValidationResult(null);

    try {
      const fileName = `temp-validation/${loadId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("release-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("release-documents")
        .getPublicUrl(fileName);

      const response = await supabase.functions.invoke("extract-po-data", {
        body: {
          pdfUrl: urlData.publicUrl,
          validationMode: true,
          expectedProducts: selectedPallets.map((p) => ({
            pt_code: p.pallet.pt_code,
            description: p.pallet.description,
            customer_lot: p.pallet.customer_lot,
          })),
        },
      });

      if (response.error) {
        console.error("AI validation error:", response.error);
        setValidationResult({
          valid: true,
          releaseNumber: null,
          matchedProducts: [],
          unmatchedProducts: [],
          message: "Could not auto-validate. Please enter release number manually.",
        });
      } else {
        const data = response.data;
        setValidationResult({
          valid: data.valid !== false,
          releaseNumber: data.releaseNumber || null,
          matchedProducts: data.matchedProducts || [],
          unmatchedProducts: data.unmatchedProducts || [],
          message: data.message || "Validation complete",
        });

        if (data.releaseNumber) {
          setManualReleaseNumber(data.releaseNumber);
        }
      }
    } catch (error) {
      console.error("Validation error:", error);
      setValidationResult({
        valid: true,
        releaseNumber: null,
        matchedProducts: [],
        unmatchedProducts: [],
        message: "Validation unavailable. Please proceed with manual release number.",
      });
    } finally {
      setValidating(false);
    }
  };

  const getDestinationValue = (): string => {
    return selectedDestination;
  };

  const handleRelease = async () => {
    if (!manualReleaseNumber.trim()) {
      toast.error("Please enter a release number");
      return;
    }

    const destinationValue = getDestinationValue();
    if (!destinationValue) {
      toast.error("Please select a destination");
      return;
    }

    setProcessing(true);
    try {
      let storagePath: string | null = null;

      // Upload PDF if provided (optional)
      if (selectedFile) {
        const fileName = `batch-releases/${loadId}/${Date.now()}_${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("release-documents")
          .upload(fileName, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;
        storagePath = `release-documents:${fileName}`;
      }

      // Update all selected pallets with release info and destination
      const palletIds = selectedPallets.map((p) => p.id);
      const updateData: Record<string, any> = {
        release_number: manualReleaseNumber.trim(),
        destination: destinationValue,
        is_on_hold: false,
      };
      if (storagePath) {
        updateData.release_pdf_url = storagePath;
      }

      const { error: updateError } = await supabase
        .from("load_pallets")
        .update(updateData)
        .in("id", palletIds);

      if (updateError) throw updateError;

      toast.success(`${palletIds.length} pallet(s) released to ${destinationValue}`);
      resetAndClose();
      onComplete();
    } catch (error) {
      console.error("Error releasing pallets:", error);
      toast.error("Failed to release pallets");
    } finally {
      setProcessing(false);
    }
  };

  const handlePutOnHold = async () => {
    setProcessing(true);
    try {
      const palletIds = selectedPallets.map((p) => p.id);
      const { error } = await supabase
        .from("load_pallets")
        .update({ is_on_hold: true })
        .in("id", palletIds);

      if (error) throw error;

      toast.success(`${palletIds.length} pallet(s) placed on hold`);
      resetAndClose();
      onComplete();
    } catch (error) {
      console.error("Error putting pallets on hold:", error);
      toast.error("Failed to update pallets");
    } finally {
      setProcessing(false);
    }
  };

  const resetAndClose = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setManualReleaseNumber("");
    setSelectedDestination("");
    setCustomDestination("");
    setShowCustomInput(false);
    setActiveTab("release");
    onOpenChange(false);
  };

  const handleDestinationChange = (value: string) => {
    if (value === "__custom__") {
      if (onAddDestination) {
        onAddDestination();
      }
    } else {
      setShowCustomInput(false);
      setCustomDestination("");
      setSelectedDestination(value);
    }
  };

  const isReleaseValid = manualReleaseNumber.trim() && selectedDestination;

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Process Selected Pallets ({selectedPallets.length})</DialogTitle>
          <DialogDescription>
            Release or put the selected pallets on hold
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "release" | "hold")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="release" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Release
            </TabsTrigger>
            <TabsTrigger value="hold" className="flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Put On Hold
            </TabsTrigger>
          </TabsList>

          <TabsContent value="release" className="space-y-4 mt-4">
            {/* Selected Pallets Summary */}
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium text-sm mb-2">Selected Pallets</h4>
              <ScrollArea className="h-24">
                <ul className="space-y-1 text-xs">
                  {selectedPallets.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="truncate max-w-[250px]">{p.pallet.description}</span>
                      <span className="text-muted-foreground ml-2">{p.quantity.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>

            {/* Release Number (required) */}
            <div className="space-y-2">
              <Label htmlFor="release-number">Release Number <span className="text-destructive">*</span></Label>
              <Input
                id="release-number"
                value={manualReleaseNumber}
                onChange={(e) => setManualReleaseNumber(e.target.value)}
                placeholder="Enter release number"
                disabled={processing}
              />
            </div>

            {/* Destination (required) */}
            <div className="space-y-2">
              <Label>Destination <span className="text-destructive">*</span></Label>
              <Select
                value={showCustomInput ? "__custom__" : selectedDestination}
                onValueChange={handleDestinationChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((dest) => (
                    <SelectItem key={dest.value} value={dest.value}>
                      {dest.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    <span className="flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      Add new destination
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {showCustomInput && onAddDestination && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onAddDestination();
                    setShowCustomInput(false);
                    setSelectedDestination("");
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Open new destination form
                </Button>
              )}
            </div>

            {/* PDF Upload (optional) */}
            <div className="space-y-2">
              <Label htmlFor="release-pdf">Release Authorization PDF <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input
                id="release-pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                disabled={processing || validating}
              />
            </div>

            {/* Validation Status */}
            {validating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating PDF with AI...
              </div>
            )}

            {validationResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  validationResult.valid
                    ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900"
                    : "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-900"
                }`}
              >
                <div className="flex items-start gap-2">
                  {validationResult.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p>{validationResult.message}</p>
                    {validationResult.releaseNumber && (
                      <p className="mt-1 font-medium">
                        Detected Release #: {validationResult.releaseNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hold" className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <Pause className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Placing {selectedPallets.length} pallet(s) on hold will prevent them from being shipped
                until they are released.
              </p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Pallets to Hold</h4>
              <ScrollArea className="h-32">
                <ul className="space-y-1 text-xs">
                  {selectedPallets.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="truncate max-w-[250px]">{p.pallet.description}</span>
                      <span className="text-muted-foreground ml-2">{p.quantity.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={processing}>
            Cancel
          </Button>
          {activeTab === "release" ? (
            <Button
              onClick={handleRelease}
              disabled={!isReleaseValid || processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Release Pallets
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handlePutOnHold}
              disabled={processing}
              variant="destructive"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Put On Hold
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Package, Plus, Minus, Flame, Calendar, Info, DollarSign, Search, Upload, FileText, X, Loader2, Clock } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Product {
  id: string;
  name: string;
  sku: string;
  units: string | null;
  piezas_totales_por_caja: number | null;
  pieces_per_pallet: number | null;
  customer_item: string | null;
  item_description: string | null;
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [poNumberError, setPoNumberError] = useState<string | null>(null);
  const [checkingPoNumber, setCheckingPoNumber] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(10000);
  const [quantityInput, setQuantityInput] = useState<string>("10,000");
  const [pricePerThousand, setPricePerThousand] = useState<number>(0);
  const [isHotOrder, setIsHotOrder] = useState(false);
  const [doNotDelay, setDoNotDelay] = useState(false);
  const [notes, setNotes] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [poDate, setPoDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, units, piezas_totales_por_caja, pieces_per_pallet, customer_item, item_description")
        .order("name");

      if (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products");
      } else {
        setProducts(data || []);
        
        // Pre-select product from URL param
        const productIdFromUrl = searchParams.get("productId");
        if (productIdFromUrl && data?.some(p => p.id === productIdFromUrl)) {
          setSelectedProductId(productIdFromUrl);
        }
      }
      setLoading(false);
    };

    fetchProducts();
  }, [searchParams]);

  // Check for duplicate PO number with debounce
  useEffect(() => {
    if (!poNumber.trim()) {
      setPoNumberError(null);
      return;
    }

    const checkDuplicate = async () => {
      setCheckingPoNumber(true);
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("po_number", poNumber.trim())
        .maybeSingle();

      if (error) {
        console.error("Error checking PO number:", error);
      } else if (data) {
        setPoNumberError("This PO number already exists");
      } else {
        setPoNumberError(null);
      }
      setCheckingPoNumber(false);
    };

    const debounceTimer = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(debounceTimer);
  }, [poNumber]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const totalPrice = useMemo(() => {
    return (pricePerThousand * quantity) / 1000;
  }, [pricePerThousand, quantity]);

  const palletsNeeded = useMemo(() => {
    if (!selectedProduct?.piezas_totales_por_caja || !selectedProduct?.pieces_per_pallet) {
      return null;
    }
    return Math.ceil(quantity / selectedProduct.pieces_per_pallet);
  }, [quantity, selectedProduct]);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploadedFile(file);
    toast.success('PDF attached successfully!');
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to create an order");
      return;
    }

    if (!poNumber.trim()) {
      toast.error("Please enter a PO number");
      return;
    }

    if (poNumberError) {
      toast.error("Please use a unique PO number");
      return;
    }
    
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    if (quantity < 1000) {
      toast.error("Minimum order quantity is 1,000 units");
      return;
    }

    setSubmitting(true);

    try {
      // Upload PDF if attached
      let pdfUrl: string | null = null;
      if (uploadedFile) {
        const fileName = `${user.id}/${poNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('ncr-attachments')
          .upload(fileName, uploadedFile);

        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast.error('Failed to upload PDF');
          setSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('ncr-attachments')
          .getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }

      // Insert purchase order
      const { error } = await supabase.from("purchase_orders").insert({
        user_id: user.id,
        po_number: poNumber.trim(),
        po_date: poDate,
        product_id: selectedProductId,
        quantity,
        price_per_thousand: pricePerThousand || null,
        total_price: totalPrice || null,
        pallets_needed: palletsNeeded || null,
        requested_delivery_date: requestedDate === "ASAP" ? null : (requestedDate || null),
        is_hot_order: isHotOrder,
        do_not_delay: doNotDelay,
        notes: notes || null,
        pdf_url: pdfUrl,
      });

      if (error) {
        console.error("Error creating order:", error);
        if (error.code === '23505') {
          toast.error("This PO number already exists");
          setPoNumberError("This PO number already exists");
        } else {
          toast.error("Failed to create order");
        }
        return;
      }

      toast.success("Purchase order created successfully!", {
        description: `PO #${poNumber} for ${quantity.toLocaleString()} ${selectedProduct?.units || 'units'} of ${selectedProduct?.name}`,
      });
      
      navigate("/orders");
    } catch (err) {
      console.error("Error submitting order:", err);
      toast.error("Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const adjustQuantity = (amount: number) => {
    const newQuantity = Math.max(1000, quantity + amount);
    setQuantity(newQuantity);
    setQuantityInput(newQuantity.toLocaleString());
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/orders">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create Purchase Order
            </h1>
            <p className="mt-1 text-muted-foreground">
              Submit a new order for your custom packaging products
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* PDF Upload Section */}
          <div className="rounded-xl border border-dashed border-accent/50 bg-gradient-to-br from-accent/5 to-accent/10 p-6 shadow-card animate-slide-up">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-4">
              <Upload className="h-5 w-5 text-accent" />
              Attach PO Document
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload the PDF of your purchase order
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            
            <div className="flex items-center gap-4">
              {!uploadedFile ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Upload PO PDF
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <FileText className="h-4 w-4 text-accent" />
                  <span className="text-sm text-card-foreground">{uploadedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2"
                    onClick={removeUploadedFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* PO Information */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <Calendar className="h-5 w-5 text-accent" />
              PO Information
            </h2>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="po-number">PO Number *</Label>
                <div className="relative">
                  <Input
                    id="po-number"
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Enter PO number"
                    className={cn("h-12", poNumberError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {checkingPoNumber && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {poNumberError && (
                  <p className="text-sm text-destructive">{poNumberError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-date">PO Order Date</Label>
                <Input
                  id="po-date"
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <Package className="h-5 w-5 text-accent" />
              Product Selection
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Select Product *</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full h-12 justify-between text-left font-normal"
                    >
                      {selectedProduct ? (
                        <div className="flex flex-col items-start">
                          <span>{[selectedProduct.customer_item, selectedProduct.item_description].filter(Boolean).join(' - ') || selectedProduct.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Unit: {selectedProduct.units || '-'} • {selectedProduct.pieces_per_pallet?.toLocaleString() || '-'} per pallet
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {loading ? "Loading products..." : "Search and select a product..."}
                        </span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by product name..." />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => {
                            const displayName = [product.customer_item, product.item_description].filter(Boolean).join(' - ') || product.name;
                            return (
                              <CommandItem
                                key={product.id}
                                value={displayName}
                                onSelect={() => {
                                  setSelectedProductId(product.id);
                                  setOpen(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span>{displayName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Unit: {product.units || '-'} • {product.pieces_per_pallet?.toLocaleString() || '-'} per pallet
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity {selectedProduct?.units ? `(${selectedProduct.units})` : "(units)"} *
                </Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustQuantity(-5000)}
                    className="shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="quantity"
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/[^0-9]/g, '');
                      setQuantityInput(rawValue ? parseInt(rawValue).toLocaleString() : '');
                      setQuantity(parseInt(rawValue) || 0);
                    }}
                    onBlur={() => {
                      if (quantity < 1000) {
                        setQuantity(1000);
                        setQuantityInput("1,000");
                      }
                    }}
                    className="text-center text-lg font-semibold h-12"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustQuantity(5000)}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <DollarSign className="h-5 w-5 text-accent" />
              Pricing
            </h2>
            
            <div className="space-y-2">
              <Label htmlFor="price">Price per Thousand Units ($)</Label>
              <Input
                id="price"
                type="number"
                value={pricePerThousand || ""}
                onChange={(e) => setPricePerThousand(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.01}
                placeholder="Enter price per 1,000 units"
                className="h-12 max-w-xs"
              />
            </div>
          </div>

          {/* Delivery & Priority */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <Calendar className="h-5 w-5 text-accent" />
              Delivery & Priority
            </h2>
            
            <div className="space-y-6">
              <div className={cn(
                "flex items-center justify-between rounded-lg border p-4 transition-all duration-300",
                isHotOrder 
                  ? "border-accent bg-accent/5 shadow-glow" 
                  : "border-border bg-muted/20"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    isHotOrder ? "bg-accent/20" : "bg-muted"
                  )}>
                    <Flame className={cn(
                      "h-5 w-5 transition-colors",
                      isHotOrder ? "text-accent" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <Label htmlFor="hot-order" className="text-base cursor-pointer">
                      Mark as Hot Order
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Prioritize this order in production queue
                    </p>
                  </div>
                </div>
                <Switch
                  id="hot-order"
                  checked={isHotOrder}
                  onCheckedChange={(checked) => {
                    setIsHotOrder(checked);
                    if (checked) {
                      setRequestedDate("ASAP");
                    } else if (requestedDate === "ASAP") {
                      setRequestedDate("");
                    }
                  }}
                />
              </div>

              <div className={cn(
                "flex items-center justify-between rounded-lg border p-4 transition-all duration-300",
                doNotDelay 
                  ? "border-yellow-500 bg-yellow-500/5 shadow-sm" 
                  : "border-border bg-muted/20"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    doNotDelay ? "bg-yellow-500/20" : "bg-muted"
                  )}>
                    <Clock className={cn(
                      "h-5 w-5 transition-colors",
                      doNotDelay ? "text-yellow-600" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <Label htmlFor="do-not-delay" className="text-base cursor-pointer">
                      Do Not Delay
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Mark this order as time-sensitive
                    </p>
                  </div>
                </div>
                <Switch
                  id="do-not-delay"
                  checked={doNotDelay}
                  onCheckedChange={setDoNotDelay}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Requested Delivery Date</Label>
                {isHotOrder ? (
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={requestedDate === "ASAP" ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-12",
                        requestedDate === "ASAP" && "bg-accent text-accent-foreground hover:bg-accent/90"
                      )}
                      onClick={() => setRequestedDate("ASAP")}
                    >
                      <Flame className="mr-2 h-4 w-4" />
                      ASAP
                    </Button>
                    <Button
                      type="button"
                      variant={requestedDate !== "ASAP" && requestedDate !== "" ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-12",
                        requestedDate !== "ASAP" && requestedDate !== "" && "bg-accent text-accent-foreground hover:bg-accent/90"
                      )}
                      onClick={() => setRequestedDate("")}
                    >
                      Specific Date
                    </Button>
                  </div>
                ) : null}
                {(!isHotOrder || (isHotOrder && requestedDate !== "ASAP")) && (
                  <Input
                    id="date"
                    type="date"
                    value={requestedDate === "ASAP" ? "" : requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="h-12"
                  />
                )}
                {isHotOrder && requestedDate === "ASAP" && (
                  <p className="text-sm text-muted-foreground">
                    This order will be prioritized. Bioflex will confirm the delivery date within 2 days.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <Info className="h-5 w-5 text-accent" />
              Additional Notes
            </h2>
            
            <Textarea
              placeholder="Add any special instructions, artwork changes, or notes for this order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Order Summary */}
          <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <h2 className="text-lg font-semibold text-card-foreground mb-4">
              Order Summary
            </h2>
            
            <div className="space-y-3">
              {poNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PO Number</span>
                  <span className="font-medium text-card-foreground">
                    {poNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PO Date</span>
                <span className="font-medium text-card-foreground">
                  {poDate ? new Date(poDate).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium text-card-foreground">
                  {selectedProduct?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-medium text-card-foreground">
                  {quantity.toLocaleString()} {selectedProduct?.units || 'units'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per 1,000</span>
                <span className="font-medium text-card-foreground">
                  ${pricePerThousand.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pallets</span>
                <span className="font-medium text-card-foreground">
                  {palletsNeeded !== null ? palletsNeeded.toLocaleString() : "—"}
                </span>
              </div>
              {isHotOrder && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <span className="flex items-center gap-1 font-semibold text-accent">
                    <Flame className="h-4 w-4" />
                    Hot Order
                  </span>
                </div>
              )}
              <div className="border-t border-accent/20 pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-base font-medium text-card-foreground">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-accent">
                    ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <Link to="/orders">
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              variant="accent" 
              size="lg" 
              className="w-full sm:w-auto gap-2"
              disabled={submitting || !!poNumberError}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Purchase Order"
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Plus, Minus, Flame, Calendar, Info, DollarSign, Search } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(10000);
  const [pricePerThousand, setPricePerThousand] = useState<number>(0);
  const [isHotOrder, setIsHotOrder] = useState(false);
  const [notes, setNotes] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [poDate, setPoDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, units, piezas_totales_por_caja, pieces_per_pallet")
        .order("name");

      if (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products");
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

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
    const bagsPerPallet = selectedProduct.piezas_totales_por_caja * (selectedProduct.pieces_per_pallet / selectedProduct.piezas_totales_por_caja);
    // pieces_per_pallet is total pieces per pallet
    return Math.ceil(quantity / selectedProduct.pieces_per_pallet);
  }, [quantity, selectedProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    if (quantity < 1000) {
      toast.error("Minimum order quantity is 1,000 units");
      return;
    }

    toast.success("Purchase order created successfully!", {
      description: `PO for ${quantity.toLocaleString()} ${selectedProduct?.units || 'units'} of ${selectedProduct?.name}`,
    });
    
    navigate("/orders");
  };

  const adjustQuantity = (amount: number) => {
    const newQuantity = Math.max(1000, quantity + amount);
    setQuantity(newQuantity);
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
          {/* PO Date */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <Calendar className="h-5 w-5 text-accent" />
              PO Information
            </h2>
            
            <div className="space-y-2">
              <Label htmlFor="po-date">PO Order Date</Label>
              <Input
                id="po-date"
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                className="h-12 max-w-xs"
              />
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
                          <span>{selectedProduct.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {selectedProduct.sku}
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
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                setSelectedProductId(product.id);
                                setOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span>{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {product.sku} • Units: {product.units || '-'}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
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
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1000, parseInt(e.target.value) || 0))}
                    min={1000}
                    step={1000}
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
                <p className="text-xs text-muted-foreground">
                  Minimum order: 1,000 {selectedProduct?.units || 'units'}
                </p>
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
              <div className="space-y-2">
                <Label htmlFor="date">Requested Delivery Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="h-12"
                />
              </div>

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
                  onCheckedChange={setIsHotOrder}
                />
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
              {palletsNeeded !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pallets Needed</span>
                  <span className="font-medium text-card-foreground">
                    {palletsNeeded.toLocaleString()}
                  </span>
                </div>
              )}
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
            <Button type="submit" variant="accent" size="lg" className="w-full sm:w-auto gap-2">
              Submit Purchase Order
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

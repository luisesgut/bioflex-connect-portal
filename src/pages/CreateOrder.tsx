import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Plus, Minus, Flame, Calendar, Info } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
}

const products: Product[] = [
  { id: "1", name: "Custom Stand-Up Pouch - 12oz", sku: "SUP-12OZ-001", unitPrice: 0.25 },
  { id: "2", name: "Resealable Flat Pouch - 8oz", sku: "RFP-8OZ-002", unitPrice: 0.18 },
  { id: "3", name: "Gusseted Bag - 2lb", sku: "GB-2LB-003", unitPrice: 0.22 },
  { id: "4", name: "Vacuum Seal Pouch - 16oz", sku: "VSP-16OZ-004", unitPrice: 0.30 },
  { id: "5", name: "Spouted Pouch - 32oz", sku: "SP-32OZ-005", unitPrice: 0.50 },
  { id: "6", name: "Retort Pouch - 10oz", sku: "RP-10OZ-006", unitPrice: 0.29 },
];

export default function CreateOrder() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(10000);
  const [isHotOrder, setIsHotOrder] = useState(false);
  const [notes, setNotes] = useState("");
  const [requestedDate, setRequestedDate] = useState("");

  const product = products.find(p => p.id === selectedProduct);
  const estimatedTotal = product ? (product.unitPrice * quantity).toFixed(2) : "0.00";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }

    if (quantity < 1000) {
      toast.error("Minimum order quantity is 1,000 units");
      return;
    }

    toast.success("Purchase order created successfully!", {
      description: `PO for ${quantity.toLocaleString()} units of ${product?.name}`,
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
          {/* Product Selection */}
          <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground mb-6">
              <Package className="h-5 w-5 text-accent" />
              Product Selection
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Select Product *</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger id="product" className="h-12">
                    <SelectValue placeholder="Choose a product from your catalog" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {product.sku} • ${product.unitPrice}/unit
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (units) *</Label>
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
                  Minimum order: 1,000 units
                </p>
              </div>
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
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium text-card-foreground">
                  {product?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-medium text-card-foreground">
                  {quantity.toLocaleString()} units
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unit Price</span>
                <span className="font-medium text-card-foreground">
                  ${product?.unitPrice.toFixed(2) || "0.00"}
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
                    Estimated Total
                  </span>
                  <span className="text-2xl font-bold text-accent">
                    ${parseFloat(estimatedTotal).toLocaleString()}
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

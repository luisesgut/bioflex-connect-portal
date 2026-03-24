import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, GripVertical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HotOrder {
  id: string;
  po_number: string;
  product_name: string | null;
  quantity: number;
  hot_order_priority: number | null;
  product_item_type: string | null;
}

interface HotOrderPriorityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The PO being converted to hot order */
  orderId: string;
  orderPoNumber: string;
  orderProductName: string | null;
  orderQuantity: number;
  /** The product family/category for filtering */
  productItemType: string | null;
  /** Called after priorities are saved */
  onSaved: () => void;
}

export function HotOrderPriorityDialog({
  open,
  onOpenChange,
  orderId,
  orderPoNumber,
  orderProductName,
  orderQuantity,
  productItemType,
  onSaved,
}: HotOrderPriorityDialogProps) {
  const [existingHotOrders, setExistingHotOrders] = useState<HotOrder[]>([]);
  const [orderedList, setOrderedList] = useState<HotOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fetchExistingHotOrders = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      // Fetch all existing hot orders with their product info
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, quantity, is_hot_order, hot_order_priority, product_id, products(name, item_type, product_line)")
        .eq("is_hot_order", true)
        .neq("id", orderId)
        .in("status", ["pending", "submitted", "accepted", "in-production"]);

      if (error) throw error;

      // Filter by same product category
      const filtered = (data || [])
        .map((o: any) => ({
          id: o.id,
          po_number: o.po_number,
          product_name: o.products?.name || null,
          quantity: o.quantity,
          hot_order_priority: o.hot_order_priority,
          product_item_type: o.products?.item_type || o.products?.product_line || null,
        }))
        .filter((o: HotOrder) => {
          if (!productItemType || productItemType === "Unassigned") return true;
          return o.product_item_type === productItemType;
        })
        .sort((a: HotOrder, b: HotOrder) => {
          const pa = a.hot_order_priority ?? 999;
          const pb = b.hot_order_priority ?? 999;
          return pa - pb;
        });

      setExistingHotOrders(filtered);

      // Insert new order at position 0 (highest priority by default)
      const newOrder: HotOrder = {
        id: orderId,
        po_number: orderPoNumber,
        product_name: orderProductName,
        quantity: orderQuantity,
        hot_order_priority: null,
        product_item_type: productItemType,
      };
      setOrderedList([newOrder, ...filtered]);
    } catch (err) {
      console.error("Error fetching hot orders:", err);
    } finally {
      setLoading(false);
    }
  }, [open, orderId, orderPoNumber, orderProductName, orderQuantity, productItemType]);

  useEffect(() => {
    fetchExistingHotOrders();
  }, [fetchExistingHotOrders]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newList = [...orderedList];
    const [removed] = newList.splice(draggedIndex, 1);
    newList.splice(index, 0, removed);
    setOrderedList(newList);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update priorities for all orders in the list
      const updates = orderedList.map((order, index) => 
        supabase
          .from("purchase_orders")
          .update({ 
            hot_order_priority: index + 1,
            ...(order.id === orderId ? { is_hot_order: true } : {}),
          })
          .eq("id", order.id)
      );

      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      
      if (hasError) {
        throw new Error("Failed to update some priorities");
      }

      toast.success("Hot order priorities updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Error saving priorities:", err);
      toast.error("Failed to save priorities");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    // Just set as hot order without priority
    setSaving(true);
    try {
      const maxPriority = existingHotOrders.reduce(
        (max, o) => Math.max(max, o.hot_order_priority ?? 0), 0
      );
      await supabase
        .from("purchase_orders")
        .update({ is_hot_order: true, hot_order_priority: maxPriority + 1 })
        .eq("id", orderId);

      toast.success("Marked as Hot Order");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" />
            Set Hot Order Priority
          </DialogTitle>
          <DialogDescription>
            {productItemType && productItemType !== "Unassigned" ? (
              <>
                There {existingHotOrders.length === 1 ? "is" : "are"}{" "}
                <strong>{existingHotOrders.length}</strong> existing hot order{existingHotOrders.length !== 1 && "s"} in{" "}
                <strong>{productItemType}</strong>. Drag to set priority (1 = highest).
              </>
            ) : (
              <>Drag to set the priority order among hot orders.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : existingHotOrders.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No other hot orders in this category. This will be priority #1.
          </div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {orderedList.map((order, index) => {
              const isNew = order.id === orderId;
              return (
                <div
                  key={order.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-grab active:cursor-grabbing transition-colors ${
                    isNew
                      ? "bg-destructive/5 border-destructive/30 ring-1 ring-destructive/20"
                      : "bg-card border-border"
                  } ${
                    dragOverIndex === index && draggedIndex !== index
                      ? "border-primary border-2"
                      : ""
                  } ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Badge
                    variant={isNew ? "destructive" : "secondary"}
                    className="min-w-[28px] justify-center text-xs"
                  >
                    {index + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">
                        {order.po_number}
                      </span>
                      {isNew && (
                        <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.product_name || "No product"} · {order.quantity.toLocaleString()} units
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          {existingHotOrders.length > 0 ? (
            <>
              <Button variant="ghost" onClick={handleSkip} disabled={saving}>
                Skip (add last)
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Priorities
              </Button>
            </>
          ) : (
            <Button onClick={handleSkip} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Hot Order
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

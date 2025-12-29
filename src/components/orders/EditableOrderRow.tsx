import { useState } from "react";
import { Flame, MoreVertical, Download, Eye, CheckCircle2, FileEdit, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  po_number: string;
  product_name: string | null;
  quantity: number;
  total_price: number | null;
  status: string;
  is_hot_order: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  pdf_url: string | null;
  sales_order_number: string | null;
}

interface EditableOrderRowProps {
  order: Order;
  isAdmin: boolean;
  statusStyles: Record<string, string>;
  statusLabels: Record<string, string>;
  formatDate: (date: string | null) => string;
  formatCurrency: (value: number | null) => string;
  onAcceptOrder: (order: Order) => void;
  onRequestChange: (order: Order) => void;
  onUpdated: () => void;
}

const statusOptions = [
  { value: "pending", label: "Submitted" },
  { value: "submitted", label: "Submitted" },
  { value: "accepted", label: "Accepted" },
  { value: "in-production", label: "In Production" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function EditableOrderRow({
  order,
  isAdmin,
  statusStyles,
  statusLabels,
  formatDate,
  formatCurrency,
  onAcceptOrder,
  onRequestChange,
  onUpdated,
}: EditableOrderRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedOrder, setEditedOrder] = useState({
    quantity: order.quantity,
    total_price: order.total_price,
    status: order.status,
    is_hot_order: order.is_hot_order,
    requested_delivery_date: order.requested_delivery_date || "",
    estimated_delivery_date: order.estimated_delivery_date || "",
    sales_order_number: order.sales_order_number || "",
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        quantity: editedOrder.quantity,
        total_price: editedOrder.total_price,
        status: editedOrder.status,
        is_hot_order: editedOrder.is_hot_order,
        requested_delivery_date: editedOrder.requested_delivery_date || null,
        estimated_delivery_date: editedOrder.estimated_delivery_date || null,
        sales_order_number: editedOrder.sales_order_number || null,
      })
      .eq("id", order.id);

    setSaving(false);

    if (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    } else {
      toast.success("Order updated successfully");
      setIsEditing(false);
      onUpdated();
    }
  };

  const handleCancel = () => {
    setEditedOrder({
      quantity: order.quantity,
      total_price: order.total_price,
      status: order.status,
      is_hot_order: order.is_hot_order,
      requested_delivery_date: order.requested_delivery_date || "",
      estimated_delivery_date: order.estimated_delivery_date || "",
      sales_order_number: order.sales_order_number || "",
    });
    setIsEditing(false);
  };

  if (isAdmin && isEditing) {
    return (
      <tr className="transition-colors bg-accent/5">
        <td className="whitespace-nowrap px-6 py-4">
          {order.pdf_url ? (
            <a 
              href={order.pdf_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono text-sm font-medium text-primary hover:underline"
            >
              {order.po_number}
            </a>
          ) : (
            <span className="font-mono text-sm font-medium text-card-foreground">
              {order.po_number}
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <span className="text-sm font-medium text-card-foreground">
            {order.product_name || "—"}
          </span>
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <Input
            type="number"
            value={editedOrder.quantity}
            onChange={(e) => setEditedOrder({ ...editedOrder, quantity: parseInt(e.target.value) || 0 })}
            className="h-8 w-28"
          />
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <Input
            type="number"
            step="0.01"
            value={editedOrder.total_price || ""}
            onChange={(e) => setEditedOrder({ ...editedOrder, total_price: parseFloat(e.target.value) || null })}
            className="h-8 w-28"
            placeholder="$0.00"
          />
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <Select
            value={editedOrder.status}
            onValueChange={(value) => setEditedOrder({ ...editedOrder, status: value })}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <Input
            type="text"
            value={editedOrder.sales_order_number}
            onChange={(e) => setEditedOrder({ ...editedOrder, sales_order_number: e.target.value })}
            className="h-8 w-28"
            placeholder="SO #"
          />
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={editedOrder.is_hot_order}
              onCheckedChange={(checked) => setEditedOrder({ ...editedOrder, is_hot_order: checked })}
            />
            {editedOrder.is_hot_order && <Flame className="h-4 w-4 text-accent" />}
          </div>
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <Input
            type="date"
            value={editedOrder.requested_delivery_date}
            onChange={(e) => setEditedOrder({ ...editedOrder, requested_delivery_date: e.target.value })}
            className="h-8 w-36"
          />
        </td>
        <td className="whitespace-nowrap px-6 py-2">
          <Input
            type="date"
            value={editedOrder.estimated_delivery_date}
            onChange={(e) => setEditedOrder({ ...editedOrder, estimated_delivery_date: e.target.value })}
            className="h-8 w-36"
          />
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="transition-colors hover:bg-muted/20" onDoubleClick={() => isAdmin && setIsEditing(true)}>
      <td className="whitespace-nowrap px-6 py-4">
        {order.pdf_url ? (
          <a 
            href={order.pdf_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-mono text-sm font-medium text-primary hover:underline"
          >
            {order.po_number}
          </a>
        ) : (
          <span className="font-mono text-sm font-medium text-card-foreground">
            {order.po_number}
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-card-foreground">
          {order.product_name || "—"}
        </span>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
        {order.quantity.toLocaleString()} units
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-card-foreground">
        {formatCurrency(order.total_price)}
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <Badge variant="outline" className={cn("font-medium", statusStyles[order.status] || statusStyles.pending)}>
          {statusLabels[order.status] || "Submitted"}
        </Badge>
      </td>
      {isAdmin && (
        <td className="whitespace-nowrap px-6 py-4">
          <span className="font-mono text-sm text-muted-foreground">
            {order.sales_order_number || "—"}
          </span>
        </td>
      )}
      <td className="whitespace-nowrap px-6 py-4">
        {order.is_hot_order ? (
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-accent animate-pulse" />
            <span className="text-sm font-semibold text-accent">Hot</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Normal</span>
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
        {formatDate(order.requested_delivery_date)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
        {formatDate(order.estimated_delivery_date)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Admin: Show Accept button for pending/submitted orders */}
          {isAdmin && (order.status === "pending" || order.status === "submitted") && (
            <Button
              size="sm"
              variant="default"
              className="gap-1"
              onClick={() => onAcceptOrder(order)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <FileEdit className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2">
                <Eye className="h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {order.pdf_url && (
                <DropdownMenuItem className="gap-2" asChild>
                  <a href={order.pdf_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Download PO PDF
                  </a>
                </DropdownMenuItem>
              )}
              {isAdmin && (order.status === "pending" || order.status === "submitted") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="gap-2"
                    onClick={() => onAcceptOrder(order)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Accept Order
                  </DropdownMenuItem>
                </>
              )}
              {/* Show Request Change for accepted/in-production orders (non-admin users) */}
              {!isAdmin && (order.status === "accepted" || order.status === "in-production") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="gap-2"
                    onClick={() => onRequestChange(order)}
                  >
                    <FileEdit className="h-4 w-4" />
                    Request Change
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

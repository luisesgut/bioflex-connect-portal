import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Flame, MoreVertical, Download, Eye, CheckCircle2, FileEdit, Check, X, Loader2, Clock, Truck, PackageCheck, Calendar, Boxes, Upload, FileText } from "lucide-react";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LoadDetail {
  load_number: string;
  load_id: string;
  pallet_count: number;
  quantity: number;
}

interface ShippedLoadDetail {
  load_number: string;
  load_id: string;
  pallet_count: number;
  quantity: number;
  delivery_date: string | null;
  shipped_at: string;
}

interface ExcessStockDetail {
  pallet_count: number;
  total_quantity: number;
}

interface InventoryStats {
  inFloor: number;
  shipped: number;
  pending: number;
  percentProduced: number;
  loadDetails: LoadDetail[];
  shippedLoadDetails: ShippedLoadDetail[];
  excessStock: ExcessStockDetail | null;
}

interface Order {
  id: string;
  po_number: string;
  product_name: string | null;
  product_pt_code: string | null;
  product_customer: string | null;
  product_item_type: string | null;
  product_dp_sales_csr: string | null;
  product_customer_item: string | null;
  product_item_description: string | null;
  quantity: number;
  total_price: number | null;
  status: string;
  is_hot_order: boolean;
  do_not_delay: boolean;
  requested_delivery_date: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  pdf_url: string | null;
  sales_order_number: string | null;
  inventoryStats: InventoryStats;
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editedOrder, setEditedOrder] = useState({
    quantity: order.quantity,
    total_price: order.total_price,
    status: order.status,
    is_hot_order: order.is_hot_order,
    do_not_delay: order.do_not_delay,
    requested_delivery_date: order.requested_delivery_date || "",
    estimated_delivery_date: order.estimated_delivery_date || "",
    sales_order_number: order.sales_order_number || "",
  });

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploadedFile(file);
    toast.success('PDF selected. Save to upload.');
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      let pdfUrl = order.pdf_url;

      // Upload PDF if a new file was selected
      if (uploadedFile) {
        setUploadingPdf(true);
        const fileName = `po-documents/${order.id}/${order.po_number.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('ncr-attachments')
          .upload(fileName, uploadedFile);

        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast.error('Failed to upload PDF');
          setSaving(false);
          setUploadingPdf(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('ncr-attachments')
          .getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
        setUploadingPdf(false);
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update({
          quantity: editedOrder.quantity,
          total_price: editedOrder.total_price,
          status: editedOrder.status,
          is_hot_order: editedOrder.is_hot_order,
          do_not_delay: editedOrder.do_not_delay,
          requested_delivery_date: editedOrder.requested_delivery_date || null,
          estimated_delivery_date: editedOrder.estimated_delivery_date || null,
          sales_order_number: editedOrder.sales_order_number || null,
          pdf_url: pdfUrl,
        })
        .eq("id", order.id);

      setSaving(false);

      if (error) {
        console.error("Error updating order:", error);
        toast.error("Failed to update order");
      } else {
        toast.success("Order updated successfully");
        setIsEditing(false);
        setUploadedFile(null);
        onUpdated();
      }
    } catch (err) {
      console.error("Error saving order:", err);
      toast.error("Failed to save order");
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedOrder({
      quantity: order.quantity,
      total_price: order.total_price,
      status: order.status,
      is_hot_order: order.is_hot_order,
      do_not_delay: order.do_not_delay,
      requested_delivery_date: order.requested_delivery_date || "",
      estimated_delivery_date: order.estimated_delivery_date || "",
      sales_order_number: order.sales_order_number || "",
    });
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsEditing(false);
  };

  if (isAdmin && isEditing) {
    return (
      <tr className="transition-colors bg-accent/5">
        <td className="whitespace-nowrap px-6 py-4">
          <div className="flex flex-col gap-2">
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
            
            {/* PDF Upload - show if no PDF attached or allow replacing */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            
            {!order.pdf_url && !uploadedFile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1 h-7 text-xs"
              >
                <Upload className="h-3 w-3" />
                Attach PDF
              </Button>
            )}
            
            {uploadedFile && (
              <div className="flex items-center gap-1 rounded border bg-muted/50 px-2 py-1">
                <FileText className="h-3 w-3 text-accent" />
                <span className="text-xs text-card-foreground truncate max-w-[80px]">{uploadedFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1"
                  onClick={removeUploadedFile}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {order.pdf_url && !uploadedFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1 h-6 text-xs text-muted-foreground"
              >
                <Upload className="h-3 w-3" />
                Replace
              </Button>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm font-medium text-card-foreground">
            {[order.product_customer_item, order.product_item_description].filter(Boolean).join(' - ') || order.product_name || "—"}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {order.product_customer || "—"}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {order.product_item_type || "—"}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {order.product_dp_sales_csr || "—"}
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Switch
                checked={editedOrder.is_hot_order}
                onCheckedChange={(checked) => setEditedOrder({ ...editedOrder, is_hot_order: checked })}
              />
              {editedOrder.is_hot_order && <Flame className="h-4 w-4 text-accent" />}
            </div>
            <div className="flex items-center gap-1">
              <Switch
                checked={editedOrder.do_not_delay}
                onCheckedChange={(checked) => setEditedOrder({ ...editedOrder, do_not_delay: checked })}
              />
              {editedOrder.do_not_delay && <Clock className="h-4 w-4 text-yellow-600" />}
            </div>
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
        {/* Excess Stock column - admin only in edit mode */}
        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
          {order.inventoryStats.excessStock ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2 text-info">
                  {order.inventoryStats.excessStock.total_quantity.toLocaleString()}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-56" align="end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Inventory by PT Code</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-mono text-xs">{order.product_pt_code}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Pallets in inventory:</span>
                    <span className="font-medium">{order.inventoryStats.excessStock.pallet_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Total quantity:</span>
                    <span className="font-medium">{order.inventoryStats.excessStock.total_quantity.toLocaleString()}</span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
          {order.inventoryStats.inFloor > 0 && order.inventoryStats.loadDetails.length > 0 ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  {order.inventoryStats.inFloor.toLocaleString()}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" align="end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Loads with this material</span>
                  </div>
                  <div className="space-y-1.5">
                    {order.inventoryStats.loadDetails.map((load) => (
                      <Link
                        key={load.load_id}
                        to={`/shipping-loads/${load.load_id}`}
                        className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <span className="font-medium text-primary hover:underline">
                          {load.load_number}
                        </span>
                        <span className="text-muted-foreground">
                          {load.pallet_count} pallet{load.pallet_count !== 1 ? "s" : ""} · {load.quantity.toLocaleString()}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            order.inventoryStats.inFloor.toLocaleString()
          )}
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
          {order.inventoryStats.shipped > 0 && order.inventoryStats.shippedLoadDetails.length > 0 ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  {order.inventoryStats.shipped.toLocaleString()}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-72" align="end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Shipped loads</span>
                  </div>
                  <div className="space-y-1.5">
                    {order.inventoryStats.shippedLoadDetails.map((load) => (
                      <Link
                        key={load.load_id}
                        to={`/shipping-loads/${load.load_id}`}
                        className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <div>
                          <span className="font-medium text-primary hover:underline">
                            {load.load_number}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {load.delivery_date
                              ? new Date(load.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : new Date(load.shipped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " (shipped)"}
                          </div>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {load.pallet_count} pallet{load.pallet_count !== 1 ? "s" : ""} · {load.quantity.toLocaleString()}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            order.inventoryStats.shipped.toLocaleString()
          )}
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
          {order.inventoryStats.pending.toLocaleString()}
        </td>
        <td className="whitespace-nowrap px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all",
                  order.inventoryStats.percentProduced >= 100 ? "bg-success" :
                  order.inventoryStats.percentProduced >= 50 ? "bg-warning" : "bg-info"
                )}
                style={{ width: `${Math.min(100, order.inventoryStats.percentProduced)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-card-foreground min-w-[3rem] text-right">
              {order.inventoryStats.percentProduced}%
            </span>
          </div>
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
          {[order.product_customer_item, order.product_item_description].filter(Boolean).join(' - ') || order.product_name || "—"}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-muted-foreground">
          {order.product_customer || "—"}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-muted-foreground">
          {order.product_item_type || "—"}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-muted-foreground">
          {order.product_dp_sales_csr || "—"}
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
        <div className="flex items-center gap-2">
          {order.is_hot_order && (
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-accent animate-pulse" />
              <span className="text-sm font-semibold text-accent">Hot</span>
            </div>
          )}
          {order.do_not_delay && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-600">DND</span>
            </div>
          )}
          {!order.is_hot_order && !order.do_not_delay && (
            <span className="text-sm text-muted-foreground">Normal</span>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
        {formatDate(order.requested_delivery_date)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
        {formatDate(order.estimated_delivery_date)}
      </td>
      {/* Excess Stock column - admin only */}
      {isAdmin && (
        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
          {order.inventoryStats.excessStock ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2 text-info">
                  {order.inventoryStats.excessStock.total_quantity.toLocaleString()}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-56" align="end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Inventory by PT Code</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-mono text-xs">{order.product_pt_code}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Pallets in inventory:</span>
                    <span className="font-medium">{order.inventoryStats.excessStock.pallet_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Total quantity:</span>
                    <span className="font-medium">{order.inventoryStats.excessStock.total_quantity.toLocaleString()}</span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
        {order.inventoryStats.inFloor > 0 && order.inventoryStats.loadDetails.length > 0 ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {order.inventoryStats.inFloor.toLocaleString()}
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-64" align="end">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Loads with this material</span>
                </div>
                <div className="space-y-1.5">
                  {order.inventoryStats.loadDetails.map((load) => (
                    <Link
                      key={load.load_id}
                      to={`/shipping-loads/${load.load_id}`}
                      className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-primary hover:underline">
                        {load.load_number}
                      </span>
                      <span className="text-muted-foreground">
                        {load.pallet_count} pallet{load.pallet_count !== 1 ? "s" : ""} · {load.quantity.toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          order.inventoryStats.inFloor.toLocaleString()
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
        {order.inventoryStats.shipped > 0 && order.inventoryStats.shippedLoadDetails.length > 0 ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {order.inventoryStats.shipped.toLocaleString()}
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-72" align="end">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Shipped loads</span>
                </div>
                <div className="space-y-1.5">
                  {order.inventoryStats.shippedLoadDetails.map((load) => (
                    <Link
                      key={load.load_id}
                      to={`/shipping-loads/${load.load_id}`}
                      className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div>
                        <span className="font-medium text-primary hover:underline">
                          {load.load_number}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {load.delivery_date
                            ? new Date(load.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : new Date(load.shipped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " (shipped)"}
                        </div>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {load.pallet_count} pallet{load.pallet_count !== 1 ? "s" : ""} · {load.quantity.toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          order.inventoryStats.shipped.toLocaleString()
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
        {order.inventoryStats.pending.toLocaleString()}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all",
                order.inventoryStats.percentProduced >= 100 ? "bg-success" :
                order.inventoryStats.percentProduced >= 50 ? "bg-warning" : "bg-info"
              )}
              style={{ width: `${Math.min(100, order.inventoryStats.percentProduced)}%` }}
            />
          </div>
          <span className="text-sm font-medium text-card-foreground min-w-[3rem] text-right">
            {order.inventoryStats.percentProduced}%
          </span>
        </div>
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

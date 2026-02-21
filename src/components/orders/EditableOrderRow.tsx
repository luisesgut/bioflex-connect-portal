import { useState, useRef } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
import { Link, useNavigate } from "react-router-dom";
import { Flame, MoreVertical, Download, Eye, CheckCircle2, FileEdit, Check, X, Loader2, Clock, Truck, PackageCheck, Calendar, Boxes, Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import { POActivityTimeline } from "./POActivityTimeline";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  sapStockAvailable: number | null;
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
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
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
  columnOrder,
  columnWidths,
}: EditableOrderRowProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
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

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", order.id);

    setDeleting(false);
    setDeleteDialogOpen(false);

    if (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete order");
    } else {
      toast.success("Order deleted successfully");
      onUpdated();
    }
  };

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
        pdfUrl = `ncr-attachments:${fileName}`;
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

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="menuitem"]') ||
      target.closest('[data-radix-collection-item]')
    ) {
      return;
    }
    navigate(`/orders/${order.id}`);
  };

  // Shared cell renderers for both view and edit modes
  const renderExcessStock = () => (
    order.inventoryStats.excessStock ? (
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
    )
  );

  const renderInFloor = () => (
    order.inventoryStats.inFloor > 0 && order.inventoryStats.loadDetails.length > 0 ? (
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
    )
  );

  const renderShipped = () => (
    order.inventoryStats.shipped > 0 && order.inventoryStats.shippedLoadDetails.length > 0 ? (
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
    )
  );

  const renderPercentProduced = () => (
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
  );

  // Build cell map for EDIT mode
  const buildEditCells = (): Record<string, React.ReactNode> => ({
    po_number: (
      <div className="flex flex-col gap-2">
        {order.pdf_url ? (
          <button onClick={() => openStorageFile(order.pdf_url, 'ncr-attachments')} type="button"
            className="font-mono text-sm font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-left">
            {order.po_number}
          </button>
        ) : (
          <span className="font-mono text-sm font-medium text-card-foreground">{order.po_number}</span>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
        {!order.pdf_url && !uploadedFile && (
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 h-7 text-xs">
            <Upload className="h-3 w-3" /> Attach PDF
          </Button>
        )}
        {uploadedFile && (
          <div className="flex items-center gap-1 rounded border bg-muted/50 px-2 py-1">
            <FileText className="h-3 w-3 text-accent" />
            <span className="text-xs text-card-foreground truncate max-w-[80px]">{uploadedFile.name}</span>
            <Button type="button" variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={removeUploadedFile}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {order.pdf_url && !uploadedFile && (
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 h-6 text-xs text-muted-foreground">
            <Upload className="h-3 w-3" /> Replace
          </Button>
        )}
      </div>
    ),
    product: (
      <span className="text-sm font-medium text-card-foreground">
        {[order.product_customer_item, order.product_item_description].filter(Boolean).join(' - ') || order.product_name || "—"}
      </span>
    ),
    customer: <span className="text-sm text-muted-foreground">{order.product_customer || "—"}</span>,
    item_type: <span className="text-sm text-muted-foreground">{order.product_item_type || "—"}</span>,
    dp_sales_csr: <span className="text-sm text-muted-foreground">{order.product_dp_sales_csr || "—"}</span>,
    pt_code: <span className="text-sm font-mono text-muted-foreground">{order.product_pt_code || "—"}</span>,
    quantity: (
      <Input type="number" value={editedOrder.quantity}
        onChange={(e) => setEditedOrder({ ...editedOrder, quantity: parseInt(e.target.value) || 0 })}
        className="h-8 w-28" />
    ),
    value: (
      <Input type="number" step="0.01" value={editedOrder.total_price || ""}
        onChange={(e) => setEditedOrder({ ...editedOrder, total_price: parseFloat(e.target.value) || null })}
        className="h-8 w-28" placeholder="$0.00" />
    ),
    status: (
      <Select value={editedOrder.status} onValueChange={(value) => setEditedOrder({ ...editedOrder, status: value })}>
        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
    sales_order: (
      <Input type="text" value={editedOrder.sales_order_number}
        onChange={(e) => setEditedOrder({ ...editedOrder, sales_order_number: e.target.value })}
        className="h-8 w-28" placeholder="SO #" />
    ),
    priority: (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Switch checked={editedOrder.is_hot_order}
            onCheckedChange={(checked) => setEditedOrder({ ...editedOrder, is_hot_order: checked })} />
          {editedOrder.is_hot_order && <Flame className="h-4 w-4 text-accent" />}
        </div>
        <div className="flex items-center gap-1">
          <Switch checked={editedOrder.do_not_delay}
            onCheckedChange={(checked) => setEditedOrder({ ...editedOrder, do_not_delay: checked })} />
          {editedOrder.do_not_delay && <Clock className="h-4 w-4 text-yellow-600" />}
        </div>
      </div>
    ),
    customer_delivery: (
      <Input type="date" value={editedOrder.requested_delivery_date}
        onChange={(e) => setEditedOrder({ ...editedOrder, requested_delivery_date: e.target.value })}
        className="h-8 w-36" />
    ),
    bioflex_delivery: (
      <Input type="date" value={editedOrder.estimated_delivery_date}
        onChange={(e) => setEditedOrder({ ...editedOrder, estimated_delivery_date: e.target.value })}
        className="h-8 w-36" />
    ),
    excess_stock: renderExcessStock(),
    in_floor: renderInFloor(),
    shipped: renderShipped(),
    pending: order.inventoryStats.pending.toLocaleString(),
    percent_produced: renderPercentProduced(),
    actions: (
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
          <X className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="default" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
      </div>
    ),
  });

  // Build cell map for VIEW mode
  const buildViewCells = (): Record<string, React.ReactNode> => ({
    po_number: (
      <div className="flex items-center gap-2">
        <Link to={`/orders/${order.id}`} className="font-mono text-sm font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}>
          {order.po_number}
        </Link>
        {order.pdf_url && (
          <button onClick={(e) => { e.stopPropagation(); openStorageFile(order.pdf_url, 'ncr-attachments'); }}
            className="text-muted-foreground hover:text-primary cursor-pointer bg-transparent border-none p-0" title="View PDF">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    ),
    product: (
      <span className="text-sm font-medium text-card-foreground">
        {[order.product_customer_item, order.product_item_description].filter(Boolean).join(' - ') || order.product_name || "—"}
      </span>
    ),
    customer: <span className="text-sm text-muted-foreground">{order.product_customer || "—"}</span>,
    item_type: <span className="text-sm text-muted-foreground">{order.product_item_type || "—"}</span>,
    dp_sales_csr: <span className="text-sm text-muted-foreground">{order.product_dp_sales_csr || "—"}</span>,
    pt_code: <span className="text-sm font-mono text-muted-foreground">{order.product_pt_code || "—"}</span>,
    quantity: <span className="text-sm text-muted-foreground">{order.quantity.toLocaleString()} units</span>,
    value: <span className="text-sm font-medium text-card-foreground">{formatCurrency(order.total_price)}</span>,
    status: (
      <Badge variant="outline" className={cn("font-medium", statusStyles[order.status] || statusStyles.pending)}>
        {statusLabels[order.status] || "Submitted"}
      </Badge>
    ),
    sales_order: <span className="font-mono text-sm text-muted-foreground">{order.sales_order_number || "—"}</span>,
    priority: (
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
    ),
    customer_delivery: <span className="text-sm text-muted-foreground">{formatDate(order.requested_delivery_date)}</span>,
    bioflex_delivery: <span className="text-sm text-muted-foreground">{formatDate(order.estimated_delivery_date)}</span>,
    excess_stock: renderExcessStock(),
    in_floor: renderInFloor(),
    shipped: renderShipped(),
    pending: order.inventoryStats.pending.toLocaleString(),
    percent_produced: renderPercentProduced(),
    actions: (
      <div className="flex items-center justify-end gap-2">
        {isAdmin && (order.status === "pending" || order.status === "submitted") && (
          <Button size="sm" variant="default" className="gap-1" onClick={() => onAcceptOrder(order)}>
            <CheckCircle2 className="h-4 w-4" /> Accept
          </Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
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
            <DropdownMenuItem className="gap-2" onClick={() => setTimelineOpen(true)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            {order.pdf_url && (
              <DropdownMenuItem className="gap-2" onClick={() => openStorageFile(order.pdf_url, 'ncr-attachments')}>
                  <Download className="h-4 w-4" /> Download PO PDF
              </DropdownMenuItem>
            )}
            {isAdmin && (order.status === "pending" || order.status === "submitted") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => onAcceptOrder(order)}>
                  <CheckCircle2 className="h-4 w-4" /> Accept Order
                </DropdownMenuItem>
              </>
            )}
            {!isAdmin && (order.status === "accepted" || order.status === "in-production") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => onRequestChange(order)}>
                  <FileEdit className="h-4 w-4" /> Request Change
                </DropdownMenuItem>
              </>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete Order
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete PO <span className="font-semibold">{order.po_number}</span>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* PO Activity Timeline */}
        <POActivityTimeline
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          order={{
            id: order.id,
            po_number: order.po_number,
            sales_order_number: order.sales_order_number,
            created_at: order.created_at,
            status: order.status,
            is_hot_order: order.is_hot_order,
          }}
        />
      </div>
    ),
  });

  // Determine which cells to render based on column order
  const cellMap = isAdmin && isEditing ? buildEditCells() : buildViewCells();

  // Align config for right-aligned columns
  const rightAlignedColumns = new Set(["excess_stock", "in_floor", "shipped", "pending", "percent_produced", "actions"]);

  // If columnOrder is provided, render cells in that order
  if (columnOrder) {
    return (
      <tr 
        className={cn(
          "transition-colors cursor-pointer",
          isAdmin && isEditing ? "bg-accent/5" : "hover:bg-muted/20"
        )}
        onClick={isAdmin && isEditing ? undefined : handleRowClick}
        onDoubleClick={isAdmin && !isEditing ? () => setIsEditing(true) : undefined}
      >
        {columnOrder.map((colId) => (
          <td
            key={colId}
            className={cn(
              "px-6 py-4 text-sm overflow-hidden text-ellipsis",
              rightAlignedColumns.has(colId) && "text-right",
              isEditing && "py-2",
            )}
            style={columnWidths?.[colId] ? { width: `${columnWidths[colId]}px` } : undefined}
          >
            {cellMap[colId] ?? null}
          </td>
        ))}
      </tr>
    );
  }

  // Fallback: legacy rendering without column order (shouldn't happen but safe)
  if (isAdmin && isEditing) {
    const editCells = buildEditCells();
    const defaultOrder = ["po_number", "product", "customer", "item_type", "dp_sales_csr", "pt_code", "quantity", "value", "status", "sales_order", "priority", "customer_delivery", "bioflex_delivery", "excess_stock", "in_floor", "shipped", "pending", "percent_produced", "actions"];
    return (
      <tr className="transition-colors bg-accent/5">
        {defaultOrder.map((colId) => (
          <td key={colId} className="whitespace-nowrap px-6 py-4 text-sm">
            {editCells[colId] ?? null}
          </td>
        ))}
      </tr>
    );
  }

  const viewCells = buildViewCells();
  const defaultViewOrder = [
    "po_number", "product", "customer", "item_type", "dp_sales_csr",
    ...(isAdmin ? ["pt_code"] : []),
    "quantity",
    ...(isAdmin ? ["value"] : []),
    "status",
    ...(isAdmin ? ["sales_order"] : []),
    "priority", "customer_delivery", "bioflex_delivery",
    ...(isAdmin ? ["excess_stock"] : []),
    "in_floor", "shipped", "pending", "percent_produced", "actions"
  ];

  return (
    <tr className="transition-colors hover:bg-muted/20 cursor-pointer" onClick={handleRowClick}
      onDoubleClick={() => isAdmin && setIsEditing(true)}>
      {defaultViewOrder.map((colId) => (
        <td key={colId} className={cn("whitespace-nowrap px-6 py-4 text-sm", rightAlignedColumns.has(colId) && "text-right")}>
          {viewCells[colId] ?? null}
        </td>
      ))}
    </tr>
  );
}

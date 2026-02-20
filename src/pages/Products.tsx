import { useState, useEffect } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Package, Loader2, FileText, ChevronDown, X, ExternalLink, Pencil } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditProductDialog } from "@/components/products/EditProductDialog";
import { BulkProductsManager } from "@/components/products/BulkProductsManager";

interface Product {
  id: string;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  tipo_empaque: string | null;
  pt_code: string | null;
  pieces_per_pallet: number | null;
  print_card: string | null;
  print_card_url: string | null;
  customer_tech_spec_url: string | null;
  bfx_spec_url: string | null;
  dp_sales_csr_names: string | null;
  activa: boolean | null;
}

interface ProductRequest {
  id: string;
  product_name: string;
  customer: string | null;
  item_description: string | null;
  item_type: string | null;
  status: string;
  engineering_status: string | null;
  design_status: string | null;
  created_at: string;
  updated_at: string;
  pieces_per_pallet: number | null;
  customer_item_code: string | null;
}

type TabValue = "active" | "in_process";

interface Filters {
  customer_item: string[];
  item_description: string[];
  customer: string[];
  item_type: string[];
  tipo_empaque: string[];
  pieces_per_pallet: string[];
  dp_sales_csr_names: string[];
}

const emptyFilters: Filters = {
  customer_item: [],
  item_description: [],
  customer: [],
  item_type: [],
  tipo_empaque: [],
  pieces_per_pallet: [],
  dp_sales_csr_names: [],
};

const requestStatusLabels: Record<string, string> = {
  draft: "Draft",
  specs_submitted: "Specs Submitted",
  artwork_uploaded: "Artwork Uploaded",
  pc_in_review: "PC In Review",
  pc_approved: "PC Approved",
  bionet_pending: "Bionet Pending",
  bionet_registered: "Bionet Registered",
  sap_pending: "SAP Pending",
  sap_registered: "SAP Registered",
  completed: "Completed",
};

const customerVisibleStatuses = [
  "draft", "specs_submitted", "artwork_uploaded", "pc_in_review", "pc_approved", "completed",
];

function getCustomerVisibleStatus(status: string, isAdmin: boolean): string {
  if (isAdmin) return requestStatusLabels[status] || status;
  if (!customerVisibleStatuses.includes(status)) return "In Progress";
  return requestStatusLabels[status] || status;
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "draft": return "secondary" as const;
    case "specs_submitted":
    case "artwork_uploaded": return "outline" as const;
    case "completed": return "default" as const;
    default: return "default" as const;
  }
}

export default function Products() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [productRequests, setProductRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("active");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [productsRes, requestsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, customer_item, item_description, customer, item_type, tipo_empaque, pt_code, pieces_per_pallet, print_card, print_card_url, customer_tech_spec_url, bfx_spec_url, dp_sales_csr_names, activa")
        .order("customer_item"),
      supabase
        .from("product_requests")
        .select("id, product_name, customer, item_description, item_type, status, engineering_status, design_status, created_at, updated_at, pieces_per_pallet, customer_item_code")
        .neq("status", "completed")
        .order("created_at", { ascending: false }),
    ]);

    if (productsRes.error) {
      toast({ title: "Error", description: "Failed to fetch products", variant: "destructive" });
    } else {
      setProducts(productsRes.data || []);
    }

    if (requestsRes.error) {
      console.error("Error fetching product requests:", requestsRes.error);
    } else {
      setProductRequests(requestsRes.data || []);
    }
    setLoading(false);
  };

  // Filtered products based on tab
  const tabProducts = products.filter((p) =>
    activeTab === "active" ? p.activa !== false : p.activa === false
  );

  // Get unique values for filters from tabProducts
  const getUniqueValues = (key: keyof Product) => {
    const values = tabProducts
      .map((p) => {
        const val = p[key];
        return val !== null && val !== undefined ? String(val) : null;
      })
      .filter(Boolean) as string[];
    return [...new Set(values)].sort();
  };

  // Apply search + filters to products
  const filteredProducts = tabProducts.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.customer_item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.item_description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilters =
      (filters.customer_item.length === 0 || (product.customer_item && filters.customer_item.includes(product.customer_item))) &&
      (filters.item_description.length === 0 || (product.item_description && filters.item_description.includes(product.item_description))) &&
      (filters.customer.length === 0 || (product.customer && filters.customer.includes(product.customer))) &&
      (filters.item_type.length === 0 || (product.item_type && filters.item_type.includes(product.item_type))) &&
      (filters.tipo_empaque.length === 0 || (product.tipo_empaque && filters.tipo_empaque.includes(product.tipo_empaque))) &&
      (filters.pieces_per_pallet.length === 0 || (product.pieces_per_pallet !== null && filters.pieces_per_pallet.includes(String(product.pieces_per_pallet)))) &&
      (filters.dp_sales_csr_names.length === 0 || (product.dp_sales_csr_names && filters.dp_sales_csr_names.includes(product.dp_sales_csr_names)));

    return matchesSearch && matchesFilters;
  });

  // Apply search to product requests
  const filteredRequests = productRequests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.product_name?.toLowerCase().includes(q) ||
      r.customer?.toLowerCase().includes(q) ||
      r.customer_item_code?.toLowerCase().includes(q)
    );
  });

  const hasActiveFilters = Object.values(filters).some((f) => f.length > 0);

  const clearAllFilters = () => setFilters(emptyFilters);

  const toggleFilter = (filterKey: keyof Filters, value: string) => {
    setFilters((prev) => {
      const current = prev[filterKey];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [filterKey]: updated };
    });
  };

  const clearColumnFilter = (filterKey: keyof Filters) => {
    setFilters((prev) => ({ ...prev, [filterKey]: [] }));
  };

  const ColumnFilterHeader = ({
    label,
    filterKey,
    options,
    className = "",
  }: {
    label: string;
    filterKey: keyof Filters;
    options: string[];
    className?: string;
  }) => {
    const activeFilters = filters[filterKey];
    const isFiltered = activeFilters.length > 0;
    const [searchTerm, setSearchTerm] = useState("");

    const filteredOptions = options.filter((opt) => opt.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <th className={`px-4 py-3 text-left text-sm font-semibold text-foreground ${className}`}>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 hover:text-primary transition-colors ${isFiltered ? "text-primary font-bold" : ""}`}>
              {label}
              {isFiltered && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFilters.length}
                </Badge>
              )}
              <ChevronDown className={`h-3 w-3 ${isFiltered ? "text-primary" : "text-muted-foreground"}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <div className="p-2 border-b">
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-8" />
            </div>
            <div className="p-2 border-b flex justify-between">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFilters((prev) => ({ ...prev, [filterKey]: filteredOptions }))}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => clearColumnFilter(filterKey)}>
                Clear
              </Button>
            </div>
            <ScrollArea className="h-48">
              <div className="p-2 space-y-1">
                {filteredOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No options</p>
                ) : (
                  filteredOptions.map((option) => (
                    <label key={option} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <Checkbox checked={activeFilters.includes(option)} onCheckedChange={() => toggleFilter(filterKey, option)} />
                      <span className="truncate">{option}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </th>
    );
  };

  const renderProductsTable = () => (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <ColumnFilterHeader label="Item Code" filterKey="customer_item" options={getUniqueValues("customer_item")} />
              <ColumnFilterHeader label="Item Description" filterKey="item_description" options={getUniqueValues("item_description")} />
              <ColumnFilterHeader label="Final Customer" filterKey="customer" options={getUniqueValues("customer")} />
              <ColumnFilterHeader label="Item Type" filterKey="item_type" options={getUniqueValues("item_type")} />
              {isAdmin && <ColumnFilterHeader label="Tipo Empaque" filterKey="tipo_empaque" options={getUniqueValues("tipo_empaque")} />}
              {isAdmin && <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">PT Number</th>}
              <ColumnFilterHeader label="Pieces/Pallet" filterKey="pieces_per_pallet" options={getUniqueValues("pieces_per_pallet")} className="text-right" />
              {isAdmin && <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">PC</th>}
              <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Customer Spec</th>
              {isAdmin && <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">BFX Spec</th>}
              <ColumnFilterHeader label="DP Sales/CSR" filterKey="dp_sales_csr_names" options={getUniqueValues("dp_sales_csr_names")} />
              {isAdmin && <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Edit</th>}
              <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredProducts.map((product, index) => (
              <tr
                key={product.id}
                className="transition-colors hover:bg-muted/30 animate-slide-up"
                style={{ animationDelay: `${0.02 * Math.min(index, 10)}s` }}
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{product.customer_item || "-"}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{product.item_description || "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{product.customer || "-"}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{product.item_type || "-"}</td>
                {isAdmin && <td className="px-4 py-3 text-muted-foreground">{product.tipo_empaque || "-"}</td>}
                {isAdmin && <td className="px-4 py-3 font-mono text-muted-foreground">{product.pt_code || "-"}</td>}
                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{product.pieces_per_pallet?.toLocaleString() || "-"}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center">
                    {product.print_card_url ? (
                      <button onClick={() => openStorageFile(product.print_card_url, 'print-cards')} className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer bg-transparent border-none p-0">
                        <FileText className="h-4 w-4" />
                        {product.print_card || "View"}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  {product.customer_tech_spec_url ? (
                    <button onClick={() => openStorageFile(product.customer_tech_spec_url, 'print-cards')} className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer bg-transparent border-none p-0">
                      <ExternalLink className="h-4 w-4" />
                      View
                    </button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center">
                    {product.bfx_spec_url ? (
                      <button onClick={() => openStorageFile(product.bfx_spec_url, 'print-cards')} className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer bg-transparent border-none p-0">
                        <FileText className="h-4 w-4" />
                        View
                      </button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground">
                  {product.dp_sales_csr_names
                    ? product.dp_sales_csr_names.split(", ").map((name) => name.split(" ")[0]).join(", ")
                    : "-"}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setEditDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Button variant="accent" size="sm" className="gap-1" onClick={() => navigate(`/orders/new?productId=${product.id}`)}>
                    Order
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRequestsTable = () => (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item Code</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Customer</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              {isAdmin && <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Eng. Status</th>}
              {isAdmin && <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Design Status</th>}
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Created</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRequests.map((request, index) => (
              <tr
                key={request.id}
                className="transition-colors hover:bg-muted/30 animate-slide-up cursor-pointer"
                style={{ animationDelay: `${0.02 * Math.min(index, 10)}s` }}
                onClick={() => navigate(`/products/request/${request.id}`)}
              >
                <td className="px-4 py-3 font-medium text-foreground">{request.product_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{request.customer_item_code || "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{request.customer || "-"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getStatusBadgeVariant(request.status)}>
                    {getCustomerVisibleStatus(request.status, isAdmin)}
                  </Badge>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        request.engineering_status === "approved"
                          ? "default"
                          : request.engineering_status === "pending"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {request.engineering_status || "Pending"}
                    </Badge>
                  </td>
                )}
                {isAdmin && (
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        request.design_status === "approved"
                          ? "default"
                          : request.design_status === "pending"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {request.design_status || "Pending"}
                    </Badge>
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground">{format(new Date(request.created_at), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/products/request/${request.id}`); }}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const currentCount = activeTab === "in_process" ? filteredRequests.length : filteredProducts.length;
  const totalCount = activeTab === "in_process" ? productRequests.length : tabProducts.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Products</h1>
            <p className="mt-1 text-muted-foreground">Manage your product catalog and new product requests</p>
          </div>
          <Button variant="accent" className="gap-2" onClick={() => navigate("/products/new")}>
            <Plus className="h-5 w-5" />
            Request New Product
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabValue); setFilters(emptyFilters); setSearchQuery(""); }}>
          <TabsList>
            <TabsTrigger value="active">
              Active
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {products.filter((p) => p.activa !== false).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {products.filter((p) => p.activa === false).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="in_process">
              In Process
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {productRequests.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Filter Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={activeTab === "in_process" ? "Search by name, customer, or item code..." : "Search by item or description..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear all filters
            </Button>
          )}
          {isAdmin && activeTab !== "in_process" && (
            <BulkProductsManager products={filteredProducts} onImported={fetchData} />
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : currentCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {activeTab === "in_process" ? "No product requests in process" : "No products found"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "in_process"
                ? "Start by requesting a new product"
                : "Try adjusting your search or filter criteria"}
            </p>
            {activeTab === "in_process" && (
              <Button variant="accent" className="mt-4 gap-2" onClick={() => navigate("/products/new")}>
                <Plus className="h-5 w-5" />
                Request New Product
              </Button>
            )}
          </div>
        ) : activeTab === "in_process" ? (
          renderRequestsTable()
        ) : (
          renderProductsTable()
        )}

        <p className="text-sm text-muted-foreground text-center">
          Showing {currentCount} of {totalCount} {activeTab === "in_process" ? "requests" : "products"}
        </p>
      </div>

      {isAdmin && (
        <EditProductDialog
          product={editingProduct}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={fetchData}
        />
      )}
    </MainLayout>
  );
}

import { useState, useEffect } from "react";
import { Search, Plus, Package, ArrowUpRight, Loader2, FileText, ChevronDown, X } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Product {
  id: string;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  pieces_per_pallet: number | null;
  print_card_url: string | null;
}

interface Filters {
  customer: string;
  item_type: string;
  has_pc_file: string;
}

export default function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({
    customer: "all",
    item_type: "all",
    has_pc_file: "all",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, customer_item, item_description, customer, item_type, pieces_per_pallet, print_card_url')
      .eq('activa', true)
      .order('customer_item');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  // Get unique values for filters
  const customers = [...new Set(products.map(p => p.customer).filter(Boolean) as string[])].sort();
  const itemTypes = [...new Set(products.map(p => p.item_type).filter(Boolean) as string[])].sort();

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.customer_item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.item_description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCustomer = filters.customer === "all" || product.customer === filters.customer;
    const matchesItemType = filters.item_type === "all" || product.item_type === filters.item_type;
    const matchesPcFile = filters.has_pc_file === "all" || 
      (filters.has_pc_file === "yes" && product.print_card_url) ||
      (filters.has_pc_file === "no" && !product.print_card_url);
    return matchesSearch && matchesCustomer && matchesItemType && matchesPcFile;
  });

  const hasActiveFilters = filters.customer !== "all" || filters.item_type !== "all" || filters.has_pc_file !== "all";

  const clearAllFilters = () => {
    setFilters({ customer: "all", item_type: "all", has_pc_file: "all" });
  };

  const ColumnHeader = ({ 
    label, 
    filterKey, 
    options, 
    className = "" 
  }: { 
    label: string; 
    filterKey: keyof Filters; 
    options: string[]; 
    className?: string;
  }) => {
    const isFiltered = filters[filterKey] !== "all";
    return (
      <th className={`px-4 py-3 text-left text-sm font-semibold text-foreground ${className}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`inline-flex items-center gap-1 hover:text-primary transition-colors ${isFiltered ? 'text-primary' : ''}`}>
              {label}
              <ChevronDown className={`h-3 w-3 ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`} />
              {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover border shadow-md z-50">
            <DropdownMenuItem 
              onClick={() => setFilters(f => ({ ...f, [filterKey]: "all" }))}
              className={filters[filterKey] === "all" ? "bg-muted" : ""}
            >
              All
            </DropdownMenuItem>
            {options.map(option => (
              <DropdownMenuItem 
                key={option} 
                onClick={() => setFilters(f => ({ ...f, [filterKey]: option }))}
                className={filters[filterKey] === option ? "bg-muted" : ""}
              >
                {option}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </th>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Products
            </h1>
            <p className="mt-1 text-muted-foreground">
              Browse your product catalog
            </p>
          </div>
          <Button variant="accent" className="gap-2">
            <Plus className="h-5 w-5" />
            Request New Product
          </Button>
        </div>

        {/* Search and Filter Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by item or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No products found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Customer Item</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item Description</th>
                  <ColumnHeader label="Customer" filterKey="customer" options={customers} />
                  <ColumnHeader label="Item Type" filterKey="item_type" options={itemTypes} />
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Pieces/Pallet</th>
                  <ColumnHeader 
                    label="PC File" 
                    filterKey="has_pc_file" 
                    options={["yes", "no"]} 
                    className="text-center"
                  />
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
                      <span className="font-medium text-foreground">{product.customer_item || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {product.item_description || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{product.customer || '-'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.item_type || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {product.pieces_per_pallet?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.print_card_url ? (
                        <a 
                          href={product.print_card_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="accent" size="sm" className="gap-1">
                        Order
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      </div>
    </MainLayout>
  );
}

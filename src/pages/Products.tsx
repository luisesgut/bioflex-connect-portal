import { useState, useEffect } from "react";
import { Search, Plus, Package, ArrowUpRight, Loader2, FileText, ChevronDown, X, Check } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Product {
  id: string;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  pieces_per_pallet: number | null;
  print_card_url: string | null;
  dp_sales_csr_names: string | null;
}

interface Filters {
  customer_item: string[];
  item_description: string[];
  customer: string[];
  item_type: string[];
  pieces_per_pallet: string[];
  has_pc_file: string[];
  dp_sales_csr_names: string[];
}

export default function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({
    customer_item: [],
    item_description: [],
    customer: [],
    item_type: [],
    pieces_per_pallet: [],
    has_pc_file: [],
    dp_sales_csr_names: [],
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, customer_item, item_description, customer, item_type, pieces_per_pallet, print_card_url, dp_sales_csr_names')
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

  // Get unique values for each column
  const getUniqueValues = (key: keyof Product) => {
    const values = products.map(p => {
      const val = p[key];
      return val !== null && val !== undefined ? String(val) : null;
    }).filter(Boolean) as string[];
    return [...new Set(values)].sort();
  };

  const uniqueCustomerItems = getUniqueValues('customer_item');
  const uniqueDescriptions = getUniqueValues('item_description');
  const uniqueCustomers = getUniqueValues('customer');
  const uniqueItemTypes = getUniqueValues('item_type');
  const uniquePieces = getUniqueValues('pieces_per_pallet');
  const uniqueDpSalesCsr = getUniqueValues('dp_sales_csr_names');
  const pcFileOptions = ["Has File", "No File"];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.customer_item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.item_description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCustomerItem = filters.customer_item.length === 0 || 
      (product.customer_item && filters.customer_item.includes(product.customer_item));
    const matchesDescription = filters.item_description.length === 0 || 
      (product.item_description && filters.item_description.includes(product.item_description));
    const matchesCustomer = filters.customer.length === 0 || 
      (product.customer && filters.customer.includes(product.customer));
    const matchesItemType = filters.item_type.length === 0 || 
      (product.item_type && filters.item_type.includes(product.item_type));
    const matchesPieces = filters.pieces_per_pallet.length === 0 || 
      (product.pieces_per_pallet !== null && filters.pieces_per_pallet.includes(String(product.pieces_per_pallet)));
    const matchesPcFile = filters.has_pc_file.length === 0 || 
      (filters.has_pc_file.includes("Has File") && product.print_card_url) ||
      (filters.has_pc_file.includes("No File") && !product.print_card_url);
    const matchesDpSalesCsr = filters.dp_sales_csr_names.length === 0 || 
      (product.dp_sales_csr_names && filters.dp_sales_csr_names.includes(product.dp_sales_csr_names));

    return matchesSearch && matchesCustomerItem && matchesDescription && matchesCustomer && matchesItemType && matchesPieces && matchesPcFile && matchesDpSalesCsr;
  });

  const hasActiveFilters = Object.values(filters).some(f => f.length > 0);

  const clearAllFilters = () => {
    setFilters({
      customer_item: [],
      item_description: [],
      customer: [],
      item_type: [],
      pieces_per_pallet: [],
      has_pc_file: [],
      dp_sales_csr_names: [],
    });
  };

  const toggleFilter = (filterKey: keyof Filters, value: string) => {
    setFilters(prev => {
      const current = prev[filterKey];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [filterKey]: updated };
    });
  };

  const clearColumnFilter = (filterKey: keyof Filters) => {
    setFilters(prev => ({ ...prev, [filterKey]: [] }));
  };

  const ColumnFilterHeader = ({ 
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
    const activeFilters = filters[filterKey];
    const isFiltered = activeFilters.length > 0;
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <th className={`px-4 py-3 text-left text-sm font-semibold text-foreground ${className}`}>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 hover:text-primary transition-colors ${isFiltered ? 'text-primary font-bold' : ''}`}>
              {label}
              {isFiltered && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilters.length}</Badge>}
              <ChevronDown className={`h-3 w-3 ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <div className="p-2 border-b">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="p-2 border-b flex justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => setFilters(prev => ({ ...prev, [filterKey]: filteredOptions }))}
              >
                Select All
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => clearColumnFilter(filterKey)}
              >
                Clear
              </Button>
            </div>
            <ScrollArea className="h-48">
              <div className="p-2 space-y-1">
                {filteredOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No options</p>
                ) : (
                  filteredOptions.map(option => (
                    <label 
                      key={option} 
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox 
                        checked={activeFilters.includes(option)}
                        onCheckedChange={() => toggleFilter(filterKey, option)}
                      />
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
              Clear all filters
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ColumnFilterHeader label="Customer Item" filterKey="customer_item" options={uniqueCustomerItems} />
                    <ColumnFilterHeader label="Item Description" filterKey="item_description" options={uniqueDescriptions} />
                    <ColumnFilterHeader label="Customer" filterKey="customer" options={uniqueCustomers} />
                    <ColumnFilterHeader label="Item Type" filterKey="item_type" options={uniqueItemTypes} />
                    <ColumnFilterHeader label="Pieces/Pallet" filterKey="pieces_per_pallet" options={uniquePieces} className="text-right" />
                    <ColumnFilterHeader label="PC File" filterKey="has_pc_file" options={pcFileOptions} className="text-center" />
                    <ColumnFilterHeader label="DP Sales/CSR" filterKey="dp_sales_csr_names" options={uniqueDpSalesCsr} />
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.dp_sales_csr_names || '-'}
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
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      </div>
    </MainLayout>
  );
}

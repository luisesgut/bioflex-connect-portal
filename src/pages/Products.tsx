import { useState, useEffect } from "react";
import { Search, Plus, Package, ArrowUpRight, Loader2, FileText } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  pieces_per_pallet: number | null;
  print_card_url: string | null;
}

export default function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("All");

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

  // Get unique customers for filter
  const customers = ["All", ...new Set(products.map(p => p.customer).filter(Boolean) as string[])];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.customer_item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.item_description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCustomer = selectedCustomer === "All" || product.customer === selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  return (
    <MainLayout>
      <div className="space-y-8">
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

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by item or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {customers.slice(0, 6).map((customer) => (
              <Button
                key={customer}
                variant={selectedCustomer === customer ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCustomer(customer)}
                className="transition-all duration-200"
              >
                {customer}
              </Button>
            ))}
          </div>
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer Item</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Item Description</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Item Type</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Pieces/Pallet</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">PC File</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((product, index) => (
                  <tr 
                    key={product.id} 
                    className="transition-colors hover:bg-muted/30 animate-slide-up"
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-foreground">{product.customer_item || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                      {product.item_description || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary">{product.customer || '-'}</Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {product.item_type || '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      {product.pieces_per_pallet?.toLocaleString() || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
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
                    <td className="px-6 py-4 text-right">
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

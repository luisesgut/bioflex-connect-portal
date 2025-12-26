import { useState } from "react";
import { Search, Filter, Plus, Package, ArrowUpRight } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  material: string;
  size: string;
  lastOrdered: string;
  totalOrdered: string;
  image: string;
}

const products: Product[] = [
  {
    id: "1",
    name: "Custom Stand-Up Pouch",
    sku: "SUP-12OZ-001",
    category: "Stand-Up Pouches",
    material: "PET/PE Laminate",
    size: "12oz",
    lastOrdered: "Dec 15, 2025",
    totalOrdered: "250,000 units",
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=300&h=300&fit=crop",
  },
  {
    id: "2",
    name: "Resealable Flat Pouch",
    sku: "RFP-8OZ-002",
    category: "Flat Pouches",
    material: "BOPP/CPP",
    size: "8oz",
    lastOrdered: "Dec 10, 2025",
    totalOrdered: "180,000 units",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop",
  },
  {
    id: "3",
    name: "Gusseted Bag",
    sku: "GB-2LB-003",
    category: "Gusseted Bags",
    material: "Kraft/PE",
    size: "2lb",
    lastOrdered: "Dec 8, 2025",
    totalOrdered: "420,000 units",
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=300&h=300&fit=crop",
  },
  {
    id: "4",
    name: "Vacuum Seal Pouch",
    sku: "VSP-16OZ-004",
    category: "Vacuum Pouches",
    material: "Nylon/PE",
    size: "16oz",
    lastOrdered: "Dec 5, 2025",
    totalOrdered: "95,000 units",
    image: "https://images.unsplash.com/photo-1587556930799-8dca6fad6d41?w=300&h=300&fit=crop",
  },
  {
    id: "5",
    name: "Spouted Pouch",
    sku: "SP-32OZ-005",
    category: "Spouted Pouches",
    material: "PET/AL/PE",
    size: "32oz",
    lastOrdered: "Nov 28, 2025",
    totalOrdered: "65,000 units",
    image: "https://images.unsplash.com/photo-1553531889-e6cf4d692b1b?w=300&h=300&fit=crop",
  },
  {
    id: "6",
    name: "Retort Pouch",
    sku: "RP-10OZ-006",
    category: "Retort Pouches",
    material: "PET/AL/PP",
    size: "10oz",
    lastOrdered: "Nov 20, 2025",
    totalOrdered: "120,000 units",
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop",
  },
];

const categories = ["All", "Stand-Up Pouches", "Flat Pouches", "Gusseted Bags", "Vacuum Pouches", "Spouted Pouches", "Retort Pouches"];

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Your Products
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage your custom packaging products catalog
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
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="transition-all duration-200"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product, index) => (
            <div
              key={product.id}
              className="group relative overflow-hidden rounded-xl border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 animate-slide-up"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-card-foreground group-hover:text-accent transition-colors">
                      {product.name}
                    </h3>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {product.sku}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {product.size}
                  </Badge>
                </div>
                
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Material</span>
                    <span className="font-medium text-card-foreground">{product.material}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Ordered</span>
                    <span className="font-medium text-card-foreground">{product.totalOrdered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Ordered</span>
                    <span className="text-card-foreground">{product.lastOrdered}</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Details
                  </Button>
                  <Button variant="accent" size="sm" className="flex-1 gap-1">
                    Order Now
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No products found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

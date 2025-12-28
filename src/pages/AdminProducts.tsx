import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Download, Save, Search, ShieldAlert, Loader2, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  material: string | null;
  size: string | null;
  image: string | null;
  pt_code: string | null;
  pc_number: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminProducts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editedProducts, setEditedProducts] = useState<Record<string, Partial<Product>>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchProducts();
    }
  }, [isAdmin]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

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

  const handleFieldChange = (productId: string, field: keyof Product, value: string) => {
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleSaveChanges = async () => {
    if (Object.keys(editedProducts).length === 0) {
      toast({
        title: "No changes",
        description: "No products have been modified",
      });
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const [productId, changes] of Object.entries(editedProducts)) {
      const { error } = await supabase
        .from('products')
        .update(changes)
        .eq('id', productId);

      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (errorCount > 0) {
      toast({
        title: "Partial save",
        description: `${successCount} products updated, ${errorCount} failed`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${successCount} products updated successfully`,
      });
      setEditedProducts({});
    }

    await fetchProducts();
    setSaving(false);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have a header row and at least one data row",
          variant: "destructive",
        });
        return;
      }

      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const skuIndex = header.findIndex(h => h === 'sku');
      const ptIndex = header.findIndex(h => h === 'pt_code' || h === 'pt code' || h === 'pt');
      const pcIndex = header.findIndex(h => h === 'pc_number' || h === 'pc number' || h === 'pc');
      const nameIndex = header.findIndex(h => h === 'name');
      const categoryIndex = header.findIndex(h => h === 'category');
      const materialIndex = header.findIndex(h => h === 'material');
      const sizeIndex = header.findIndex(h => h === 'size');

      if (skuIndex === -1) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have a 'sku' column",
          variant: "destructive",
        });
        return;
      }

      let upsertCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const sku = values[skuIndex];

        if (!sku) continue;

        const productData: Record<string, string | null> = {
          sku,
          pt_code: ptIndex !== -1 ? values[ptIndex] || null : null,
          pc_number: pcIndex !== -1 ? values[pcIndex] || null : null,
        };

        if (nameIndex !== -1 && values[nameIndex]) {
          productData.name = values[nameIndex];
        }
        if (categoryIndex !== -1 && values[categoryIndex]) {
          productData.category = values[categoryIndex];
        }
        if (materialIndex !== -1 && values[materialIndex]) {
          productData.material = values[materialIndex];
        }
        if (sizeIndex !== -1 && values[sizeIndex]) {
          productData.size = values[sizeIndex];
        }

        // Check if product exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('sku', sku)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', existing.id);

          if (error) {
            errorCount++;
          } else {
            upsertCount++;
          }
        } else {
          // Insert new (requires name)
          if (!productData.name) {
            productData.name = sku; // Use SKU as name if not provided
          }
          const { error } = await supabase
            .from('products')
            .insert(productData as { sku: string; name: string; [key: string]: string | null });

          if (error) {
            errorCount++;
          } else {
            upsertCount++;
          }
        }
      }

      toast({
        title: "CSV Import Complete",
        description: `${upsertCount} products processed, ${errorCount} errors`,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      await fetchProducts();
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadCSVTemplate = () => {
    const headers = ['sku', 'name', 'category', 'material', 'size', 'pt_code', 'pc_number'];
    const exampleRow = ['SKU-001', 'Product Name', 'Category', 'Material', '10x20', 'PT-001', 'PC-001'];
    
    // Include existing products
    const csvContent = [
      headers.join(','),
      exampleRow.join(','),
      ...products.map(p => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.material || '',
        p.size || '',
        p.pt_code || '',
        p.pc_number || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteProduct = async (productId: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Product deleted",
      });
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.pt_code?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (product.pc_number?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getDisplayValue = (product: Product, field: keyof Product) => {
    return editedProducts[product.id]?.[field] ?? product[field] ?? '';
  };

  const hasChanges = Object.keys(editedProducts).length > 0;

  if (adminLoading) {
    return (
      <MainLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-accent" />
              <h1 className="text-2xl font-bold tracking-tight">Admin: Product Codes</h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              Manage internal PT codes and PC numbers (not visible to customers)
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCSVUpload}
              className="hidden"
            />
            <Button variant="outline" onClick={downloadCSVTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button 
              onClick={handleSaveChanges} 
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
              {hasChanges && (
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(editedProducts).length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* CSV Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">CSV Import Instructions</CardTitle>
            <CardDescription>
              Your CSV file should have the following columns: <code className="rounded bg-muted px-1">sku</code> (required), 
              <code className="rounded bg-muted px-1 ml-1">name</code>, 
              <code className="rounded bg-muted px-1 ml-1">category</code>, 
              <code className="rounded bg-muted px-1 ml-1">material</code>, 
              <code className="rounded bg-muted px-1 ml-1">size</code>, 
              <code className="rounded bg-muted px-1 ml-1">pt_code</code>, 
              <code className="rounded bg-muted px-1 ml-1">pc_number</code>. 
              Products are matched by SKU - existing products will be updated, new ones will be created.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, PT code, or PC number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                <p>No products found</p>
                <p className="text-sm">Import products via CSV to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="bg-accent/10">PT Code (Internal)</TableHead>
                    <TableHead className="bg-accent/10">PC Number (Internal)</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className={editedProducts[product.id] ? 'bg-accent/5' : ''}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.sku}</Badge>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="bg-accent/5">
                        <Input
                          value={getDisplayValue(product, 'pt_code') as string}
                          onChange={(e) => handleFieldChange(product.id, 'pt_code', e.target.value)}
                          placeholder="Enter PT code"
                          className="h-8 border-accent/20"
                        />
                      </TableCell>
                      <TableCell className="bg-accent/5">
                        <Input
                          value={getDisplayValue(product, 'pc_number') as string}
                          onChange={(e) => handleFieldChange(product.id, 'pc_number', e.target.value)}
                          placeholder="Enter PC number"
                          className="h-8 border-accent/20"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

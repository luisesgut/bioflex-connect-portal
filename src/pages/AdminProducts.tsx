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
import { Upload, Download, Search, ShieldAlert, Loader2, Trash2, FileUp, FileText, ChevronDown, X } from "lucide-react";
import { Navigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminFilters {
  codigo_producto: string[];
  pt_code: string[];
  nombre_producto_2: string[];
  print_card: string[];
  has_pc_file: string[];
  activa: string[];
  customer_item: string[];
  item_description: string[];
  customer: string[];
  item_type: string[];
  pieces_per_pallet: string[];
  units: string[];
  dp_sales_csr_names: string[];
}

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
  et: string | null;
  activa: boolean | null;
  descripcion_cliente: string | null;
  et_verificada: boolean | null;
  codigo_producto: string | null;
  print_card: string | null;
  nombre_producto_2: string | null;
  tipo_empaque: string | null;
  estructura: string | null;
  ancho: number | null;
  alto: number | null;
  fuelle_de_fondo: number | null;
  pestana_al_ancho: number | null;
  pestana_al_alto: number | null;
  refilado: string | null;
  metros_x_bobina: number | null;
  unidades_en_ancho: number | null;
  unidades_en_largo: number | null;
  pisos: number | null;
  unidades_por_tarima: number | null;
  tipo_embalaje: string | null;
  descripcion_caja: string | null;
  empacado_de_producto_por: string | null;
  piezas_por_paquete: number | null;
  paquete_por_caja: number | null;
  piezas_totales_por_caja: number | null;
  customer_item: string | null;
  item_description: string | null;
  customer: string | null;
  item_type: string | null;
  pieces_per_pallet: number | null;
  print_card_url: string | null;
  units: string | null;
  dp_sales_csr_names: string | null;
  created_at: string;
  updated_at: string;
}

// CSV column mapping
const CSV_COLUMN_MAP: Record<string, keyof Product> = {
  'et': 'et',
  'activa': 'activa',
  'descripcioncliente': 'descripcion_cliente',
  'etverificada': 'et_verificada',
  'codigoproducto': 'codigo_producto',
  'printcard': 'print_card',
  'nombreproducto2': 'nombre_producto_2',
  'tipoempaque': 'tipo_empaque',
  'estructura': 'estructura',
  'ancho': 'ancho',
  'alto': 'alto',
  'fuelledefondo': 'fuelle_de_fondo',
  'pestanaalancho': 'pestana_al_ancho',
  'pestanaalalto': 'pestana_al_alto',
  'refilado': 'refilado',
  'metrosxbobina': 'metros_x_bobina',
  'unidadesenancho': 'unidades_en_ancho',
  'unidadesenlargo': 'unidades_en_largo',
  'pisos': 'pisos',
  'unidadesportarima': 'unidades_por_tarima',
  'tipoembalaje': 'tipo_embalaje',
  'descripcioncaja': 'descripcion_caja',
  'empacadodeproductopor': 'empacado_de_producto_por',
  'piezasporpaquete': 'piezas_por_paquete',
  'paqueteporcaja': 'paquete_por_caja',
  'piezastotalesporcaja': 'piezas_totales_por_caja',
      'customer item': 'customer_item',
      'item description': 'item_description',
      'customer': 'customer',
      'item type': 'item_type',
      'pieces per pallet': 'pieces_per_pallet',
      'units': 'units',
      'dp sales/csr names': 'dp_sales_csr_names',
      'dpsales/csrnames': 'dp_sales_csr_names',
      // Old columns for backward compatibility
  'sku': 'sku',
  'name': 'name',
  'category': 'category',
  'material': 'material',
  'size': 'size',
  'pt_code': 'pt_code',
  'pc_number': 'pc_number',
};

export default function AdminProducts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<AdminFilters>({
    codigo_producto: [],
    pt_code: [],
    nombre_producto_2: [],
    print_card: [],
    has_pc_file: [],
    activa: [],
    customer_item: [],
    item_description: [],
    customer: [],
    item_type: [],
    pieces_per_pallet: [],
    units: [],
    dp_sales_csr_names: [],
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pcFileInputRef = useRef<HTMLInputElement>(null);

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
      .order('codigo_producto');

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

  const parseCSVValue = (value: string, field: keyof Product): unknown => {
    const trimmed = value.trim().replace(/^["']|["']$/g, '');
    
    if (trimmed === '' || trimmed === 'NULL' || trimmed === '#N/D' || trimmed === '#VALOR!') {
      return null;
    }

    // Boolean fields
    if (field === 'activa' || field === 'et_verificada') {
      return trimmed === '1' || trimmed.toLowerCase() === 'true';
    }

    // Numeric fields
    const numericFields = ['ancho', 'alto', 'fuelle_de_fondo', 'pestana_al_ancho', 'pestana_al_alto', 
      'metros_x_bobina', 'unidades_en_ancho', 'unidades_en_largo', 'pisos', 'unidades_por_tarima',
      'piezas_por_paquete', 'paquete_por_caja', 'piezas_totales_por_caja', 'pieces_per_pallet'];
    
    if (numericFields.includes(field as string)) {
      const num = parseFloat(trimmed);
      return isNaN(num) ? null : num;
    }

    return trimmed;
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      // Handle CSV with quoted fields containing commas
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have a header row and at least one data row",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      // Parse header
      const headerLine = lines[0].toLowerCase();
      const headers = parseCSVLine(headerLine);
      
      // Map headers to database columns
      const columnIndices: Record<keyof Product, number> = {} as Record<keyof Product, number>;
      headers.forEach((header, index) => {
        const normalizedHeader = header.replace(/\s+/g, '').toLowerCase();
        const mappedField = CSV_COLUMN_MAP[normalizedHeader] || CSV_COLUMN_MAP[header.toLowerCase()];
        if (mappedField) {
          columnIndices[mappedField] = index;
        }
      });

      // Check for required identifier (codigo_producto or sku)
      const hasIdentifier = columnIndices.codigo_producto !== undefined || columnIndices.sku !== undefined;
      if (!hasIdentifier) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have a 'codigoProducto' or 'sku' column",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      let upsertCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        // Get identifier
        const codigoProducto = columnIndices.codigo_producto !== undefined 
          ? values[columnIndices.codigo_producto]?.trim() 
          : null;
        const sku = columnIndices.sku !== undefined 
          ? values[columnIndices.sku]?.trim() 
          : codigoProducto; // Use codigoProducto as sku if no sku column

        if (!codigoProducto && !sku) continue;

        const productData: Record<string, unknown> = {};

        // Map all columns
        for (const [field, index] of Object.entries(columnIndices)) {
          if (values[index] !== undefined) {
            productData[field] = parseCSVValue(values[index], field as keyof Product);
          }
        }

        // Ensure required fields
        if (!productData.sku && codigoProducto) {
          productData.sku = codigoProducto;
        }
        if (!productData.name) {
          productData.name = productData.nombre_producto_2 || productData.item_description || productData.sku || 'Unknown';
        }
        if (!productData.category) {
          productData.category = productData.tipo_empaque || 'Other';
        }

        // Check if product exists by codigo_producto or sku
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .or(`codigo_producto.eq.${codigoProducto},sku.eq.${sku}`)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', existing.id);

          if (error) {
            console.error('Update error:', error);
            errorCount++;
          } else {
            upsertCount++;
          }
        } else {
          const { error } = await supabase
            .from('products')
            .insert(productData as { sku: string; name: string });

          if (error) {
            console.error('Insert error:', error);
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
      setImporting(false);
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse CSV line handling quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  const downloadCSVTemplate = () => {
    const headers = [
      'et', 'activa', 'descripcionCliente', 'ETVerificada', 'codigoProducto', 'printCard',
      'NombreProducto2', 'TipoEmpaque', 'Estructura', 'Ancho', 'Alto', 'FuelleDeFondo',
      'PestanaAlAncho', 'PestanaAlAlto', 'Refilado', 'MetrosXBobina', 'UnidadesEnAncho',
      'UnidadesEnLargo', 'Pisos', 'UnidadesPorTarima', 'TipoEmbalaje', 'DescripcionCaja',
      'EmpacadoDeProductoPor', 'PiezasPorPaquete', 'PaquetePorCaja', 'PiezasTotalePorCaja',
      'CUSTOMER ITEM', 'ITEM DESCRIPTION', 'CUSTOMER', 'ITEM TYPE', 'PIECES PER PALLET',
      'UNITS', 'DP SALES/CSR NAMES'
    ];
    
    const csvContent = [
      headers.join(','),
      ...products.map(p => [
        p.et || '',
        p.activa ? '1' : '0',
        `"${(p.descripcion_cliente || '').replace(/"/g, '""')}"`,
        p.et_verificada ? '1' : '0',
        p.codigo_producto || '',
        p.print_card || '',
        `"${(p.nombre_producto_2 || '').replace(/"/g, '""')}"`,
        p.tipo_empaque || '',
        `"${(p.estructura || '').replace(/"/g, '""')}"`,
        p.ancho || '',
        p.alto || '',
        p.fuelle_de_fondo || '',
        p.pestana_al_ancho || '',
        p.pestana_al_alto || '',
        p.refilado || '',
        p.metros_x_bobina || '',
        p.unidades_en_ancho || '',
        p.unidades_en_largo || '',
        p.pisos || '',
        p.unidades_por_tarima || '',
        p.tipo_embalaje || '',
        `"${(p.descripcion_caja || '').replace(/"/g, '""')}"`,
        p.empacado_de_producto_por || '',
        p.piezas_por_paquete || '',
        p.paquete_por_caja || '',
        p.piezas_totales_por_caja || '',
        p.customer_item || '',
        `"${(p.item_description || '').replace(/"/g, '""')}"`,
        `"${(p.customer || '').replace(/"/g, '""')}"`,
        p.item_type || '',
        p.pieces_per_pallet || '',
        p.units || '',
        `"${(p.dp_sales_csr_names || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_export.csv';
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

  const handlePCFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    let matchedCount = 0;
    let uploadedCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) {
      // Get filename without extension
      const fileName = file.name;
      const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

      // Find matching product by print_card
      const matchingProduct = products.find(p => 
        p.print_card && p.print_card.toLowerCase() === fileNameWithoutExt.toLowerCase()
      );

      if (!matchingProduct) {
        console.log(`No match found for file: ${fileName}`);
        continue;
      }

      // Upload file to storage
      const filePath = `${matchingProduct.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('print-cards')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        errorCount++;
        continue;
      }

      uploadedCount++;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('print-cards')
        .getPublicUrl(filePath);

      // Update product with file URL
      const { error: updateError } = await supabase
        .from('products')
        .update({ print_card_url: urlData.publicUrl })
        .eq('id', matchingProduct.id);

      if (updateError) {
        console.error('Update error:', updateError);
        errorCount++;
      } else {
        matchedCount++;
      }
    }

    toast({
      title: "PC Files Upload Complete",
      description: `${uploadedCount} files uploaded, ${matchedCount} products matched, ${errorCount} errors`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    await fetchProducts();
    setUploadingFiles(false);

    if (pcFileInputRef.current) {
      pcFileInputRef.current.value = '';
    }
  };

  // Get unique values for each column
  const getUniqueValues = (key: keyof Product) => {
    const values = products.map(p => {
      const val = p[key];
      if (val === null || val === undefined) return null;
      if (typeof val === 'boolean') return val ? 'Active' : 'Inactive';
      return String(val);
    }).filter(Boolean) as string[];
    return [...new Set(values)].sort();
  };

  const uniqueCodigos = getUniqueValues('codigo_producto');
  const uniquePtCodes = getUniqueValues('pt_code');
  const uniqueNombres = getUniqueValues('nombre_producto_2');
  const uniquePrintCards = getUniqueValues('print_card');
  const uniqueCustomerItems = getUniqueValues('customer_item');
  const uniqueDescriptions = getUniqueValues('item_description');
  const uniqueCustomers = getUniqueValues('customer');
  const uniqueItemTypes = getUniqueValues('item_type');
  const uniquePieces = getUniqueValues('pieces_per_pallet');
  const uniqueUnits = getUniqueValues('units');
  const uniqueDpSalesCsr = getUniqueValues('dp_sales_csr_names');
  const activaOptions = ["Active", "Inactive"];
  const pcFileOptions = ["Has File", "No File"];

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.codigo_producto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.nombre_producto_2?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.customer_item?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCodigo = filters.codigo_producto.length === 0 || 
      (product.codigo_producto && filters.codigo_producto.includes(product.codigo_producto));
    const matchesPtCode = filters.pt_code.length === 0 || 
      (product.pt_code && filters.pt_code.includes(product.pt_code));
    const matchesNombre = filters.nombre_producto_2.length === 0 || 
      (product.nombre_producto_2 && filters.nombre_producto_2.includes(product.nombre_producto_2));
    const matchesPrintCard = filters.print_card.length === 0 || 
      (product.print_card && filters.print_card.includes(product.print_card));
    const matchesPcFile = filters.has_pc_file.length === 0 || 
      (filters.has_pc_file.includes("Has File") && product.print_card_url) ||
      (filters.has_pc_file.includes("No File") && !product.print_card_url);
    const matchesActiva = filters.activa.length === 0 || 
      (filters.activa.includes("Active") && product.activa) ||
      (filters.activa.includes("Inactive") && !product.activa);
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
    const matchesUnits = filters.units.length === 0 || 
      (product.units && filters.units.includes(product.units));
    const matchesDpSalesCsr = filters.dp_sales_csr_names.length === 0 || 
      (product.dp_sales_csr_names && filters.dp_sales_csr_names.includes(product.dp_sales_csr_names));

    return matchesSearch && matchesCodigo && matchesPtCode && matchesNombre && matchesPrintCard && matchesPcFile && 
           matchesActiva && matchesCustomerItem && matchesDescription && matchesCustomer && 
           matchesItemType && matchesPieces && matchesUnits && matchesDpSalesCsr;
  });

  const clearFilters = () => {
    setFilters({
      codigo_producto: [],
      pt_code: [],
      nombre_producto_2: [],
      print_card: [],
      has_pc_file: [],
      activa: [],
      customer_item: [],
      item_description: [],
      customer: [],
      item_type: [],
      pieces_per_pallet: [],
      units: [],
      dp_sales_csr_names: [],
    });
    setSearchQuery("");
  };

  const hasActiveFilters = Object.values(filters).some(f => f.length > 0) || searchQuery;

  const toggleFilter = (filterKey: keyof AdminFilters, value: string) => {
    setFilters(prev => {
      const current = prev[filterKey];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [filterKey]: updated };
    });
  };

  const clearColumnFilter = (filterKey: keyof AdminFilters) => {
    setFilters(prev => ({ ...prev, [filterKey]: [] }));
  };

  const ColumnFilterHeader = ({ 
    label, 
    filterKey, 
    options,
    isGreen = false,
    className = ""
  }: { 
    label: string; 
    filterKey: keyof AdminFilters; 
    options: string[];
    isGreen?: boolean;
    className?: string;
  }) => {
    const activeFilters = filters[filterKey];
    const isFiltered = activeFilters.length > 0;
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const baseClass = isGreen ? "bg-green-500/10" : "";
    const textClass = isGreen 
      ? (isFiltered ? "text-green-900 font-bold" : "text-green-700")
      : (isFiltered ? "text-primary font-bold" : "");

    return (
      <TableHead className={`${baseClass} ${className}`}>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 hover:opacity-80 transition-opacity ${textClass}`}>
              {label}
              {isFiltered && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilters.length}</Badge>}
              <ChevronDown className="h-3 w-3" />
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
      </TableHead>
    );
  };

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
              <h1 className="text-2xl font-bold tracking-tight">Admin: Products Management</h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              Manage all product data. Green columns are visible to customers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCSVUpload}
              className="hidden"
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              ref={pcFileInputRef}
              onChange={handlePCFilesUpload}
              multiple
              className="hidden"
            />
            <Button variant="outline" onClick={downloadCSVTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => pcFileInputRef.current?.click()}
              disabled={uploadingFiles}
            >
              {uploadingFiles ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Upload PC Files
            </Button>
          </div>
        </div>

        {/* Search and Instructions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by código, nombre, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Import Instructions</CardTitle>
            <CardDescription className="space-y-2">
              <p>
                <strong>CSV Import:</strong> Upload CSV with headers matching the Excel template. Required: 
                <code className="rounded bg-muted px-1 ml-1">codigoProducto</code>. 
                Green columns are customer-visible.
              </p>
              <p>
                <strong>PC Files Upload:</strong> Upload multiple PC files at once. Files are matched to products by 
                <code className="rounded bg-muted px-1 ml-1">printCard</code> column name. 
                Example: if a product has printCard = "ABC123", upload a file named "ABC123.pdf".
              </p>
            </CardDescription>
          </CardHeader>
        </Card>

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <ColumnFilterHeader label="Código" filterKey="codigo_producto" options={uniqueCodigos} />
                      <ColumnFilterHeader label="PT Code" filterKey="pt_code" options={uniquePtCodes} />
                      <ColumnFilterHeader label="Nombre Producto" filterKey="nombre_producto_2" options={uniqueNombres} />
                      <ColumnFilterHeader label="Print Card" filterKey="print_card" options={uniquePrintCards} />
                      <ColumnFilterHeader label="PC File" filterKey="has_pc_file" options={pcFileOptions} isGreen />
                      <ColumnFilterHeader label="Activa" filterKey="activa" options={activaOptions} />
                      <ColumnFilterHeader label="Customer Item" filterKey="customer_item" options={uniqueCustomerItems} isGreen />
                      <ColumnFilterHeader label="Item Description" filterKey="item_description" options={uniqueDescriptions} isGreen />
                      <ColumnFilterHeader label="Customer" filterKey="customer" options={uniqueCustomers} isGreen />
                      <ColumnFilterHeader label="Item Type" filterKey="item_type" options={uniqueItemTypes} isGreen />
                      <ColumnFilterHeader label="Pcs/Pallet" filterKey="pieces_per_pallet" options={uniquePieces} isGreen className="text-right" />
                      <ColumnFilterHeader label="Units" filterKey="units" options={uniqueUnits} />
                      <ColumnFilterHeader label="DP Sales/CSR Names" filterKey="dp_sales_csr_names" options={uniqueDpSalesCsr} isGreen />
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Badge variant="outline">{product.codigo_producto || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {product.codigo_producto || '-'}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {product.nombre_producto_2 || product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {product.print_card || '-'}
                        </TableCell>
                        <TableCell className="bg-green-500/5">
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
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.activa ? "default" : "secondary"}>
                            {product.activa ? 'Sí' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell className="bg-green-500/5">{product.customer_item || '-'}</TableCell>
                        <TableCell className="bg-green-500/5 max-w-[200px] truncate">
                          {product.item_description || '-'}
                        </TableCell>
                        <TableCell className="bg-green-500/5">{product.customer || '-'}</TableCell>
                        <TableCell className="bg-green-500/5">{product.item_type || '-'}</TableCell>
                        <TableCell className="bg-green-500/5 text-right">
                          {product.pieces_per_pallet?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell>{product.units || '-'}</TableCell>
                        <TableCell className="bg-green-500/5">{product.dp_sales_csr_names || '-'}</TableCell>
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
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      </div>
    </MainLayout>
  );
}

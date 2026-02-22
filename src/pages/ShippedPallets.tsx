import { useState, useEffect, useMemo } from "react";
import { useCustomerLocations } from "@/hooks/useCustomerLocations";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { format } from "date-fns";
import {
  Search,
  Loader2,
  Package,
  CalendarIcon,
  ChevronDown,
  X,
  Download,
  Filter,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShippedPallet {
  id: string;
  pt_code: string;
  description: string;
  customer_lot: string | null;
  bfx_order: string | null;
  quantity: number;
  unit: string;
  destination: string | null;
  shipped_at: string;
  delivery_date: string | null;
  traceability: string | null;
  fecha: string | null;
}

interface Filters {
  customer_lot: string[];
  destination: string[];
}

// destinationLabels now come from useCustomerLocations hook

export default function ShippedPallets() {
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const { getDestinationLabel } = useCustomerLocations();
  const [pallets, setPallets] = useState<ShippedPallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [filters, setFilters] = useState<Filters>({
    customer_lot: [],
    destination: [],
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const fetchShippedPallets = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("shipped_pallets")
        .select("*")
        .order("shipped_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("shipped_at", dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("shipped_at", endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setPallets(data || []);
    } catch (error) {
      console.error("Error fetching shipped pallets:", error);
      toast.error("Failed to load shipped pallets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShippedPallets();
  }, [dateFrom, dateTo]);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const customerLots = [...new Set(pallets.map((p) => p.customer_lot).filter(Boolean))] as string[];
    const destinations = [...new Set(pallets.map((p) => p.destination).filter(Boolean))] as string[];
    return { customerLots, destinations };
  }, [pallets]);

  // Apply filters
  const filteredPallets = useMemo(() => {
    return pallets.filter((pallet) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        pallet.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pallet.pt_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pallet.customer_lot?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (pallet.bfx_order?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      // Column filters
      const matchesCustomerLot =
        filters.customer_lot.length === 0 ||
        (pallet.customer_lot && filters.customer_lot.includes(pallet.customer_lot));

      const matchesDestination =
        filters.destination.length === 0 ||
        (pallet.destination && filters.destination.includes(pallet.destination));

      return matchesSearch && matchesCustomerLot && matchesDestination;
    });
  }, [pallets, searchQuery, filters]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredPallets.reduce(
      (acc, p) => ({
        quantity: acc.quantity + p.quantity,
        count: acc.count + 1,
      }),
      { quantity: 0, count: 0 }
    );
  }, [filteredPallets]);

  const handleFilterChange = (column: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [column]: prev[column].includes(value)
        ? prev[column].filter((v) => v !== value)
        : [...prev[column], value],
    }));
  };

  const clearFilters = () => {
    setFilters({ customer_lot: [], destination: [] });
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchQuery("");
  };

  const hasActiveFilters =
    filters.customer_lot.length > 0 ||
    filters.destination.length > 0 ||
    dateFrom ||
    dateTo ||
    searchQuery;

  const exportToCSV = () => {
    const headers = [
      "PT Code",
      "Description",
      "Customer PO",
      "Sales Order",
      "Quantity",
      "Unit",
      "Destination",
      "Shipped Date",
      "Delivery Date",
    ];
    const rows = filteredPallets.map((p) => [
      p.pt_code,
      p.description,
      p.customer_lot || "",
      p.bfx_order || "",
      p.quantity,
      p.unit,
      p.destination ? getDestinationLabel(p.destination) : "",
      format(new Date(p.shipped_at), "yyyy-MM-dd"),
      p.delivery_date || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipped-pallets-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access restricted to administrators.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('page.shippedPallets.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('page.shippedPallets.subtitle')}
            </p>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pallets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totals.count)}</div>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters ? "Filtered results" : "All time"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totals.quantity)}</div>
              <p className="text-xs text-muted-foreground">Units shipped</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique POs</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(filteredPallets.map((p) => p.customer_lot).filter(Boolean)).size}
              </div>
              <p className="text-xs text-muted-foreground">Customer orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by description, PT code, PO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Date From */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Date To */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "To Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Active filter badges */}
            {(filters.customer_lot.length > 0 || filters.destination.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {filters.customer_lot.map((val) => (
                  <Badge key={val} variant="secondary" className="gap-1">
                    PO: {val}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleFilterChange("customer_lot", val)}
                    />
                  </Badge>
                ))}
                {filters.destination.map((val) => (
                  <Badge key={val} variant="secondary" className="gap-1">
                    {getDestinationLabel(val)}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleFilterChange("destination", val)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No shipped pallets found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasActiveFilters
                    ? "Try adjusting your filters"
                    : "Shipped pallets will appear here once loads are marked as In Transit"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipped Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>
                        <Popover
                          open={openFilter === "customer_lot"}
                          onOpenChange={(open) => setOpenFilter(open ? "customer_lot" : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 -ml-3">
                              Customer PO
                              <ChevronDown className="h-4 w-4" />
                              {filters.customer_lot.length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1">
                                  {filters.customer_lot.length}
                                </Badge>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-0" align="start">
                            <ScrollArea className="h-64">
                              <div className="p-2 space-y-1">
                                {filterOptions.customerLots.map((val) => (
                                  <div
                                    key={val}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                                    onClick={() => handleFilterChange("customer_lot", val)}
                                  >
                                    <Checkbox checked={filters.customer_lot.includes(val)} />
                                    <span className="text-sm truncate">{val}</span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </TableHead>
                      <TableHead>Sales Order</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>
                        <Popover
                          open={openFilter === "destination"}
                          onOpenChange={(open) => setOpenFilter(open ? "destination" : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 -ml-3">
                              Destination
                              <ChevronDown className="h-4 w-4" />
                              {filters.destination.length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1">
                                  {filters.destination.length}
                                </Badge>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-0" align="start">
                            <div className="p-2 space-y-1">
                              {filterOptions.destinations.map((val) => (
                                <div
                                  key={val}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                                  onClick={() => handleFilterChange("destination", val)}
                                >
                                  <Checkbox checked={filters.destination.includes(val)} />
                                  <span className="text-sm">
                                    {getDestinationLabel(val)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableHead>
                      <TableHead>Delivery Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPallets.map((pallet) => (
                      <TableRow key={pallet.id}>
                        <TableCell className="font-medium">
                          {format(new Date(pallet.shipped_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{pallet.description}</p>
                            <p className="text-xs text-muted-foreground">{pallet.pt_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{pallet.customer_lot || "—"}</TableCell>
                        <TableCell>{pallet.bfx_order || "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(pallet.quantity)}
                          <span className="text-xs text-muted-foreground ml-1">{pallet.unit}</span>
                        </TableCell>
                        <TableCell>
                          {pallet.destination ? (
                            <Badge variant="outline">
                              {getDestinationLabel(pallet.destination)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {pallet.delivery_date
                            ? format(new Date(pallet.delivery_date), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  FileWarning,
  Calendar,
  Package,
  Clock
} from "lucide-react";
import { toast } from "sonner";

// Mock data for existing NCRs
const mockNCRs = [
  {
    id: "NCR-2024-001",
    poNumber: "PO-2024-1847",
    product: "Stand-up Pouches - Coffee Blend",
    issueType: "Print Quality",
    description: "Color variation on logo - appears lighter than approved sample",
    status: "Under Review",
    submittedDate: "2024-01-15",
    quantity: 5000,
  },
  {
    id: "NCR-2024-002",
    poNumber: "PO-2024-1832",
    product: "Flat Pouches - Protein Bar",
    issueType: "Seal Integrity",
    description: "Weak bottom seal on approximately 3% of batch",
    status: "Resolved",
    submittedDate: "2024-01-10",
    quantity: 2000,
  },
  {
    id: "NCR-2024-003",
    poNumber: "PO-2024-1820",
    product: "Roll Stock - Snack Wrap",
    issueType: "Dimension",
    description: "Width is 2mm under specification",
    status: "Pending",
    submittedDate: "2024-01-08",
    quantity: 10000,
  },
];

// Mock data for previous POs
const mockPreviousPOs = [
  { id: "PO-2024-1847", product: "Stand-up Pouches - Coffee Blend" },
  { id: "PO-2024-1832", product: "Flat Pouches - Protein Bar" },
  { id: "PO-2024-1820", product: "Roll Stock - Snack Wrap" },
  { id: "PO-2024-1815", product: "Ziplock Bags - Trail Mix" },
  { id: "PO-2024-1801", product: "Vacuum Pouches - Meat Products" },
];

const issueTypes = [
  "Print Quality",
  "Seal Integrity",
  "Dimension",
  "Material Defect",
  "Contamination",
  "Labeling Error",
  "Wrong Product",
  "Quantity Shortage",
  "Other",
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Resolved":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "Under Review":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "Pending":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function NonConformance() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    poNumber: "",
    issueType: "",
    affectedQuantity: "",
    description: "",
  });

  const filteredNCRs = mockNCRs.filter(
    (ncr) =>
      ncr.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.product.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.poNumber || !formData.issueType || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    toast.success("Non-Conformance Report submitted successfully", {
      description: `NCR for ${formData.poNumber} has been submitted for review.`,
    });
    
    setFormData({
      poNumber: "",
      issueType: "",
      affectedQuantity: "",
      description: "",
    });
    setDialogOpen(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Non-Conformance Reports</h1>
            <p className="text-muted-foreground">
              Submit and track quality issues with previous orders
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Submit NCR
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-amber-500" />
                  Submit Non-Conformance Report
                </DialogTitle>
                <DialogDescription>
                  Report a quality issue with a previous purchase order. Our team will review and respond within 48 hours.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="poNumber">Purchase Order *</Label>
                  <Select
                    value={formData.poNumber}
                    onValueChange={(value) =>
                      setFormData({ ...formData, poNumber: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a PO" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockPreviousPOs.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.id} - {po.product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issueType">Issue Type *</Label>
                  <Select
                    value={formData.issueType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, issueType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="affectedQuantity">Affected Quantity</Label>
                  <Input
                    id="affectedQuantity"
                    type="number"
                    placeholder="Number of affected units"
                    value={formData.affectedQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, affectedQuantity: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail. Include lot numbers, specific defects observed, and any relevant measurements..."
                    className="min-h-[120px]"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Submit Report</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">2</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Under Investigation</p>
                  <p className="text-2xl font-bold">1</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved This Month</p>
                  <p className="text-2xl font-bold">1</p>
                </div>
                <FileWarning className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search NCRs by ID, PO, or product..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* NCR List */}
        <div className="space-y-4">
          {filteredNCRs.map((ncr) => (
            <Card key={ncr.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{ncr.id}</CardTitle>
                      <Badge className={getStatusColor(ncr.status)} variant="outline">
                        {ncr.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5" />
                      {ncr.poNumber} • {ncr.product}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {ncr.issueType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{ncr.description}</p>
                <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Submitted: {new Date(ncr.submittedDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Affected: {ncr.quantity.toLocaleString()} units
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredNCRs.length === 0 && (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <FileWarning className="h-12 w-12 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold">No NCRs Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No non-conformance reports match your search criteria.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

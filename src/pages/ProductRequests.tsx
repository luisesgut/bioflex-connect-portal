import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductRequestStatus = 
  | 'draft'
  | 'specs_submitted'
  | 'artwork_uploaded'
  | 'pc_in_review'
  | 'pc_approved'
  | 'bionet_pending'
  | 'bionet_registered'
  | 'sap_pending'
  | 'sap_registered'
  | 'completed';

interface ProductRequest {
  id: string;
  product_name: string;
  customer: string | null;
  status: ProductRequestStatus;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<ProductRequestStatus, string> = {
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

const customerVisibleStatuses: ProductRequestStatus[] = [
  'draft',
  'specs_submitted',
  'artwork_uploaded',
  'pc_in_review',
  'pc_approved',
  'completed',
];

const getStatusBadgeVariant = (status: ProductRequestStatus) => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'specs_submitted':
    case 'artwork_uploaded':
      return 'outline';
    case 'pc_in_review':
      return 'default';
    case 'pc_approved':
    case 'bionet_registered':
    case 'sap_registered':
      return 'default';
    case 'completed':
      return 'default';
    default:
      return 'secondary';
  }
};

const getCustomerVisibleStatus = (status: ProductRequestStatus, isAdmin: boolean): string => {
  if (isAdmin) return statusLabels[status];
  
  // For customers, show "In Progress" for internal statuses
  if (!customerVisibleStatuses.includes(status)) {
    return "In Progress";
  }
  return statusLabels[status];
};

export default function ProductRequests() {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('product_requests')
        .select('id, product_name, customer, status, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching product requests:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Product Requests</h1>
            <p className="text-muted-foreground">
              Manage new product onboarding and approvals
            </p>
          </div>
          <Button onClick={() => navigate('/product-requests/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Product Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No product requests yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by creating a new product request
                </p>
                <Button onClick={() => navigate('/product-requests/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Request
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.product_name}
                      </TableCell>
                      <TableCell>{request.customer || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {getCustomerVisibleStatus(request.status, isAdmin)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.updated_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/product-requests/${request.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
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

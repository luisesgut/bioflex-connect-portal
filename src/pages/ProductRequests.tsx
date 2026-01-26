import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Eye, Trash2, MoreHorizontal, Wrench, Palette, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type ViewMode = 'all' | 'engineering' | 'design';

interface ProductRequest {
  id: string;
  product_name: string;
  customer: string | null;
  status: ProductRequestStatus;
  engineering_status: string | null;
  design_status: string | null;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<ProductRequest | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('product_requests')
        .select('id, product_name, customer, status, engineering_status, design_status, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching product requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter requests based on view mode
  const filteredRequests = requests.filter(request => {
    if (viewMode === 'all') return true;
    if (viewMode === 'engineering') {
      // Show requests that need engineering review (pending or changes_required)
      return request.engineering_status === 'pending' || 
             request.engineering_status === 'changes_required' ||
             request.engineering_status === 'customer_review';
    }
    if (viewMode === 'design') {
      // Show requests approved by engineering that are in design phase
      return request.engineering_status === 'approved' && 
             (request.design_status === 'pending' || 
              request.design_status === 'in_progress' ||
              request.status === 'pc_in_review');
    }
    return true;
  });

  const handleDeleteClick = (request: ProductRequest) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;

    try {
      const { error } = await supabase
        .from('product_requests')
        .delete()
        .eq('id', requestToDelete.id);

      if (error) throw error;

      toast({
        title: t('productRequests.deleteSuccess'),
        description: requestToDelete.product_name,
      });

      setRequests(requests.filter(r => r.id !== requestToDelete.id));
    } catch (error) {
      console.error('Error deleting product request:', error);
      toast({
        title: t('productRequests.deleteError'),
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('productRequests.title')}</h1>
            <p className="text-muted-foreground">
              {t('productRequests.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(value) => value && setViewMode(value as ViewMode)}
                className="bg-muted p-1 rounded-lg"
              >
                <ToggleGroupItem value="all" aria-label="All requests" className="px-3 data-[state=on]:bg-background">
                  <List className="h-4 w-4 mr-2" />
                  {t('productRequests.viewAll')}
                </ToggleGroupItem>
                <ToggleGroupItem value="engineering" aria-label="Engineering view" className="px-3 data-[state=on]:bg-background">
                  <Wrench className="h-4 w-4 mr-2" />
                  {t('productRequests.viewEngineering')}
                </ToggleGroupItem>
                <ToggleGroupItem value="design" aria-label="Design view" className="px-3 data-[state=on]:bg-background">
                  <Palette className="h-4 w-4 mr-2" />
                  {t('productRequests.viewDesign')}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <Button onClick={() => navigate('/product-requests/new')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('action.newRequest')}
            </Button>
          </div>
        </div>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('productRequests.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {viewMode === 'all' ? t('productRequests.noRequests') : t('productRequests.noRequestsInView')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {viewMode === 'all' ? t('productRequests.startByCreating') : t('productRequests.noRequestsInViewDesc')}
                </p>
                {viewMode === 'all' && (
                  <Button onClick={() => navigate('/product-requests/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('action.newRequest')}
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.productName')}</TableHead>
                    <TableHead>{t('table.customer')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    {viewMode === 'engineering' && <TableHead>{t('table.engineeringStatus')}</TableHead>}
                    {viewMode === 'design' && <TableHead>{t('table.designStatus')}</TableHead>}
                    <TableHead>{t('table.created')}</TableHead>
                    <TableHead>{t('table.updated')}</TableHead>
                    <TableHead className="text-right">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
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
                      {viewMode === 'engineering' && (
                        <TableCell>
                          <Badge variant={
                            request.engineering_status === 'approved' ? 'default' :
                            request.engineering_status === 'pending' ? 'secondary' :
                            request.engineering_status === 'customer_review' ? 'outline' : 'destructive'
                          }>
                            {request.engineering_status || 'Pending'}
                          </Badge>
                        </TableCell>
                      )}
                      {viewMode === 'design' && (
                        <TableCell>
                          <Badge variant={
                            request.design_status === 'approved' ? 'default' :
                            request.design_status === 'pending' ? 'secondary' : 'outline'
                          }>
                            {request.design_status || 'Pending'}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.updated_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => navigate(`/product-requests/${request.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t('action.view')}
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(request)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('action.delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('action.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('productRequests.deleteConfirm')}
              <br />
              <strong>{requestToDelete?.product_name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('action.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

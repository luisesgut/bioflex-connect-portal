import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { format } from "date-fns";

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
  engineering_status: string | null;
  design_status: string | null;
  created_at: string;
  updated_at: string;
}

interface ProductRequestsKanbanProps {
  requests: ProductRequest[];
  isAdmin: boolean;
}

const statusConfig: { status: ProductRequestStatus; colorClass: string }[] = [
  { status: 'draft', colorClass: 'bg-muted border-muted-foreground/20' },
  { status: 'specs_submitted', colorClass: 'bg-blue-500/10 border-blue-500/30' },
  { status: 'artwork_uploaded', colorClass: 'bg-purple-500/10 border-purple-500/30' },
  { status: 'pc_in_review', colorClass: 'bg-amber-500/10 border-amber-500/30' },
  { status: 'pc_approved', colorClass: 'bg-emerald-500/10 border-emerald-500/30' },
  { status: 'bionet_pending', colorClass: 'bg-orange-500/10 border-orange-500/30' },
  { status: 'bionet_registered', colorClass: 'bg-teal-500/10 border-teal-500/30' },
  { status: 'sap_pending', colorClass: 'bg-indigo-500/10 border-indigo-500/30' },
  { status: 'sap_registered', colorClass: 'bg-cyan-500/10 border-cyan-500/30' },
  { status: 'completed', colorClass: 'bg-green-500/10 border-green-500/30' },
];

export function ProductRequestsKanban({ requests, isAdmin }: ProductRequestsKanbanProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const getRequestsByStatus = (status: ProductRequestStatus) => {
    return requests.filter(r => r.status === status);
  };

  const getStatusLabel = (status: ProductRequestStatus): string => {
    const key = `status.${status.replace(/_/g, '')}` as string;
    const translated = t(key);
    // Fallback to formatted status if no translation found
    if (translated === key) {
      return status.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    return translated;
  };

  // For customers, only show visible statuses
  const visibleStatuses = isAdmin 
    ? statusConfig 
    : statusConfig.filter(s => 
        ['draft', 'specs_submitted', 'artwork_uploaded', 'pc_in_review', 'pc_approved', 'completed'].includes(s.status)
      );

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {visibleStatuses.map(({ status, colorClass }) => {
          const statusRequests = getRequestsByStatus(status);
          
          return (
            <div key={status} className="flex-shrink-0 w-72">
              <div className={`rounded-lg border-2 ${colorClass} h-full`}>
                <div className="p-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">
                      {getStatusLabel(status)}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {statusRequests.length}
                    </Badge>
                  </div>
                </div>
                
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="p-2 space-y-2">
                    {statusRequests.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        —
                      </div>
                    ) : (
                      statusRequests.map((request) => (
                        <Card 
                          key={request.id}
                          className="cursor-pointer hover:shadow-md transition-shadow bg-card"
                          onClick={() => navigate(`/product-requests/${request.id}`)}
                        >
                          <CardContent className="p-3">
                            <h4 className="font-medium text-sm line-clamp-2 mb-1">
                              {request.product_name}
                            </h4>
                            {request.customer && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {request.customer}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{format(new Date(request.created_at), 'MMM d')}</span>
                              {isAdmin && request.engineering_status && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {request.engineering_status}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

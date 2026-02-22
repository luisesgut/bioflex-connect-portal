import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Truck,
  MapPin,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface TransitLoad {
  id: string;
  load_id: string;
  requested_at: string;
  status: "pending" | "approved" | "on_hold" | "shipped";
  is_hot_order: boolean;
  load: {
    id: string;
    load_number: string;
    shipping_date: string;
    estimated_delivery_date: string | null;
    total_pallets: number;
    status: string;
    eta_cross_border: string | null;
    documents_sent: boolean;
    border_crossed: boolean;
    last_reported_city: string | null;
    transit_notes: string | null;
  };
}

interface TransitTrackingTableProps {
  loads: TransitLoad[];
  isAdmin: boolean;
  onRefresh: () => void;
}

export function TransitTrackingTable({
  loads,
}: TransitTrackingTableProps) {
  const getDaysInTransit = (shippingDate: string) => {
    return differenceInDays(new Date(), new Date(shippingDate));
  };

  if (loads.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Truck className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No loads in transit</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Load #</TableHead>
            <TableHead>Ship Date</TableHead>
            <TableHead>Last Reported City</TableHead>
            <TableHead className="text-center">Days in Transit</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loads.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {request.load.load_number}
                  {request.is_hot_order && (
                    <Badge variant="destructive" className="text-xs">
                      HOT
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {format(new Date(request.load.shipping_date), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span>{request.load.last_reported_city || "-"}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="font-mono">
                  {getDaysInTransit(request.load.shipping_date)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/shipping-loads/${request.load_id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

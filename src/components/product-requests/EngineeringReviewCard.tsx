import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Check, X, Clock, AlertCircle, Send, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EngineeringStatus = 'pending' | 'approved' | 'changes_required' | 'customer_review';

interface EngineeringProposal {
  id: string;
  version_number: number;
  proposed_by: string;
  proposed_at: string;
  width_cm: number | null;
  length_cm: number | null;
  gusset_cm: number | null;
  zipper_cm: number | null;
  thickness_value: number | null;
  thickness_unit: 'gauge' | 'microns';
  reason: string;
  customer_approved: boolean | null;
  customer_response_at: string | null;
  customer_feedback: string | null;
  is_active: boolean;
}

interface ProductRequest {
  id: string;
  product_name: string;
  width_inches: number | null;
  length_inches: number | null;
  gusset_inches: number | null;
  zipper_inches: number | null;
  width_cm: number | null;
  length_cm: number | null;
  gusset_cm: number | null;
  zipper_cm: number | null;
  thickness_value: number | null;
  thickness_unit: 'gauge' | 'microns';
  engineering_status: EngineeringStatus;
  engineering_notes: string | null;
}

interface EngineeringReviewProps {
  request: ProductRequest;
  proposals: EngineeringProposal[];
  onUpdate: () => void;
}

const statusConfig: Record<EngineeringStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending Review", color: "bg-yellow-500/10 text-yellow-600", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/10 text-green-600", icon: Check },
  changes_required: { label: "Changes Required", color: "bg-orange-500/10 text-orange-600", icon: AlertCircle },
  customer_review: { label: "Awaiting Customer", color: "bg-blue-500/10 text-blue-600", icon: Send },
};

// Convert cm to inches for display
function cmToInches(cm: number): string {
  return (cm / 2.54).toFixed(3);
}

export function EngineeringReviewCard({ request, proposals, onUpdate }: EngineeringReviewProps) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<EngineeringProposal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Proposal form state
  const [proposedWidth, setProposedWidth] = useState("");
  const [proposedLength, setProposedLength] = useState("");
  const [proposedGusset, setProposedGusset] = useState("");
  const [proposedThickness, setProposedThickness] = useState("");
  const [proposedThicknessUnit, setProposedThicknessUnit] = useState<"gauge" | "microns">("microns");
  const [proposalReason, setProposalReason] = useState("");

  // Customer response state
  const [customerFeedback, setCustomerFeedback] = useState("");

  const activeProposal = proposals.find(p => p.is_active && p.customer_approved === null);
  const statusInfo = statusConfig[request.engineering_status];
  const StatusIcon = statusInfo.icon;

  const handleApproveRequest = async () => {
    setSubmitting(true);
    try {
      await supabase
        .from('product_requests')
        .update({
          engineering_status: 'approved',
          engineering_reviewed_by: user?.id,
          engineering_reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      toast.success("Engineering review approved");
      onUpdate();
    } catch (error) {
      toast.error("Failed to approve");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitProposal = async () => {
    if (!proposalReason.trim()) {
      toast.error("Please provide a reason for the proposed changes");
      return;
    }

    setSubmitting(true);
    try {
      // Deactivate previous proposals
      await supabase
        .from('engineering_proposals')
        .update({ is_active: false })
        .eq('product_request_id', request.id);

      // Create new proposal
      await supabase
        .from('engineering_proposals')
        .insert({
          product_request_id: request.id,
          proposed_by: user?.id,
          width_cm: proposedWidth ? parseFloat(proposedWidth) : null,
          length_cm: proposedLength ? parseFloat(proposedLength) : null,
          gusset_cm: proposedGusset ? parseFloat(proposedGusset) : null,
          thickness_value: proposedThickness ? parseFloat(proposedThickness) : null,
          thickness_unit: proposedThicknessUnit,
          reason: proposalReason,
          is_active: true,
        });

      // Update request status
      await supabase
        .from('product_requests')
        .update({
          engineering_status: 'customer_review',
          engineering_notes: proposalReason,
        })
        .eq('id', request.id);

      toast.success("Proposal sent to customer");
      setProposalDialogOpen(false);
      resetProposalForm();
      onUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomerResponse = async (approved: boolean) => {
    if (!activeProposal) return;

    setSubmitting(true);
    try {
      await supabase
        .from('engineering_proposals')
        .update({
          customer_approved: approved,
          customer_response_at: new Date().toISOString(),
          customer_feedback: customerFeedback || null,
        })
        .eq('id', activeProposal.id);

      if (approved) {
        // Update request with new measurements
        const updates: Record<string, unknown> = {
          engineering_status: 'approved',
        };
        
        if (activeProposal.width_cm) updates.width_cm = activeProposal.width_cm;
        if (activeProposal.length_cm) updates.length_cm = activeProposal.length_cm;
        if (activeProposal.gusset_cm) updates.gusset_cm = activeProposal.gusset_cm;
        if (activeProposal.thickness_value) {
          updates.thickness_value = activeProposal.thickness_value;
          updates.thickness_unit = activeProposal.thickness_unit;
        }

        await supabase
          .from('product_requests')
          .update(updates)
          .eq('id', request.id);
      } else {
        await supabase
          .from('product_requests')
          .update({ engineering_status: 'changes_required' })
          .eq('id', request.id);
      }

      toast.success(approved ? "Changes approved" : "Changes rejected - engineering will review");
      setResponseDialogOpen(false);
      setCustomerFeedback("");
      onUpdate();
    } catch (error) {
      toast.error("Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  };

  const resetProposalForm = () => {
    setProposedWidth(request.width_cm?.toString() || "");
    setProposedLength(request.length_cm?.toString() || "");
    setProposedGusset(request.gusset_cm?.toString() || "");
    setProposedThickness(request.thickness_value?.toString() || "");
    setProposedThicknessUnit(request.thickness_unit || "microns");
    setProposalReason("");
  };

  const openProposalDialog = () => {
    resetProposalForm();
    setProposalDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Engineering Review
              <Badge className={cn("ml-2", statusInfo.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </CardTitle>
            <CardDescription>
              Technical feasibility review and measurement adjustments
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Measurements */}
        <div>
          <Label className="text-muted-foreground mb-2 block">Current Measurements</Label>
          <div className="grid gap-4 sm:grid-cols-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Width</p>
              <p className="font-medium">
                {request.width_inches ? `${request.width_inches}"` : '-'}
                {request.width_cm && <span className="text-muted-foreground ml-1">({request.width_cm.toFixed(2)} cm)</span>}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Length</p>
              <p className="font-medium">
                {request.length_inches ? `${request.length_inches}"` : '-'}
                {request.length_cm && <span className="text-muted-foreground ml-1">({request.length_cm.toFixed(2)} cm)</span>}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Gusset</p>
              <p className="font-medium">
                {request.gusset_inches ? `${request.gusset_inches}"` : '-'}
                {request.gusset_cm && <span className="text-muted-foreground ml-1">({request.gusset_cm.toFixed(2)} cm)</span>}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Thickness</p>
              <p className="font-medium">
                {request.thickness_value 
                  ? `${request.thickness_value} ${request.thickness_unit === 'gauge' ? 'ga' : 'μm'}`
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Active Proposal (for customer view) */}
        {!isAdmin && activeProposal && (
          <div className="p-4 border border-blue-200 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Engineering Proposal v{activeProposal.version_number}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {activeProposal.reason}
                  </p>
                </div>
                
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  {activeProposal.width_cm && (
                    <div>
                      <span className="text-muted-foreground">New Width: </span>
                      <span className="font-medium">{cmToInches(activeProposal.width_cm)}" ({activeProposal.width_cm.toFixed(2)} cm)</span>
                    </div>
                  )}
                  {activeProposal.length_cm && (
                    <div>
                      <span className="text-muted-foreground">New Length: </span>
                      <span className="font-medium">{cmToInches(activeProposal.length_cm)}" ({activeProposal.length_cm.toFixed(2)} cm)</span>
                    </div>
                  )}
                  {activeProposal.thickness_value && (
                    <div>
                      <span className="text-muted-foreground">New Thickness: </span>
                      <span className="font-medium">
                        {activeProposal.thickness_value} {activeProposal.thickness_unit === 'gauge' ? 'ga' : 'μm'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => { setSelectedProposal(activeProposal); setResponseDialogOpen(true); }}>
                    <Check className="h-4 w-4 mr-1" />
                    Accept Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedProposal(activeProposal); setResponseDialogOpen(true); }}>
                    <X className="h-4 w-4 mr-1" />
                    Request Revision
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Actions */}
        {isAdmin && request.engineering_status === 'pending' && (
          <div className="flex gap-2">
            <Button onClick={handleApproveRequest} disabled={submitting}>
              <Check className="h-4 w-4 mr-2" />
              Approve as-is
            </Button>
            <Button variant="outline" onClick={openProposalDialog}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Propose Changes
            </Button>
          </div>
        )}

        {isAdmin && request.engineering_status === 'changes_required' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openProposalDialog}>
              <Send className="h-4 w-4 mr-2" />
              Submit New Proposal
            </Button>
          </div>
        )}

        {/* Proposal History */}
        {proposals.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <Label className="text-muted-foreground">Proposal History</Label>
              </div>
              <div className="space-y-2">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className={cn(
                      "p-3 rounded-lg border text-sm",
                      proposal.customer_approved === true && "bg-green-50 border-green-200 dark:bg-green-950/20",
                      proposal.customer_approved === false && "bg-red-50 border-red-200 dark:bg-red-950/20",
                      proposal.customer_approved === null && proposal.is_active && "bg-blue-50 border-blue-200 dark:bg-blue-950/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Version {proposal.version_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {proposal.customer_approved === true && "Approved"}
                        {proposal.customer_approved === false && "Rejected"}
                        {proposal.customer_approved === null && "Pending"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">{proposal.reason}</p>
                    {proposal.customer_feedback && (
                      <p className="mt-2 text-sm italic">
                        Customer: "{proposal.customer_feedback}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Proposal Dialog */}
      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Propose Measurement Changes</DialogTitle>
            <DialogDescription>
              Enter the adjusted measurements that are feasible for manufacturing. 
              Values should be in centimeters (will be shown to customer in inches).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="proposed_width">Width (cm)</Label>
                <Input
                  id="proposed_width"
                  type="number"
                  step="0.01"
                  value={proposedWidth}
                  onChange={(e) => setProposedWidth(e.target.value)}
                  placeholder={request.width_cm?.toString() || "0"}
                />
                {proposedWidth && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {cmToInches(parseFloat(proposedWidth))}"
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposed_length">Length (cm)</Label>
                <Input
                  id="proposed_length"
                  type="number"
                  step="0.01"
                  value={proposedLength}
                  onChange={(e) => setProposedLength(e.target.value)}
                  placeholder={request.length_cm?.toString() || "0"}
                />
                {proposedLength && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {cmToInches(parseFloat(proposedLength))}"
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposed_gusset">Gusset (cm)</Label>
                <Input
                  id="proposed_gusset"
                  type="number"
                  step="0.01"
                  value={proposedGusset}
                  onChange={(e) => setProposedGusset(e.target.value)}
                  placeholder={request.gusset_cm?.toString() || "0"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposed_thickness">Thickness</Label>
                <div className="flex gap-2">
                  <Input
                    id="proposed_thickness"
                    type="number"
                    step="0.1"
                    value={proposedThickness}
                    onChange={(e) => setProposedThickness(e.target.value)}
                    placeholder="0"
                  />
                  <select
                    value={proposedThicknessUnit}
                    onChange={(e) => setProposedThicknessUnit(e.target.value as "gauge" | "microns")}
                    className="w-20 border rounded-md px-2"
                  >
                    <option value="gauge">ga</option>
                    <option value="microns">μm</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal_reason">Reason for Changes *</Label>
              <Textarea
                id="proposal_reason"
                value={proposalReason}
                onChange={(e) => setProposalReason(e.target.value)}
                placeholder="Explain why these measurements need to be adjusted for manufacturing..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitProposal} disabled={submitting || !proposalReason.trim()}>
              {submitting ? "Sending..." : "Send Proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Proposal</DialogTitle>
            <DialogDescription>
              Review the proposed changes and provide your feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={customerFeedback}
              onChange={(e) => setCustomerFeedback(e.target.value)}
              placeholder="Optional feedback or comments..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleCustomerResponse(false)}
              disabled={submitting}
            >
              Reject Changes
            </Button>
            <Button 
              onClick={() => handleCustomerResponse(true)}
              disabled={submitting}
            >
              Accept Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
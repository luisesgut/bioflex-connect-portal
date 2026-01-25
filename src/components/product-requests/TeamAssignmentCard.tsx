import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/hooks/useLanguage";
import { UserCog, Wrench, Palette, Check } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  team_role: string;
}

interface TeamAssignmentCardProps {
  productRequestId: string;
  currentEngineerId?: string | null;
  currentDesignerId?: string | null;
  engineeringStatus?: string;
  designStatus?: string;
  onAssignmentChange?: () => void;
}

export function TeamAssignmentCard({
  productRequestId,
  currentEngineerId,
  currentDesignerId,
  engineeringStatus,
  designStatus,
  onAssignmentChange,
}: TeamAssignmentCardProps) {
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const [engineers, setEngineers] = useState<TeamMember[]>([]);
  const [designers, setDesigners] = useState<TeamMember[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<string>(currentEngineerId || "");
  const [selectedDesigner, setSelectedDesigner] = useState<string>(currentDesignerId || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    setSelectedEngineer(currentEngineerId || "");
    setSelectedDesigner(currentDesignerId || "");
  }, [currentEngineerId, currentDesignerId]);

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('full_name');

    if (!error && data) {
      setEngineers(data.filter(m => 
        m.team_role === 'engineer' || m.team_role === 'engineering_leader'
      ));
      setDesigners(data.filter(m => 
        m.team_role === 'designer' || m.team_role === 'design_leader'
      ));
    }
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string | null> = {};
      
      if (selectedEngineer !== (currentEngineerId || "")) {
        updates.assigned_engineer = selectedEngineer || null;
      }
      if (selectedDesigner !== (currentDesignerId || "")) {
        updates.assigned_designer = selectedDesigner || null;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('product_requests')
          .update(updates)
          .eq('id', productRequestId);

        if (error) throw error;
        toast.success(t('productRequests.assignmentSaved'));
        onAssignmentChange?.();
      }
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error(t('productRequests.assignmentError'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{t('status.pending')}</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500">{t('status.approved')}</Badge>;
      case 'changes_required':
      case 'customer_review':
        return <Badge variant="outline">{t('status.inReview')}</Badge>;
      case 'in_progress':
        return <Badge>{t('status.inProgress')}</Badge>;
      default:
        return null;
    }
  };

  const hasChanges = 
    selectedEngineer !== (currentEngineerId || "") ||
    selectedDesigner !== (currentDesignerId || "");

  if (!isAdmin) {
    // Show read-only view for non-admins
    const currentEngineerName = engineers.find(e => e.user_id === currentEngineerId)?.full_name;
    const currentDesignerName = designers.find(d => d.user_id === currentDesignerId)?.full_name;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            {t('productRequests.teamAssignments')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                {t('productRequests.assignedEngineer')}
              </Label>
              <p className="text-sm font-medium">
                {currentEngineerName || t('productRequests.notAssigned')}
              </p>
              {engineeringStatus && getStatusBadge(engineeringStatus)}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Palette className="h-3 w-3" />
                {t('productRequests.assignedDesigner')}
              </Label>
              <p className="text-sm font-medium">
                {currentDesignerName || t('productRequests.notAssigned')}
              </p>
              {designStatus && getStatusBadge(designStatus)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCog className="h-4 w-4" />
          {t('productRequests.teamAssignments')}
        </CardTitle>
        <CardDescription>
          {t('productRequests.assignTeamMembers')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Engineering Assignment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {t('productRequests.assignedEngineer')}
            </Label>
            <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
              <SelectTrigger>
                <SelectValue placeholder={t('productRequests.selectEngineer')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— {t('productRequests.notAssigned')} —</SelectItem>
                {engineers.map((eng) => (
                  <SelectItem key={eng.id} value={eng.user_id}>
                    <span className="flex items-center gap-2">
                      {eng.full_name}
                      {eng.team_role === 'engineering_leader' && (
                        <Badge variant="outline" className="text-xs">Leader</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {engineeringStatus && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('table.status')}:</span>
                {getStatusBadge(engineeringStatus)}
              </div>
            )}
          </div>

          {/* Design Assignment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Palette className="h-3 w-3" />
              {t('productRequests.assignedDesigner')}
            </Label>
            <Select value={selectedDesigner} onValueChange={setSelectedDesigner}>
              <SelectTrigger>
                <SelectValue placeholder={t('productRequests.selectDesigner')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— {t('productRequests.notAssigned')} —</SelectItem>
                {designers.map((des) => (
                  <SelectItem key={des.id} value={des.user_id}>
                    <span className="flex items-center gap-2">
                      {des.full_name}
                      {des.team_role === 'design_leader' && (
                        <Badge variant="outline" className="text-xs">Leader</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {designStatus && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('table.status')}:</span>
                {getStatusBadge(designStatus)}
              </div>
            )}
          </div>
        </div>

        {hasChanges && (
          <Button 
            onClick={handleSaveAssignments} 
            disabled={saving}
            className="w-full sm:w-auto"
          >
            <Check className="h-4 w-4 mr-2" />
            {saving ? t('action.saving') : t('action.saveAssignments')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

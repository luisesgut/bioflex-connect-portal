import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TeamRole = Database["public"]["Enums"]["team_role"];
type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];

const TEAM_ROLES: TeamRole[] = [
  "engineering_leader",
  "engineer",
  "design_leader",
  "designer",
  "sales_rep",
  "customer_service",
];

export function TeamManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    team_role: "" as TeamRole | "",
  });

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("team_role", { ascending: true })
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      full_name: string;
      email: string;
      team_role: TeamRole;
    }) => {
      // Generate a placeholder user_id (in production, this would link to actual auth users)
      const { data: result, error } = await supabase
        .from("team_members")
        .insert({
          ...data,
          user_id: crypto.randomUUID(),
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: t("teamManagement.memberAdded"),
        description: t("teamManagement.memberAddedDesc"),
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TeamMember>;
    }) => {
      const { error } = await supabase
        .from("team_members")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: t("teamManagement.memberUpdated"),
        description: t("teamManagement.memberUpdatedDesc"),
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: t("teamManagement.memberDeleted"),
        description: t("teamManagement.memberDeletedDesc"),
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ full_name: "", email: "", team_role: "" });
    setEditingMember(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.team_role) return;

    if (editingMember) {
      updateMutation.mutate({
        id: editingMember.id,
        data: {
          full_name: formData.full_name,
          email: formData.email,
          team_role: formData.team_role as TeamRole,
        },
      });
    } else {
      createMutation.mutate({
        full_name: formData.full_name,
        email: formData.email,
        team_role: formData.team_role as TeamRole,
      });
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email,
      team_role: member.team_role,
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (member: TeamMember) => {
    updateMutation.mutate({
      id: member.id,
      data: { is_active: !member.is_active },
    });
  };

  const getRoleBadgeVariant = (role: TeamRole) => {
    if (role.includes("leader")) return "default";
    if (role.includes("engineer")) return "secondary";
    if (role.includes("design")) return "outline";
    return "secondary";
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">
              {t("teamManagement.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("teamManagement.subtitle")}
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              {t("teamManagement.addMember")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>
                {editingMember
                  ? t("teamManagement.editMember")
                  : t("teamManagement.addMember")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">
                  {t("teamManagement.fullName")}
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("teamManagement.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team_role">{t("teamManagement.role")}</Label>
                <Select
                  value={formData.team_role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, team_role: value as TeamRole })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue
                      placeholder={t("teamManagement.selectRole")}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {TEAM_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`teamRoles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {editingMember ? t("common.save") : t("common.add")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("common.loading")}...
        </div>
      ) : teamMembers && teamMembers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("teamManagement.fullName")}</TableHead>
              <TableHead>{t("teamManagement.email")}</TableHead>
              <TableHead>{t("teamManagement.role")}</TableHead>
              <TableHead>{t("teamManagement.active")}</TableHead>
              <TableHead className="text-right">
                {t("common.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.full_name}
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.team_role)}>
                    {t(`teamRoles.${member.team_role}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={member.is_active}
                    onCheckedChange={() => handleToggleActive(member)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(member)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(member.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {t("teamManagement.noMembers")}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "products", label: "Products" },
  { key: "purchase_orders", label: "Purchase Orders" },
  { key: "shipping_loads", label: "Shipping Loads" },
  { key: "product_requests", label: "Product Requests" },
  { key: "inventory", label: "Inventory" },
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users" },
];

interface AccessProfile {
  id: string;
  name: string;
  description: string | null;
  user_type: string;
  is_default: boolean;
  is_active: boolean;
}

interface Permission {
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

export function AccessProfilesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    user_type: "internal" as string,
  });
  const [permissions, setPermissions] = useState<Permission[]>(
    MODULES.map((m) => ({ module: m.key, can_view: false, can_edit: false }))
  );

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["access-profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_profiles")
        .select("*")
        .order("user_type")
        .order("name");
      if (error) throw error;
      return data as AccessProfile[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      user_type: string;
      permissions: Permission[];
    }) => {
      const { data: profile, error } = await supabase
        .from("access_profiles")
        .insert({
          name: data.name,
          description: data.description || null,
          user_type: data.user_type,
        })
        .select()
        .single();
      if (error) throw error;

      const permsToInsert = data.permissions
        .filter((p) => p.can_view || p.can_edit)
        .map((p) => ({
          profile_id: profile.id,
          module: p.module,
          can_view: p.can_view,
          can_edit: p.can_edit,
        }));

      if (permsToInsert.length > 0) {
        const { error: permError } = await supabase
          .from("profile_permissions")
          .insert(permsToInsert);
        if (permError) throw permError;
      }

      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-profiles"] });
      toast({ title: "Profile created", description: "Access profile has been created." });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description: string;
      user_type: string;
      permissions: Permission[];
    }) => {
      const { error } = await supabase
        .from("access_profiles")
        .update({
          name: data.name,
          description: data.description || null,
          user_type: data.user_type,
        })
        .eq("id", data.id);
      if (error) throw error;

      // Delete existing permissions and re-insert
      const { error: delError } = await supabase
        .from("profile_permissions")
        .delete()
        .eq("profile_id", data.id);
      if (delError) throw delError;

      const permsToInsert = data.permissions
        .filter((p) => p.can_view || p.can_edit)
        .map((p) => ({
          profile_id: data.id,
          module: p.module,
          can_view: p.can_view,
          can_edit: p.can_edit,
        }));

      if (permsToInsert.length > 0) {
        const { error: permError } = await supabase
          .from("profile_permissions")
          .insert(permsToInsert);
        if (permError) throw permError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-profiles"] });
      toast({ title: "Profile updated", description: "Access profile has been updated." });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("access_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-profiles"] });
      toast({ title: "Profile deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", user_type: "internal" });
    setPermissions(MODULES.map((m) => ({ module: m.key, can_view: false, can_edit: false })));
    setEditingProfile(null);
    setIsDialogOpen(false);
  };

  const handleEdit = async (profile: AccessProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || "",
      user_type: profile.user_type,
    });

    // Fetch permissions for this profile
    const { data: perms } = await supabase
      .from("profile_permissions")
      .select("*")
      .eq("profile_id", profile.id);

    const permMap = new Map(perms?.map((p) => [p.module, p]) || []);
    setPermissions(
      MODULES.map((m) => ({
        module: m.key,
        can_view: permMap.get(m.key)?.can_view || false,
        can_edit: permMap.get(m.key)?.can_edit || false,
      }))
    );
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, ...formData, permissions });
    } else {
      createMutation.mutate({ ...formData, permissions });
    }
  };

  const togglePermission = (module: string, field: "can_view" | "can_edit") => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.module !== module) return p;
        const updated = { ...p, [field]: !p[field] };
        // If can_edit is true, can_view must be true
        if (field === "can_edit" && updated.can_edit) updated.can_view = true;
        // If can_view is false, can_edit must be false
        if (field === "can_view" && !updated.can_view) updated.can_edit = false;
        return updated;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Access Profiles</h2>
              <p className="text-sm text-muted-foreground">
                Define access profiles with per-module view/edit permissions
              </p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Profile
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? "Edit Access Profile" : "New Access Profile"}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile_name">Name</Label>
                  <Input
                    id="profile_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_type">User Type</Label>
                  <Select
                    value={formData.user_type}
                    onValueChange={(value) => setFormData({ ...formData, user_type: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="internal">Internal (Bioflex)</SelectItem>
                      <SelectItem value="external">External (Client)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile_desc">Description</Label>
                <Textarea
                  id="profile_desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Permissions Grid */}
              <div className="space-y-3">
                <Label>Module Permissions</Label>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead className="text-center w-24">View</TableHead>
                        <TableHead className="text-center w-24">Edit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULES.map((mod) => {
                        const perm = permissions.find((p) => p.module === mod.key)!;
                        return (
                          <TableRow key={mod.key}>
                            <TableCell className="font-medium">{mod.label}</TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={perm.can_view}
                                onCheckedChange={() => togglePermission(mod.key, "can_view")}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={perm.can_edit}
                                onCheckedChange={() => togglePermission(mod.key, "can_edit")}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProfile ? "Save Changes" : "Create Profile"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Profiles Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : profiles && profiles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell>
                    <Badge variant={profile.user_type === "internal" ? "default" : "secondary"}>
                      {profile.user_type === "internal" ? "Internal" : "External"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {profile.description || "—"}
                  </TableCell>
                  <TableCell>
                    {profile.is_default && (
                      <Badge variant="outline" className="text-xs">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={profile.is_active}
                      onCheckedChange={() => {
                        supabase
                          .from("access_profiles")
                          .update({ is_active: !profile.is_active })
                          .eq("id", profile.id)
                          .then(() => {
                            queryClient.invalidateQueries({ queryKey: ["access-profiles"] });
                          });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!profile.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(profile.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No access profiles created yet.
          </div>
        )}
      </div>
    </div>
  );
}

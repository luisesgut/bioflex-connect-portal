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
import { Plus, Pencil, Search } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  user_type: string | null;
  access_profile_id: string | null;
  created_at: string;
  access_profile?: { id: string; name: string } | null;
}

interface AccessProfile {
  id: string;
  name: string;
  user_type: string;
}

interface UsersTableProps {
  userType: "internal" | "external";
}

export function UsersTable({ userType }: UsersTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    access_profile_id: "",
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", userType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, access_profile:access_profiles(id, name)")
        .eq("user_type", userType)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const { data: accessProfiles } = useQuery({
    queryKey: ["access-profiles", userType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_profiles")
        .select("id, name, user_type")
        .eq("user_type", userType)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as AccessProfile[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User updated", description: "User profile has been updated." });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ full_name: "", email: "", phone: "", company: "", access_profile_id: "" });
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      company: user.company || "",
      access_profile_id: user.access_profile_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateMutation.mutate({
      id: editingUser.id,
      data: {
        full_name: formData.full_name,
        phone: formData.phone || null,
        company: formData.company || null,
        access_profile_id: formData.access_profile_id || null,
      },
    });
  };

  const filteredUsers = users?.filter((user) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.company?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            {userType === "internal" ? "Internal Users (Bioflex)" : "External Users (Clients)"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {userType === "internal"
              ? "Manage internal team members and their access profiles"
              : "Manage client users and their access profiles"}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user_full_name">Full Name</Label>
              <Input
                id="user_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_email">Email</Label>
              <Input id="user_email" value={formData.email} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user_phone">Phone</Label>
                <Input
                  id="user_phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_company">Company</Label>
                <Input
                  id="user_company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_profile">Access Profile</Label>
              <Select
                value={formData.access_profile_id}
                onValueChange={(value) => setFormData({ ...formData, access_profile_id: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a profile..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {accessProfiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredUsers && filteredUsers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              {userType === "external" && <TableHead>Company</TableHead>}
              <TableHead>Phone</TableHead>
              <TableHead>Access Profile</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                <TableCell>{user.email || "—"}</TableCell>
                {userType === "external" && (
                  <TableCell>{user.company || "—"}</TableCell>
                )}
                <TableCell>{user.phone || "—"}</TableCell>
                <TableCell>
                  {user.access_profile ? (
                    <Badge variant="secondary">{user.access_profile.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">No profile</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "No users match your search." : "No users found."}
        </div>
      )}
    </div>
  );
}

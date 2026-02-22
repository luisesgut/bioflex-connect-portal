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
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Search, Send, Trash2, CheckCircle, Clock, UserPlus } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  user_type: string | null;
  access_profile_id: string | null;
  invitation_status: string;
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
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_prefix: "+1",
    phone_number: "",
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
      return data as unknown as UserProfile[];
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
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from("profiles").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Usuario actualizado", description: "El perfil ha sido actualizado." });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      full_name: string;
      phone: string;
      company: string;
      user_type: string;
      access_profile_id: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke("invite-user", {
        body: { action: "create", ...data },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido dado de alta. Puedes enviarle la invitación cuando lo desees.",
      });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error al crear usuario", description: error.message, variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { data: result, error } = await supabase.functions.invoke("invite-user", {
        body: { action: "invite", user_id },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Invitación enviada",
        description: "El usuario recibirá un correo para configurar su cuenta.",
      });
    },
    onError: (error) => {
      toast({ title: "Error al enviar invitación", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { data: result, error } = await supabase.functions.invoke("invite-user", {
        body: { action: "delete", user_id },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario y toda su información han sido eliminados.",
      });
      setDeletingUser(null);
    },
    onError: (error) => {
      toast({ title: "Error al eliminar usuario", description: error.message, variant: "destructive" });
      setDeletingUser(null);
    },
  });

  const resetForm = () => {
    setFormData({ full_name: "", email: "", phone_prefix: "+1", phone_number: "", company: "", access_profile_id: "" });
    setEditingUser(null);
    setIsCreating(false);
    setIsDialogOpen(false);
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setIsCreating(false);
    const phone = user.phone || "";
    const prefixMatch = phone.match(/^(\+\d{1,3})\s?(.*)$/);
    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
      phone_prefix: prefixMatch ? prefixMatch[1] : "+1",
      phone_number: prefixMatch ? prefixMatch[2] : phone,
      company: user.company || "",
      access_profile_id: user.access_profile_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setIsCreating(true);
    setFormData({ full_name: "", email: "", phone_prefix: "+1", phone_number: "", company: "", access_profile_id: "" });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = formData.phone_number ? `${formData.phone_prefix} ${formData.phone_number}` : "";
    if (isCreating) {
      createMutation.mutate({
        email: formData.email,
        full_name: formData.full_name,
        phone: fullPhone,
        company: formData.company,
        user_type: userType,
        access_profile_id: formData.access_profile_id,
      });
    } else if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          full_name: formData.full_name,
          phone: fullPhone || null,
          company: formData.company || null,
          access_profile_id: formData.access_profile_id || null,
        },
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white gap-1">
            <CheckCircle className="h-3 w-3" />
            Verificado
          </Badge>
        );
      case "invited":
        return (
          <Badge variant="secondary" className="gap-1">
            <Send className="h-3 w-3" />
            Invitado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Sin verificar
          </Badge>
        );
    }
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
            {userType === "internal" ? "Usuarios Internos (Bioflex)" : "Usuarios Externos (Clientes)"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {userType === "internal"
              ? "Administra los miembros internos del equipo y sus perfiles de acceso"
              : "Administra los usuarios cliente y sus perfiles de acceso"}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dar de Alta
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, correo o empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Dar de Alta Usuario" : "Editar Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-4">
            <form onSubmit={handleSubmit} className="space-y-4 pb-2">
              <div className="space-y-2">
                <Label htmlFor="user_full_name">Nombre Completo</Label>
                <Input
                  id="user_full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_email">Correo Electrónico</Label>
                <Input
                  id="user_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isCreating}
                  className={!isCreating ? "opacity-60" : ""}
                  required
                />
                {!isCreating && (
                  <p className="text-xs text-muted-foreground">El correo no se puede cambiar aquí</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_phone">Teléfono</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.phone_prefix}
                    onValueChange={(value) => setFormData({ ...formData, phone_prefix: value })}
                  >
                    <SelectTrigger className="w-[120px] bg-background">
                      <SelectValue placeholder="+1" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="+1">🇺🇸 +1</SelectItem>
                      <SelectItem value="+52">🇲🇽 +52</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="user_phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Número de teléfono"
                    value={formData.phone_number}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setFormData({ ...formData, phone_number: val });
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_profile">Perfil de Acceso</Label>
                <Select
                  value={formData.access_profile_id}
                  onValueChange={(value) => setFormData({ ...formData, access_profile_id: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecciona un perfil..." />
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
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {isCreating ? (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Dar de Alta
                    </>
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de eliminar a <strong>{deletingUser?.full_name}</strong> ({deletingUser?.email}).
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Esta acción es irreversible. Toda la información ligada a esta cuenta será desvinculada o eliminada, incluyendo:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Perfil y datos personales</li>
                <li>Órdenes de compra asociadas</li>
                <li>Comentarios y solicitudes de cambio</li>
                <li>Solicitudes de producto</li>
                <li>Historial de actividad</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Si deseas conservar la información, desvincula los registros antes de proceder con la eliminación.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.user_id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar Usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filteredUsers && filteredUsers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Perfil de Acceso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                <TableCell>{user.email || "—"}</TableCell>
                <TableCell>{user.phone || "—"}</TableCell>
                <TableCell>
                  {user.access_profile ? (
                    <Badge variant="secondary">{user.access_profile.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin perfil</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(user.invitation_status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {user.invitation_status !== "verified" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => inviteMutation.mutate(user.user_id)}
                        disabled={inviteMutation.isPending}
                        title="Enviar invitación"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingUser(user)}
                      title="Eliminar"
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
          {searchQuery ? "No se encontraron usuarios." : "No hay usuarios registrados."}
        </div>
      )}
    </div>
  );
}

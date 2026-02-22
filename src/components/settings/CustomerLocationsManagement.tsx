import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Pencil } from "lucide-react";

interface CustomerLocation {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  reception_hours: string | null;
  warehouse_manager_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface DPContact {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

type WeekSchedule = Record<string, DaySchedule>;

const DEFAULT_SCHEDULE: WeekSchedule = {
  mon: { enabled: true, open: "09:00", close: "17:00" },
  tue: { enabled: true, open: "09:00", close: "17:00" },
  wed: { enabled: true, open: "09:00", close: "17:00" },
  thu: { enabled: true, open: "09:00", close: "17:00" },
  fri: { enabled: true, open: "09:00", close: "17:00" },
  sat: { enabled: true, open: "09:00", close: "12:00" },
  sun: { enabled: false, open: "09:00", close: "17:00" },
};

function scheduleToString(schedule: WeekSchedule): string {
  return JSON.stringify(schedule);
}

function parseSchedule(raw: string | null): WeekSchedule {
  if (!raw) return { ...DEFAULT_SCHEDULE };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.mon) return parsed;
  } catch {
    // legacy free-text format – return defaults
  }
  return { ...DEFAULT_SCHEDULE };
}

function formatScheduleDisplay(raw: string | null): string {
  const schedule = parseSchedule(raw);
  const groups: { days: string[]; time: string }[] = [];

  for (const d of DAYS) {
    const s = schedule[d.key];
    if (!s?.enabled) continue;
    const time = `${s.open}–${s.close}`;
    const last = groups[groups.length - 1];
    if (last && last.time === time) {
      last.days.push(d.label);
    } else {
      groups.push({ days: [d.label], time });
    }
  }

  if (groups.length === 0) return "Closed";
  return groups
    .map((g) => {
      const dayStr =
        g.days.length > 2
          ? `${g.days[0]}-${g.days[g.days.length - 1]}`
          : g.days.join(", ");
      return `${dayStr} ${g.time}`;
    })
    .join(" · ");
}

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  schedule: WeekSchedule;
  warehouse_manager_id: string;
}

const emptyForm: LocationFormData = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  schedule: { ...DEFAULT_SCHEDULE },
  warehouse_manager_id: "",
};

export function CustomerLocationsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerLocation | null>(null);
  const [formData, setFormData] = useState<LocationFormData>(emptyForm);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["customer-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as CustomerLocation[];
    },
  });

  const { data: externalUsers } = useQuery({
    queryKey: ["external-users-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email")
        .eq("user_type", "external")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from("customer_locations").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-locations"] });
      toast({ title: "Location updated", description: "Customer location has been updated successfully." });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingLocation(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    updateMutation.mutate({
      id: editingLocation.id,
      data: {
        name: formData.name,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        reception_hours: scheduleToString(formData.schedule),
        warehouse_manager_id: formData.warehouse_manager_id || null,
      },
    });
  };

  const handleEdit = (location: CustomerLocation) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address || "",
      city: location.city || "",
      state: location.state || "",
      zip_code: location.zip_code || "",
      schedule: parseSchedule(location.reception_hours),
      warehouse_manager_id: location.warehouse_manager_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (location: CustomerLocation) => {
    updateMutation.mutate({ id: location.id, data: { is_active: !location.is_active } });
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId || !dpContacts) return "-";
    const contact = dpContacts.find((c) => c.id === managerId);
    return contact ? contact.full_name : "-";
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Customer Locations</h2>
            <p className="text-sm text-muted-foreground">Manage destination addresses, reception hours and warehouse managers</p>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Location: {editingLocation?.code?.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loc_name">Display Name</Label>
                <Input
                  id="loc_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc_address">Address</Label>
                <Input
                  id="loc_address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="loc_city">City</Label>
                  <Input
                    id="loc_city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc_state">State</Label>
                  <Input
                    id="loc_state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc_zip">ZIP</Label>
                  <Input
                    id="loc_zip"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Warehouse Manager</Label>
                <Select
                  value={formData.warehouse_manager_id}
                  onValueChange={(val) => setFormData({ ...formData, warehouse_manager_id: val === "__none__" ? "" : val })}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-[200]">
                    <SelectItem value="__none__">None</SelectItem>
                    {dpContacts?.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.full_name} ({contact.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right column – Schedule */}
            <div className="space-y-2">
              <Label>Reception Hours</Label>
              <div className="space-y-1.5 rounded-md border p-3">
                {DAYS.map((d) => {
                  const day = formData.schedule[d.key];
                  return (
                    <div key={d.key} className="flex items-center gap-2">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            schedule: { ...prev.schedule, [d.key]: { ...day, enabled: checked } },
                          }))
                        }
                        className="scale-75"
                      />
                      <span className="w-8 text-xs font-medium text-muted-foreground">{d.label}</span>
                      {day.enabled ? (
                        <>
                          <Input
                            type="time"
                            value={day.open}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                schedule: { ...prev.schedule, [d.key]: { ...day, open: e.target.value } },
                              }))
                            }
                            className="h-7 w-[100px] text-xs"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={day.close}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                schedule: { ...prev.schedule, [d.key]: { ...day, close: e.target.value } },
                              }))
                            }
                            className="h-7 w-[100px] text-xs"
                          />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : locations && locations.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Reception Hours</TableHead>
                <TableHead>Warehouse Manager</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium uppercase">{location.code}</TableCell>
                  <TableCell>{location.name}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="text-sm">
                      {location.address && <div>{location.address}</div>}
                      {(location.city || location.state || location.zip_code) && (
                        <div className="text-muted-foreground">
                          {[location.city, location.state, location.zip_code].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {!location.address && !location.city && "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatScheduleDisplay(location.reception_hours)}</TableCell>
                  <TableCell className="text-sm">{getManagerName(location.warehouse_manager_id)}</TableCell>
                  <TableCell>
                    <Switch checked={location.is_active} onCheckedChange={() => handleToggleActive(location)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(location)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No customer locations configured.</div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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

interface AddDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (code: string) => void;
}

export function AddDestinationDialog({ open, onOpenChange, onCreated }: AddDestinationDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    schedule: { ...DEFAULT_SCHEDULE } as WeekSchedule,
    warehouse_manager_id: "",
  });

  const { data: dpContacts } = useQuery({
    queryKey: ["dp-contacts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dp_contacts")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      schedule: { ...DEFAULT_SCHEDULE },
      warehouse_manager_id: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      // Generate a code from the name (lowercase, no spaces)
      const code = formData.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

      const { error } = await supabase.from("customer_locations").insert({
        code: code as any,
        name: formData.name.trim(),
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        reception_hours: JSON.stringify(formData.schedule),
        warehouse_manager_id: formData.warehouse_manager_id || null,
      });

      if (error) throw error;

      toast.success("Destination created successfully");
      queryClient.invalidateQueries({ queryKey: ["customer-locations"] });
      resetForm();
      onOpenChange(false);
      onCreated?.(code);
    } catch (error: any) {
      console.error("Error creating destination:", error);
      toast.error(error.message || "Failed to create destination");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add New Destination</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_loc_name">Display Name <span className="text-destructive">*</span></Label>
              <Input
                id="new_loc_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Phoenix"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_loc_address">Address</Label>
              <Input
                id="new_loc_address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new_loc_city">City</Label>
                <Input
                  id="new_loc_city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_loc_state">State</Label>
                <Input
                  id="new_loc_state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_loc_zip">ZIP</Label>
                <Input
                  id="new_loc_zip"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create Destination"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

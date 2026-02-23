import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { List, Plus, Trash2 } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const CATEGORIES = [
  { key: "final_customer", label: "Final Customer" },
  { key: "item_type", label: "Item Type" },
  { key: "tipo_empaque", label: "Tipo Empaque" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

interface DropdownOption {
  id: string;
  category: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

interface CapacityRecord {
  id: string;
  item_type: string;
  weekly_capacity: number;
}

export function DropdownOptionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLabels, setNewLabels] = useState<Record<Category, string>>({
    final_customer: "",
    item_type: "",
    tipo_empaque: "",
  });
  const [capacityEdits, setCapacityEdits] = useState<Record<string, number>>({});

  const { data: options, isLoading } = useQuery({
    queryKey: ["dropdown-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dropdown_options")
        .select("*")
        .order("sort_order")
        .order("label");
      if (error) throw error;
      return data as DropdownOption[];
    },
  });

  const { data: capacities } = useQuery({
    queryKey: ["production-capacity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_capacity")
        .select("*");
      if (error) throw error;
      return data as CapacityRecord[];
    },
  });

  // Build a map of item_type -> weekly_capacity
  const capacityMap: Record<string, number> = {};
  (capacities || []).forEach((c) => {
    capacityMap[c.item_type] = c.weekly_capacity;
  });

  const getCapacityValue = (label: string): number => {
    if (label in capacityEdits) return capacityEdits[label];
    return capacityMap[label] ?? 0;
  };

  const handleCapacityChange = (label: string, value: number) => {
    setCapacityEdits((prev) => ({ ...prev, [label]: value }));
  };

  const saveCapacity = async (label: string) => {
    const value = getCapacityValue(label);
    const existing = (capacities || []).find((c) => c.item_type === label);
    if (existing) {
      const { error } = await supabase
        .from("production_capacity")
        .update({ weekly_capacity: value })
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Error saving capacity", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("production_capacity")
        .upsert({ item_type: label, weekly_capacity: value }, { onConflict: "item_type" });
      if (error) {
        toast({ title: "Error saving capacity", variant: "destructive" });
        return;
      }
    }
    setCapacityEdits((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ["production-capacity"] });
    toast({ title: "Capacity saved" });
  };

  const addMutation = useMutation({
    mutationFn: async ({ category, label }: { category: string; label: string }) => {
      const { error } = await supabase.from("dropdown_options").insert({ category, label });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dropdown-options"] });
      toast({ title: "Option added" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("dropdown_options").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dropdown-options"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.from("dropdown_options").delete().eq("id", id);
      if (error) throw error;
      // Also delete capacity for this item type if exists
      await supabase.from("production_capacity").delete().eq("item_type", label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dropdown-options"] });
      queryClient.invalidateQueries({ queryKey: ["production-capacity"] });
      toast({ title: "Option deleted" });
    },
  });

  const handleAdd = (category: Category) => {
    const label = newLabels[category].trim();
    if (!label) return;
    addMutation.mutate({ category, label });
    setNewLabels((prev) => ({ ...prev, [category]: "" }));
  };

  const getOptionsForCategory = (category: string) =>
    (options || []).filter((o) => o.category === category);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <List className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Product Dropdown Options</h2>
          <p className="text-sm text-muted-foreground">
            Manage options for Final Customer, Item Type (with weekly capacity), and Tipo Empaque
          </p>
        </div>
      </div>

      <Tabs defaultValue="final_customer">
        <TabsList className="w-full">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="flex-1">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.key} value={cat.key} className="mt-4 space-y-4">
            {/* Add new */}
            <div className="flex gap-2">
              <Input
                placeholder={`New ${cat.label}...`}
                value={newLabels[cat.key]}
                onChange={(e) =>
                  setNewLabels((prev) => ({ ...prev, [cat.key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd(cat.key);
                }}
              />
              <Button
                size="sm"
                onClick={() => handleAdd(cat.key)}
                disabled={!newLabels[cat.key].trim() || addMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* List */}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : getOptionsForCategory(cat.key).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No options yet. Add one above.
              </p>
            ) : (
              <div className="space-y-2">
                {getOptionsForCategory(cat.key).map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 gap-3"
                  >
                    <span
                      className={`text-sm flex-shrink-0 ${
                        opt.is_active ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {opt.label}
                    </span>

                    {/* Weekly Capacity inline for item_type */}
                    {cat.key === "item_type" && (
                      <div className="flex items-center gap-2 flex-1 justify-end mr-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Capacity/wk</Label>
                        <Input
                          type="number"
                          className="w-32 h-8 text-sm"
                          value={getCapacityValue(opt.label) || ""}
                          onChange={(e) =>
                            handleCapacityChange(opt.label, parseInt(e.target.value) || 0)
                          }
                          onBlur={() => {
                            if (opt.label in capacityEdits) {
                              saveCapacity(opt.label);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveCapacity(opt.label);
                          }}
                          placeholder="0"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">Active</Label>
                        <Switch
                          checked={opt.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: opt.id, is_active: checked })
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: opt.id, label: opt.label })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

import { useState } from "react";
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

export function DropdownOptionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLabels, setNewLabels] = useState<Record<Category, string>>({
    final_customer: "",
    item_type: "",
    tipo_empaque: "",
  });

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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dropdown_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dropdown-options"] });
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
            Manage options for Final Customer, Item Type, and Tipo Empaque
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
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span
                      className={`text-sm ${
                        opt.is_active ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <div className="flex items-center gap-3">
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
                        onClick={() => deleteMutation.mutate(opt.id)}
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

import { useState, useEffect } from 'react';
import { Settings2, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CapacityRow {
  id?: string;
  item_type: string;
  weekly_capacity: number;
  isNew?: boolean;
}

export function ProductionCapacityManagement() {
  const [rows, setRows] = useState<CapacityRow[]>([]);
  const [itemTypeOptions, setItemTypeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCapacity(), fetchItemTypes()]).then(() => setLoading(false));
  }, []);

  const fetchCapacity = async () => {
    const { data, error } = await supabase
      .from('production_capacity')
      .select('*')
      .order('item_type');

    if (error) {
      console.error('Error fetching capacity:', error);
    } else {
      setRows(data || []);
    }
  };

  const fetchItemTypes = async () => {
    const { data, error } = await supabase
      .from('dropdown_options')
      .select('label')
      .eq('category', 'item_type')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching item types:', error);
    } else {
      setItemTypeOptions((data || []).map(d => d.label));
    }
  };

  const addRow = () => {
    setRows(prev => [...prev, { item_type: '', weekly_capacity: 0, isNew: true }]);
  };

  const removeRow = async (index: number) => {
    const row = rows[index];
    if (row.id) {
      const { error } = await supabase
        .from('production_capacity')
        .delete()
        .eq('id', row.id);
      if (error) {
        toast.error('Error deleting capacity');
        return;
      }
    }
    setRows(prev => prev.filter((_, i) => i !== index));
    toast.success('Capacity removed');
  };

  const updateRow = (index: number, field: keyof CapacityRow, value: string | number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        if (!row.item_type.trim()) continue;
        if (row.id) {
          await supabase
            .from('production_capacity')
            .update({ item_type: row.item_type, weekly_capacity: row.weekly_capacity })
            .eq('id', row.id);
        } else {
          await supabase
            .from('production_capacity')
            .upsert({ item_type: row.item_type, weekly_capacity: row.weekly_capacity }, { onConflict: 'item_type' });
        }
      }
      toast.success('Capacities saved');
      await fetchCapacity();
    } catch (err) {
      toast.error('Error saving capacities');
    }
    setSaving(false);
  };

  // Filter out item types already used in other rows
  const getAvailableOptions = (currentIndex: number) => {
    const usedTypes = rows
      .filter((_, i) => i !== currentIndex)
      .map(r => r.item_type);
    return itemTypeOptions.filter(opt => !usedTypes.includes(opt));
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <p className="text-muted-foreground">Loading capacities...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Weekly Production Capacity</h2>
          <p className="text-sm text-muted-foreground">Define weekly capacity (pieces) per product family</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id || `new-${index}`} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Family (Item Type)</Label>
              <Select
                value={row.item_type}
                onValueChange={(val) => updateRow(index, 'item_type', val)}
              >
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {getAvailableOptions(index).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                  {/* Keep current value visible even if not in available options */}
                  {row.item_type && !itemTypeOptions.includes(row.item_type) && (
                    <SelectItem value={row.item_type}>{row.item_type}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48 space-y-1">
              <Label className="text-xs text-muted-foreground">Weekly Capacity (pcs)</Label>
              <Input
                type="number"
                value={row.weekly_capacity || ''}
                onChange={e => updateRow(index, 'weekly_capacity', parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeRow(index)} className="text-destructive hover:text-destructive shrink-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
          <Plus className="h-4 w-4" /> Add Family
        </Button>
        <Button variant="accent" size="sm" onClick={saveAll} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>
    </div>
  );
}

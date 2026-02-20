import { useState, useEffect } from 'react';
import { Settings2, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCapacity();
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
    setLoading(false);
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
        toast.error('Error al eliminar');
        return;
      }
    }
    setRows(prev => prev.filter((_, i) => i !== index));
    toast.success('Capacidad eliminada');
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
      toast.success('Capacidades guardadas');
      await fetchCapacity();
    } catch (err) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <p className="text-muted-foreground">Cargando capacidades...</p>
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
          <h2 className="text-lg font-semibold text-card-foreground">Capacidad de Producción Semanal</h2>
          <p className="text-sm text-muted-foreground">Define la capacidad semanal (piezas) por familia de producto</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id || `new-${index}`} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Familia (Item Type)</Label>
              <Input
                value={row.item_type}
                onChange={e => updateRow(index, 'item_type', e.target.value)}
                placeholder="Ej: Bag Wicket"
              />
            </div>
            <div className="w-48 space-y-1">
              <Label className="text-xs text-muted-foreground">Capacidad Semanal (pzas)</Label>
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
          <Plus className="h-4 w-4" /> Agregar Familia
        </Button>
        <Button variant="accent" size="sm" onClick={saveAll} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar Todo'}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChartData {
  item_type: string;
  total_quantity: number;
  weekly_capacity: number;
  weeks: number;
}

export function ProductionWeeksChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch accepted orders with product info
    const { data: orders } = await supabase
      .from('purchase_orders')
      .select('quantity, products(item_type)')
      .eq('status', 'accepted');

    // Fetch capacity config
    const { data: capacities } = await supabase
      .from('production_capacity')
      .select('item_type, weekly_capacity');

    if (!orders || !capacities) {
      setLoading(false);
      return;
    }

    // Aggregate volume by item_type
    const volumeByType: Record<string, number> = {};
    for (const order of orders) {
      const itemType = (order.products as any)?.item_type || 'No Type';
      volumeByType[itemType] = (volumeByType[itemType] || 0) + order.quantity;
    }

    // Build capacity map
    const capacityMap: Record<string, number> = {};
    for (const c of capacities) {
      capacityMap[c.item_type] = c.weekly_capacity;
    }

    // Build chart data
    const chartData: ChartData[] = Object.entries(volumeByType).map(([item_type, total_quantity]) => {
      const weekly_capacity = capacityMap[item_type] || 0;
      const weeks = weekly_capacity > 0 ? Math.ceil(total_quantity / weekly_capacity) : 0;
      return { item_type, total_quantity, weekly_capacity, weeks };
    });

    chartData.sort((a, b) => b.weeks - a.weeks);
    setData(chartData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold text-card-foreground mb-1">Production Weeks by Family</h2>
        <p className="text-sm text-muted-foreground">No active orders or capacity configured.</p>
      </div>
    );
  }

  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(var(--success))',
    'hsl(var(--warning))',
    'hsl(var(--info, 220 90% 56%))',
  ];

  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-card-foreground">Production Weeks by Family</h2>
        <p className="text-sm text-muted-foreground">Volume in system ÷ assigned weekly capacity</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis
            dataKey="item_type"
            type="category"
            width={140}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, _name: string, props: any) => {
              const item = props.payload;
              return [
                `${value} weeks (${item.total_quantity.toLocaleString()} pcs / ${item.weekly_capacity.toLocaleString()} cap/wk)`,
                'Production',
              ];
            }}
          />
          <Bar dataKey="weeks" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend table */}
      <div className="mt-4 space-y-2">
        {data.map((item) => (
          <div key={item.item_type} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item.item_type}</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">{item.total_quantity.toLocaleString()} pzas</span>
              <span className="text-muted-foreground">
                {item.weekly_capacity > 0 ? `${item.weekly_capacity.toLocaleString()}/sem` : 'Sin cap.'}
              </span>
              <span className="font-semibold text-card-foreground">
                {item.weekly_capacity > 0 ? `${item.weeks} sem` : 'N/A'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

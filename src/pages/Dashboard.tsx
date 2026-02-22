import { useEffect, useState } from 'react';
import { Package, FileText, Flame, TrendingUp, ArrowUpRight } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ProductionWeeksChart } from '@/components/dashboard/ProductionWeeksChart';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, subMonths, format } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeOrders: 0,
    hotOrders: 0,
    newThisWeek: 0,
    newLastMonthSameWeek: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const lastMonthDate = subMonths(now, 1);
    const lastMonthWeekStart = startOfWeek(lastMonthDate, { weekStartsOn: 1 });
    const lastMonthWeekEnd = endOfWeek(lastMonthDate, { weekStartsOn: 1 });

    const [activeRes, hotRes, newThisWeekRes, newLastMonthRes] = await Promise.all([
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'accepted').eq('is_hot_order', true),
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true })
        .gte('created_at', format(weekStart, 'yyyy-MM-dd'))
        .lte('created_at', format(weekEnd, 'yyyy-MM-dd\'T\'23:59:59')),
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true })
        .gte('created_at', format(lastMonthWeekStart, 'yyyy-MM-dd'))
        .lte('created_at', format(lastMonthWeekEnd, 'yyyy-MM-dd\'T\'23:59:59')),
    ]);

    setStats({
      activeOrders: activeRes.count || 0,
      hotOrders: hotRes.count || 0,
      newThisWeek: newThisWeekRes.count || 0,
      newLastMonthSameWeek: newLastMonthRes.count || 0,
    });
    setLoading(false);
  };

  const weekDiff = stats.newLastMonthSameWeek > 0
    ? Math.round(((stats.newThisWeek - stats.newLastMonthSameWeek) / stats.newLastMonthSameWeek) * 100)
    : stats.newThisWeek > 0 ? 100 : 0;

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Overview of your purchase order activity.</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <StatsCard
              title="Active Orders"
              value={loading ? '...' : stats.activeOrders}
              description="With Accepted status"
              icon={<FileText className="h-6 w-6" />}
              variant="success"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <StatsCard
              title="Hot Orders"
              value={loading ? '...' : stats.hotOrders}
              description="Priority production"
              icon={<Flame className="h-6 w-6" />}
              variant="accent"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <StatsCard
              title="New This Week"
              value={loading ? '...' : stats.newThisWeek}
              description="Orders received"
              icon={<Package className="h-6 w-6" />}
              trend={!loading && stats.newLastMonthSameWeek > 0 ? { value: Math.abs(weekDiff), isPositive: weekDiff >= 0 } : undefined}
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <StatsCard
              title="Same Week Last Month"
              value={loading ? '...' : stats.newLastMonthSameWeek}
              description="Monthly comparison"
              icon={<TrendingUp className="h-6 w-6" />}
            />
          </div>
        </div>

        {/* Production Weeks Chart */}
        <div className="animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <ProductionWeeksChart />
        </div>

        {/* Quick link */}
        <div className="flex justify-end">
          <Link to="/orders">
            <Button variant="outline" className="gap-2">
              View All Orders <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}

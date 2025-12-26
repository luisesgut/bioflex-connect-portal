import { Package, FileText, Flame, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { ProductionTimeline } from "@/components/dashboard/ProductionTimeline";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back, Acme Corp
            </h1>
            <p className="mt-1 text-muted-foreground">
              Here's what's happening with your orders today.
            </p>
          </div>
          <Link to="/orders/new">
            <Button variant="accent" size="lg" className="gap-2">
              <FileText className="h-5 w-5" />
              Create New PO
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <StatsCard
              title="Total Products"
              value="24"
              description="Active custom products"
              icon={<Package className="h-6 w-6" />}
              trend={{ value: 12, isPositive: true }}
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <StatsCard
              title="Active Orders"
              value="8"
              description="Currently in production"
              icon={<FileText className="h-6 w-6" />}
              variant="success"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <StatsCard
              title="Hot Orders"
              value="3"
              description="Priority production"
              icon={<Flame className="h-6 w-6" />}
              variant="accent"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <StatsCard
              title="On-Time Rate"
              value="98%"
              description="Last 30 days"
              icon={<TrendingUp className="h-6 w-6" />}
              trend={{ value: 3, isPositive: true }}
              variant="success"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <OrdersTable />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "0.6s" }}>
            <ProductionTimeline />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

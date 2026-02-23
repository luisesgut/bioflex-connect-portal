import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Settings,
  LogOut,
  Eye,
  EyeOff,
  Warehouse,
  Truck,
  Users,
  Globe,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/hooks/useLanguage";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminViewMode = 'all' | 'engineering' | 'design';

const navigation = [
  { nameKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { nameKey: "nav.products", href: "/products", icon: Package },
  { nameKey: "nav.purchaseOrders", href: "/orders", icon: FileText },
  { nameKey: "nav.shippingLoads", href: "/shipping-loads", icon: Truck },
];

const adminNavigation = [
  { nameKey: "nav.users", href: "/users", icon: Users },
  { nameKey: "nav.inventory", href: "/inventory", icon: Warehouse },
];

const bottomNavigation = [
  { nameKey: "nav.settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isActualAdmin, isViewingAsCustomer, toggleViewMode } = useAdmin();
  const { language, setLanguage, t } = useLanguage();

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const portalName = profile?.company || "Bioflex";

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || 'U';
  const userEmail = user?.email || 'user@example.com';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-accent">
            <Package className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{portalName}</h1>
            <p className="text-xs text-sidebar-foreground/60">{t('nav.customerPortal')}</p>
          </div>
        </div>

        {/* Admin View Toggle */}
        {isActualAdmin && (
          <div className="border-b border-sidebar-border px-4 py-3 space-y-3">
            {/* Customer/Admin Toggle */}
            <div className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
              isViewingAsCustomer ? "bg-accent/20" : "bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-2">
                {isViewingAsCustomer ? (
                  <Eye className="h-4 w-4 text-accent" />
                ) : (
                  <EyeOff className="h-4 w-4 text-sidebar-foreground/60" />
                )}
                <Label htmlFor="view-toggle" className="text-xs font-medium cursor-pointer">
                  {isViewingAsCustomer ? t('nav.customerView') : t('nav.adminView')}
                </Label>
              </div>
              <Switch
                id="view-toggle"
                checked={isViewingAsCustomer}
                onCheckedChange={toggleViewMode}
                className="scale-75"
              />
            </div>

          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.nameKey}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive && "text-sidebar-primary"
                  )} />
                  {t(item.nameKey)}
                </Link>
              );
            })}

            {/* Admin Section */}
            {isAdmin && (
              <>
                <div className="mt-4 mb-2 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {t('nav.admin')}
                  </span>
                </div>
                {adminNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.nameKey}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-accent/20 text-accent"
                          : "text-sidebar-foreground/70 hover:bg-accent/10 hover:text-accent"
                      )}
                    >
                      <item.icon className={cn(
                        "h-5 w-5",
                        isActive && "text-accent"
                      )} />
                      {t(item.nameKey)}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="border-t border-sidebar-border px-3 py-4">
          {bottomNavigation.map((item) => (
            <Link
              key={item.nameKey}
              to={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <item.icon className="h-5 w-5" />
              {t(item.nameKey)}
            </Link>
          ))}
          <button 
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-destructive/20 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            {t('nav.signOut')}
          </button>
        </div>

        {/* User Info */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold">
              {userInitials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">
                {isActualAdmin ? (isViewingAsCustomer ? t('user.viewingAsCustomer') : t('user.admin')) : t('user.customer')}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Globe className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{language === 'en' ? 'Cambiar a Español' : 'Switch to English'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </aside>
  );
}

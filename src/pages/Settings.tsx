import { useState, useEffect } from "react";
import { Building2, Bell, Shield, Globe } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/hooks/useLanguage";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownOptionsManagement } from "@/components/settings/DropdownOptionsManagement";
import { CustomerLocationsManagement } from "@/components/settings/CustomerLocationsManagement";
import { StructureLayerOptionsManagement } from "@/components/settings/StructureLayerOptionsManagement";
import { DestinyFamiliesManagement } from "@/components/settings/DestinyFamiliesManagement";
export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const { isActualAdmin } = useAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyZip, setCompanyZip] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company, company_address, company_city, company_zip")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company || "");
      setCompanyAddress(profile.company_address || "");
      setCompanyCity(profile.company_city || "");
      setCompanyZip(profile.company_zip || "");
    }
  }, [profile]);

  const handleSaveCompany = async () => {
    if (!user?.id) return;
    setSavingCompany(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        company: companyName,
        company_address: companyAddress,
        company_city: companyCity,
        company_zip: companyZip,
      })
      .eq("user_id", user.id);
    setSavingCompany(false);
    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Nombre de empresa guardado");
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
           <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('page.settings.title')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('page.settings.subtitle')}
          </p>
        </div>




        {/* Dropdown Options Management - Admin Only */}
        {isActualAdmin && (
          <div style={{ animationDelay: "0.14s" }}>
            <DropdownOptionsManagement />
          </div>
        )}


        {/* Customer Locations Management - Admin Only */}
        {isActualAdmin && (
          <div style={{ animationDelay: "0.16s" }}>
            <CustomerLocationsManagement />
          </div>
        )}

        {/* Structure Layer Options Management - Admin Only */}
        {isActualAdmin && (
          <div style={{ animationDelay: "0.18s" }}>
            <StructureLayerOptionsManagement />
          </div>
        )}

        {/* Destiny Families - Admin Only */}
        {isActualAdmin && (
          <div style={{ animationDelay: "0.19s" }}>
            <DestinyFamiliesManagement />
          </div>
        )}


        {/* Company Section */}
        <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Company Details</h2>
              <p className="text-sm text-muted-foreground">Your organization information</p>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company">Company Name</Label>
              <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input id="zip" value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button variant="accent" onClick={handleSaveCompany} disabled={savingCompany}>
              {savingCompany ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Notifications</h2>
              <p className="text-sm text-muted-foreground">Manage your notification preferences</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Order Updates</p>
                <p className="text-sm text-muted-foreground">Get notified when order status changes</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Production Alerts</p>
                <p className="text-sm text-muted-foreground">Receive alerts for production milestones</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Shipping Notifications</p>
                <p className="text-sm text-muted-foreground">Track shipments and delivery updates</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Marketing Emails</p>
                <p className="text-sm text-muted-foreground">Receive news and product updates</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="rounded-xl border bg-card p-6 shadow-card animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Security</h2>
              <p className="text-sm text-muted-foreground">Manage your account security</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Enable Two-Factor Authentication
            </Button>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
              Sign Out of All Devices
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

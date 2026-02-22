import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/users/UsersTable";
import { AccessProfilesManager } from "@/components/users/AccessProfilesManager";
import { Users as UsersIcon, Shield } from "lucide-react";

export default function Users() {
  const [activeTab, setActiveTab] = useState("internal");

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage platform users and access profiles
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="internal" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Internal (Bioflex)
            </TabsTrigger>
            <TabsTrigger value="external" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              External (Client)
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Access Profiles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="mt-6">
            <UsersTable userType="internal" />
          </TabsContent>

          <TabsContent value="external" className="mt-6">
            <UsersTable userType="external" />
          </TabsContent>

          <TabsContent value="profiles" className="mt-6">
            <AccessProfilesManager />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

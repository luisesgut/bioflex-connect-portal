import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface ModulePermissions {
  can_view: boolean;
  can_edit: boolean;
}

interface PermissionsMap {
  [module: string]: ModulePermissions;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions({});
        setLoading(false);
        return;
      }

      // Get the user's access_profile_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("access_profile_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.access_profile_id) {
        setPermissions({});
        setLoading(false);
        return;
      }

      // Get permissions for that profile
      const { data: perms } = await supabase
        .from("profile_permissions")
        .select("module, can_view, can_edit")
        .eq("profile_id", profile.access_profile_id);

      const map: PermissionsMap = {};
      if (perms) {
        for (const p of perms) {
          map[p.module] = {
            can_view: p.can_view ?? false,
            can_edit: p.can_edit ?? false,
          };
        }
      }

      setPermissions(map);
      setLoading(false);
    };

    fetchPermissions();
  }, [user]);

  const canView = (module: string) => permissions[module]?.can_view ?? false;
  const canEdit = (module: string) => permissions[module]?.can_edit ?? false;

  return { permissions, loading, canView, canEdit };
}

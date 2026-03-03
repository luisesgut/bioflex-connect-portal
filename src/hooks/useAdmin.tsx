import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AdminContextType {
  isAdmin: boolean;
  isActualAdmin: boolean;
  isInternalUser: boolean;
  loading: boolean;
  isViewingAsCustomer: boolean;
  toggleViewMode: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isActualAdmin, setIsActualAdmin] = useState(false);
  const [isInternalUser, setIsInternalUser] = useState(false);
  const [isViewingAsCustomer, setIsViewingAsCustomer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserRoles = async () => {
      if (!user) {
        setIsActualAdmin(false);
        setIsInternalUser(false);
        setLoading(false);
        return;
      }

      // Check admin role and internal user type in parallel
      const [adminResult, profileResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('user_type')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (adminResult.error) {
        console.error('Error checking admin role:', adminResult.error);
        setIsActualAdmin(false);
      } else {
        setIsActualAdmin(!!adminResult.data);
      }

      setIsInternalUser(profileResult.data?.user_type === 'internal');
      setLoading(false);
    };

    checkUserRoles();
  }, [user]);

  // Reset view mode when user changes
  useEffect(() => {
    setIsViewingAsCustomer(false);
  }, [user?.id]);

  const toggleViewMode = () => {
    setIsViewingAsCustomer((prev) => !prev);
  };

  // isAdmin is false when viewing as customer (even if actual admin)
  const isAdmin = isActualAdmin && !isViewingAsCustomer;

  return (
    <AdminContext.Provider value={{ isAdmin, isActualAdmin, isInternalUser, loading, isViewingAsCustomer, toggleViewMode }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}

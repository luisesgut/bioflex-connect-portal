import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AdminContextType {
  isAdmin: boolean;
  isActualAdmin: boolean;
  loading: boolean;
  isViewingAsCustomer: boolean;
  toggleViewMode: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isActualAdmin, setIsActualAdmin] = useState(false);
  const [isViewingAsCustomer, setIsViewingAsCustomer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsActualAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        setIsActualAdmin(false);
      } else {
        setIsActualAdmin(!!data);
      }
      setLoading(false);
    };

    checkAdminRole();
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
    <AdminContext.Provider value={{ isAdmin, isActualAdmin, loading, isViewingAsCustomer, toggleViewMode }}>
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

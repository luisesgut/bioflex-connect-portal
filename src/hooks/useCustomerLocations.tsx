import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerLocation {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  reception_hours: string | null;
  warehouse_manager_id: string | null;
  is_active: boolean;
}

export function useCustomerLocations() {
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["customer-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CustomerLocation[];
    },
  });

  const destinationOptions = locations.map((loc) => ({
    value: loc.code,
    label: loc.city && loc.state
      ? `${loc.name}, ${loc.state}`
      : loc.name,
  }));

  const getDestinationLabel = (code: string | null): string => {
    if (!code) return "TBD";
    const loc = locations.find((l) => l.code === code);
    if (loc) {
      return loc.city && loc.state ? `${loc.name}, ${loc.state}` : loc.name;
    }
    return code;
  };

  return {
    locations,
    destinationOptions,
    getDestinationLabel,
    isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["customer-locations"] }),
  };
}

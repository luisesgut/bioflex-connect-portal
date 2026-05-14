import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toISODate } from "@/utils/destinyWeek";

export interface DestinyFamily {
  id: string;
  name: string;
  default_weekly_capacity: number;
  item_type_mapping: string[];
  sort_order: number;
  is_active: boolean;
}

export interface WeeklyCapacityRow {
  id: string;
  family_id: string;
  week_start: string;
  weekly_capacity: number;
  notes: string | null;
}

export interface WeekStatusRow {
  id: string;
  week_start: string;
  is_frozen: boolean;
  frozen_at: string | null;
  frozen_by: string | null;
  notes: string | null;
}

export interface AssignmentRow {
  id: string;
  family_id: string;
  purchase_order_id: string;
  week_start: string;
  assigned_quantity: number;
  notes: string | null;
  created_at: string;
}

export interface POForPlan {
  id: string;
  po_number: string;
  user_id: string;
  product_id: string | null;
  quantity: number;
  status: string;
  requested_delivery_date: string | null;
  is_hot_order: boolean;
}

export const useDestinyFamilies = () =>
  useQuery({
    queryKey: ["destiny-families"],
    queryFn: async (): Promise<DestinyFamily[]> => {
      const { data, error } = await supabase
        .from("destiny_families")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as DestinyFamily[];
    },
  });

export const useDestinyWeeks = (weekStarts: Date[]) => {
  const isoStarts = weekStarts.map(toISODate);
  const key = isoStarts.join(",");

  const capacities = useQuery({
    queryKey: ["destiny-weekly-capacity", key],
    queryFn: async (): Promise<WeeklyCapacityRow[]> => {
      const { data, error } = await supabase
        .from("destiny_weekly_capacity")
        .select("*")
        .in("week_start", isoStarts);
      if (error) throw error;
      return (data ?? []) as WeeklyCapacityRow[];
    },
  });

  const statuses = useQuery({
    queryKey: ["destiny-week-status", key],
    queryFn: async (): Promise<WeekStatusRow[]> => {
      const { data, error } = await supabase
        .from("destiny_week_status")
        .select("*")
        .in("week_start", isoStarts);
      if (error) throw error;
      return (data ?? []) as WeekStatusRow[];
    },
  });

  const assignments = useQuery({
    queryKey: ["destiny-assignments", key],
    queryFn: async (): Promise<AssignmentRow[]> => {
      const { data, error } = await supabase
        .from("destiny_weekly_assignments")
        .select("*")
        .in("week_start", isoStarts);
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

  return { capacities, statuses, assignments };
};

export const useAllDestinyAssignments = () =>
  useQuery({
    queryKey: ["destiny-assignments-all"],
    queryFn: async (): Promise<AssignmentRow[]> => {
      const { data, error } = await supabase
        .from("destiny_weekly_assignments")
        .select("*");
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

export const useDestinyEligiblePOs = () =>
  useQuery({
    queryKey: ["destiny-eligible-pos"],
    queryFn: async (): Promise<POForPlan[]> => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, user_id, product_id, quantity, status, requested_delivery_date, is_hot_order")
        .in("status", ["accepted", "pending"])
        .order("requested_delivery_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as POForPlan[];
    },
  });

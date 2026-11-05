import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CattleRow = {
  id: string;
  owner_id: string;
  tag: string;
  name: string;
  breed: string;
  age: number;
  gender: "Male" | "Female";
  color: string | null;
  health_status: "Healthy" | "At Risk" | "Critical";
  milk_yield: number;
  purchase_date: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
};

export type MilkRow = {
  id: string;
  cattle_id: string;
  date: string;
  morning: number;
  evening: number;
  total: number;
  notes: string | null;
};

export type HealthRow = {
  id: string;
  cattle_id: string;
  condition: string;
  treatment: string | null;
  vet_name: string | null;
  date: string;
  next_checkup: string | null;
  status: "Scheduled" | "Upcoming" | "Overdue" | "Completed";
};

export const useCattle = () =>
  useQuery({
    queryKey: ["cattle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cattle")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CattleRow[];
    },
  });

export const useUpsertCattle = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<CattleRow> & { id?: string }) => {
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase.from("cattle").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const payload = { ...input, owner_id: user!.id };
        const { error } = await supabase.from("cattle").insert(payload as unknown as CattleRow);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cattle"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
};

export const useDeleteCattle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cattle").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cattle"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
};

export const PAGE_SIZE = 50;

export const useMilkRecords = (page = 0, pageSize = PAGE_SIZE) =>
  useQuery({
    queryKey: ["milk_records", page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from("milk_records")
        .select("*, cattle(name)", { count: "exact" })
        .order("date", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return {
        rows: data as (MilkRow & { cattle: { name: string } })[],
        total: count ?? 0,
      };
    },
  });

export const useAddMilk = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { cattle_id: string; date: string; morning: number; evening: number; notes?: string }) => {
      const { error } = await supabase.from("milk_records").upsert(
        { ...input, recorded_by: user!.id },
        { onConflict: "cattle_id,date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milk_records"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
};

export const useHealthRecords = (page = 0, pageSize = PAGE_SIZE) =>
  useQuery({
    queryKey: ["health_records", page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from("health_records")
        .select("*, cattle(name)", { count: "exact" })
        .order("date", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return {
        rows: data as (HealthRow & { cattle: { name: string } })[],
        total: count ?? 0,
      };
    },
  });

export const useAddHealth = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      cattle_id: string;
      condition: string;
      treatment?: string;
      vet_name?: string;
      date: string;
      next_checkup?: string;
      status: "Scheduled" | "Upcoming" | "Overdue" | "Completed";
    }) => {
      const { error } = await supabase
        .from("health_records")
        .insert({ ...input, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health_records"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
};

export const useReports = () =>
  useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("reports", {
        method: "GET",
      });
      if (error) throw error;
      return data as {
        summary: {
          total_cattle: number;
          healthy: number;
          at_risk: number;
          critical: number;
          active_alerts: number;
          today_milk: number;
          week_milk: number;
          month_milk: number;
          avg_per_cattle: number;
        };
        health_distribution: { name: string; value: number; color: string }[];
        breed_distribution: { breed: string; count: number }[];
        daily_milk: { date: string; total: number }[];
        alerts: AlertRow[];
      };
    },
  });

export const usePredictions = () =>
  useQuery({
    queryKey: ["breed_predictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breed_predictions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
};

export type NotificationPrefs = {
  health_alerts: boolean;
  vaccination_reminders: boolean;
  milk_reports: boolean;
};

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: {
      full_name?: string;
      farm_name?: string;
      phone?: string;
      notification_preferences?: NotificationPrefs;
    }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
};

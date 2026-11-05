export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_request_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      breed_predictions: {
        Row: {
          cattle_id: string | null
          confidence: number
          confirmed_breed: string | null
          created_at: string
          id: string
          image_url: string
          predicted_breed: string
          reasoning: string | null
          user_id: string
        }
        Insert: {
          cattle_id?: string | null
          confidence: number
          confirmed_breed?: string | null
          created_at?: string
          id?: string
          image_url: string
          predicted_breed: string
          reasoning?: string | null
          user_id: string
        }
        Update: {
          cattle_id?: string | null
          confidence?: number
          confirmed_breed?: string | null
          created_at?: string
          id?: string
          image_url?: string
          predicted_breed?: string
          reasoning?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breed_predictions_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      cattle: {
        Row: {
          age: number
          breed: string
          color: string | null
          created_at: string
          gender: Database["public"]["Enums"]["gender_t"]
          health_status: Database["public"]["Enums"]["health_t"]
          id: string
          image_url: string | null
          milk_yield: number
          name: string
          notes: string | null
          owner_id: string
          purchase_date: string | null
          tag: string
          updated_at: string
        }
        Insert: {
          age?: number
          breed: string
          color?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["gender_t"]
          health_status?: Database["public"]["Enums"]["health_t"]
          id?: string
          image_url?: string | null
          milk_yield?: number
          name: string
          notes?: string | null
          owner_id: string
          purchase_date?: string | null
          tag: string
          updated_at?: string
        }
        Update: {
          age?: number
          breed?: string
          color?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["gender_t"]
          health_status?: Database["public"]["Enums"]["health_t"]
          id?: string
          image_url?: string | null
          milk_yield?: number
          name?: string
          notes?: string | null
          owner_id?: string
          purchase_date?: string | null
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_records: {
        Row: {
          cattle_id: string
          condition: string
          created_at: string
          created_by: string
          date: string
          id: string
          next_checkup: string | null
          status: Database["public"]["Enums"]["vacc_status_t"]
          treatment: string | null
          vet_name: string | null
        }
        Insert: {
          cattle_id: string
          condition: string
          created_at?: string
          created_by: string
          date?: string
          id?: string
          next_checkup?: string | null
          status?: Database["public"]["Enums"]["vacc_status_t"]
          treatment?: string | null
          vet_name?: string | null
        }
        Update: {
          cattle_id?: string
          condition?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          next_checkup?: string | null
          status?: Database["public"]["Enums"]["vacc_status_t"]
          treatment?: string | null
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_records_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_records: {
        Row: {
          cattle_id: string
          created_at: string
          date: string
          evening: number
          id: string
          morning: number
          notes: string | null
          recorded_by: string
          total: number | null
        }
        Insert: {
          cattle_id: string
          created_at?: string
          date?: string
          evening?: number
          id?: string
          morning?: number
          notes?: string | null
          recorded_by: string
          total?: number | null
        }
        Update: {
          cattle_id?: string
          created_at?: string
          date?: string
          evening?: number
          id?: string
          morning?: number
          notes?: string | null
          recorded_by?: string
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_records_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          farm_name: string | null
          full_name: string | null
          id: string
          notification_preferences: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          farm_name?: string | null
          full_name?: string | null
          id: string
          notification_preferences?: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          farm_name?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "farmer"
      gender_t: "Male" | "Female"
      health_t: "Healthy" | "At Risk" | "Critical"
      vacc_status_t: "Scheduled" | "Upcoming" | "Overdue" | "Completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "farmer"],
      gender_t: ["Male", "Female"],
      health_t: ["Healthy", "At Risk", "Critical"],
      vacc_status_t: ["Scheduled", "Upcoming", "Overdue", "Completed"],
    },
  },
} as const

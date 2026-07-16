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
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string
          affected_farm_id: string | null
          affected_user_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          affected_farm_id?: string | null
          affected_user_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          affected_farm_id?: string | null
          affected_user_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          message: string
          metadata: Json
          read_at: string | null
          related_farm_id: string | null
          related_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message: string
          metadata?: Json
          read_at?: string | null
          related_farm_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message?: string
          metadata?: Json
          read_at?: string | null
          related_farm_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      egg_production: {
        Row: {
          created_at: string
          date: string
          extra: number
          farm_id: string
          id: string
          label: string
          r2: number
          r3: number
          r4: number
        }
        Insert: {
          created_at?: string
          date: string
          extra?: number
          farm_id: string
          id?: string
          label: string
          r2?: number
          r3?: number
          r4?: number
        }
        Update: {
          created_at?: string
          date?: string
          extra?: number
          farm_id?: string
          id?: string
          label?: string
          r2?: number
          r3?: number
          r4?: number
        }
        Relationships: [
          {
            foreignKeyName: "egg_production_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          bird_count: number | null
          bird_type: string | null
          country: string
          created_at: string
          farm_type: string | null
          id: string
          location: string | null
          name: string
          owner_id: string
          owner_name: string | null
          phone: string | null
          plan_updated_at: string
          rooms_count: number | null
          state: string | null
          status: string
          subscription_plan: string
        }
        Insert: {
          bird_count?: number | null
          bird_type?: string | null
          country?: string
          created_at?: string
          farm_type?: string | null
          id?: string
          location?: string | null
          name?: string
          owner_id: string
          owner_name?: string | null
          phone?: string | null
          plan_updated_at?: string
          rooms_count?: number | null
          state?: string | null
          status?: string
          subscription_plan?: string
        }
        Update: {
          bird_count?: number | null
          bird_type?: string | null
          country?: string
          created_at?: string
          farm_type?: string | null
          id?: string
          location?: string | null
          name?: string
          owner_id?: string
          owner_name?: string | null
          phone?: string | null
          plan_updated_at?: string
          rooms_count?: number | null
          state?: string | null
          status?: string
          subscription_plan?: string
        }
        Relationships: []
      }
      feed_usage: {
        Row: {
          bags: number
          created_at: string
          date: string
          farm_id: string
          id: string
          room: string
        }
        Insert: {
          bags?: number
          created_at?: string
          date: string
          farm_id: string
          id?: string
          room: string
        }
        Update: {
          bags?: number
          created_at?: string
          date?: string
          farm_id?: string
          id?: string
          room?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_usage_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string
          date: string
          farm_id: string
          id: string
          name: string
          scope: string
          type: string
        }
        Insert: {
          created_at?: string
          date: string
          farm_id: string
          id?: string
          name: string
          scope?: string
          type?: string
        }
        Update: {
          created_at?: string
          date?: string
          farm_id?: string
          id?: string
          name?: string
          scope?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      mortality: {
        Row: {
          cause: string
          created_at: string
          date: string
          farm_id: string
          id: string
          loss: number
          room: string
        }
        Insert: {
          cause?: string
          created_at?: string
          date: string
          farm_id: string
          id?: string
          loss?: number
          room: string
        }
        Update: {
          cause?: string
          created_at?: string
          date?: string
          farm_id?: string
          id?: string
          loss?: number
          room?: string
        }
        Relationships: [
          {
            foreignKeyName: "mortality_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          item: string
          price: number
          unit: string
          updated: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          item: string
          price?: number
          unit?: string
          updated?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          item?: string
          price?: number
          unit?: string
          updated?: string
        }
        Relationships: [
          {
            foreignKeyName: "prices_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          current: number
          farm_id: string
          id: string
          initial: number
          name: string
        }
        Insert: {
          created_at?: string
          current?: number
          farm_id: string
          id?: string
          initial?: number
          name: string
        }
        Update: {
          created_at?: string
          current?: number
          farm_id?: string
          id?: string
          initial?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
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
      admin_archive_notification: { Args: { _id: string }; Returns: undefined }
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: Json
      }
      admin_change_subscription: {
        Args: { _farm_id: string; _new_plan: string; _reason?: string }
        Returns: Json
      }
      admin_farm_summary: { Args: { _farm_id: string }; Returns: Json }
      admin_intelligence_summary: { Args: never; Returns: Json }
      admin_list_accounts: {
        Args: never
        Returns: {
          account_created: string
          email: string
          farm_id: string
          farm_name: string
          last_sign_in: string
          owner_name: string
          status: string
          subscription_plan: string
          user_id: string
        }[]
      }
      admin_list_audit_log: {
        Args: { _limit?: number }
        Returns: {
          action_type: string
          admin_email: string
          admin_user_id: string
          affected_farm_id: string
          affected_farm_name: string
          affected_user_id: string
          created_at: string
          id: string
          new_value: Json
          previous_value: Json
          reason: string
        }[]
      }
      admin_list_farms: {
        Args: never
        Returns: {
          bird_count: number
          country: string
          created_at: string
          farm_id: string
          farm_name: string
          location: string
          owner_email: string
          owner_name: string
          rooms_count: number
          state: string
          status: string
          subscription_plan: string
        }[]
      }
      admin_list_notifications: {
        Args: { _include_archived?: boolean; _limit?: number }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          message: string
          metadata: Json
          read_at: string | null
          related_farm_id: string | null
          related_user_id: string | null
          title: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_mark_all_notifications_read: { Args: never; Returns: undefined }
      admin_mark_notification_read: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_platform_stats: { Args: never; Returns: Json }
      admin_set_account_status: {
        Args: { _farm_id: string; _new_status: string; _reason?: string }
        Returns: Json
      }
      current_farm_id: { Args: never; Returns: string }
      get_super_admin_emails: {
        Args: never
        Returns: {
          email: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      landing_platform_stats: { Args: never; Returns: Json }
      platform_stats: {
        Args: never
        Returns: {
          birds: number
          crates: number
          eggs: number
          revenue: number
        }[]
      }
    }
    Enums: {
      app_role: "user" | "super_admin"
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
      app_role: ["user", "super_admin"],
    },
  },
} as const

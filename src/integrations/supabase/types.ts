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
          country: string
          created_at: string
          farm_type: string | null
          id: string
          name: string
          owner_id: string
          owner_name: string | null
          phone: string | null
          state: string | null
        }
        Insert: {
          bird_count?: number | null
          country?: string
          created_at?: string
          farm_type?: string | null
          id?: string
          name?: string
          owner_id: string
          owner_name?: string | null
          phone?: string | null
          state?: string | null
        }
        Update: {
          bird_count?: number | null
          country?: string
          created_at?: string
          farm_type?: string | null
          id?: string
          name?: string
          owner_id?: string
          owner_name?: string | null
          phone?: string | null
          state?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_farm_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

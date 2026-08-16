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
      ai_assistant_messages: {
        Row: {
          content: string
          created_at: string
          farm_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          farm_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          farm_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_messages_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_data_quality_flags: {
        Row: {
          created_at: string
          detail: string | null
          entry_date: string | null
          farm_id: string
          id: string
          resolved: boolean
          rule: string
          source_id: string | null
          source_table: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          entry_date?: string | null
          farm_id: string
          id?: string
          resolved?: boolean
          rule: string
          source_id?: string | null
          source_table: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          entry_date?: string | null
          farm_id?: string
          id?: string
          resolved?: boolean
          rule?: string
          source_id?: string | null
          source_table?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_data_quality_flags_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_versions: {
        Row: {
          created_at: string
          data_period_end: string | null
          data_period_start: string | null
          farms_used: number
          id: string
          metrics: Json
          notes: string | null
          records_used: number
          status: string
          trained_at: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          data_period_end?: string | null
          data_period_start?: string | null
          farms_used?: number
          id?: string
          metrics?: Json
          notes?: string | null
          records_used?: number
          status?: string
          trained_at?: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          data_period_end?: string | null
          data_period_start?: string | null
          farms_used?: number
          id?: string
          metrics?: Json
          notes?: string | null
          records_used?: number
          status?: string
          trained_at?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          acted_on: string | null
          category: string
          confidence: number
          created_at: string
          detail: Json
          farm_id: string
          feedback: string | null
          feedback_note: string | null
          id: string
          insight_key: string
          outcome_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          acted_on?: string | null
          category: string
          confidence?: number
          created_at?: string
          detail?: Json
          farm_id: string
          feedback?: string | null
          feedback_note?: string | null
          id?: string
          insight_key: string
          outcome_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          acted_on?: string | null
          category?: string
          confidence?: number
          created_at?: string
          detail?: Json
          farm_id?: string
          feedback?: string | null
          feedback_note?: string | null
          id?: string
          insight_key?: string
          outcome_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      broiler_batches: {
        Row: {
          birds_placed: number
          breed: string | null
          chick_unit_cost: number
          created_at: string
          current_birds: number
          date_placed: string
          farm_id: string
          house: string | null
          id: string
          name: string
          notes: string | null
          status: string
          target_weight_kg: number
          updated_at: string
        }
        Insert: {
          birds_placed?: number
          breed?: string | null
          chick_unit_cost?: number
          created_at?: string
          current_birds?: number
          date_placed?: string
          farm_id: string
          house?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          target_weight_kg?: number
          updated_at?: string
        }
        Update: {
          birds_placed?: number
          breed?: string | null
          chick_unit_cost?: number
          created_at?: string
          current_birds?: number
          date_placed?: string
          farm_id?: string
          house?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          target_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broiler_batches_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      broiler_daily: {
        Row: {
          avg_weight_g: number | null
          batch_id: string
          created_at: string
          deaths: number
          entry_date: string
          farm_id: string
          feed_kg: number
          id: string
          notes: string | null
          recorded_by: string | null
          recorded_by_name: string | null
          updated_at: string
          water_litres: number | null
        }
        Insert: {
          avg_weight_g?: number | null
          batch_id: string
          created_at?: string
          deaths?: number
          entry_date?: string
          farm_id: string
          feed_kg?: number
          id?: string
          notes?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          updated_at?: string
          water_litres?: number | null
        }
        Update: {
          avg_weight_g?: number | null
          batch_id?: string
          created_at?: string
          deaths?: number
          entry_date?: string
          farm_id?: string
          feed_kg?: number
          id?: string
          notes?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          updated_at?: string
          water_litres?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "broiler_daily_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "broiler_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broiler_daily_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      broiler_medications: {
        Row: {
          batch_id: string
          created_at: string
          dosage: string | null
          drug_name: string
          end_date: string | null
          farm_id: string
          id: string
          notes: string | null
          purpose: string | null
          recorded_by: string | null
          recorded_by_name: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          dosage?: string | null
          drug_name: string
          end_date?: string | null
          farm_id: string
          id?: string
          notes?: string | null
          purpose?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          dosage?: string | null
          drug_name?: string
          end_date?: string | null
          farm_id?: string
          id?: string
          notes?: string | null
          purpose?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broiler_medications_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "broiler_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broiler_medications_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      broiler_sales: {
        Row: {
          amount: number
          batch_id: string
          birds: number
          created_at: string
          customer: string | null
          entry_date: string
          farm_id: string
          id: string
          notes: string | null
          payment_method: string
          price_per_kg: number
          recorded_by: string | null
          recorded_by_name: string | null
          total_weight_kg: number
          updated_at: string
        }
        Insert: {
          amount?: number
          batch_id: string
          birds?: number
          created_at?: string
          customer?: string | null
          entry_date?: string
          farm_id: string
          id?: string
          notes?: string | null
          payment_method?: string
          price_per_kg?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          total_weight_kg?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          batch_id?: string
          birds?: number
          created_at?: string
          customer?: string | null
          entry_date?: string
          farm_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          price_per_kg?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          total_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broiler_sales_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "broiler_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broiler_sales_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      broiler_vaccinations: {
        Row: {
          administered_by: string | null
          age_days: number | null
          batch_id: string
          created_at: string
          date_given: string
          farm_id: string
          id: string
          notes: string | null
          recorded_by: string | null
          recorded_by_name: string | null
          updated_at: string
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          age_days?: number | null
          batch_id: string
          created_at?: string
          date_given: string
          farm_id: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          updated_at?: string
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          age_days?: number | null
          batch_id?: string
          created_at?: string
          date_given?: string
          farm_id?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          updated_at?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "broiler_vaccinations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "broiler_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broiler_vaccinations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_production: {
        Row: {
          broken_extra: number
          broken_extra_r2: number
          broken_extra_r3: number
          broken_extra_r4: number
          broken_r2: number
          broken_r3: number
          broken_r4: number
          created_at: string
          date: string
          extra: number
          extra_r2: number
          extra_r3: number
          extra_r4: number
          farm_id: string
          id: string
          label: string
          r2: number
          r3: number
          r4: number
        }
        Insert: {
          broken_extra?: number
          broken_extra_r2?: number
          broken_extra_r3?: number
          broken_extra_r4?: number
          broken_r2?: number
          broken_r3?: number
          broken_r4?: number
          created_at?: string
          date: string
          extra?: number
          extra_r2?: number
          extra_r3?: number
          extra_r4?: number
          farm_id: string
          id?: string
          label: string
          r2?: number
          r3?: number
          r4?: number
        }
        Update: {
          broken_extra?: number
          broken_extra_r2?: number
          broken_extra_r3?: number
          broken_extra_r4?: number
          broken_r2?: number
          broken_r3?: number
          broken_r4?: number
          created_at?: string
          date?: string
          extra?: number
          extra_r2?: number
          extra_r3?: number
          extra_r4?: number
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
      farm_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          entry_date: string
          farm_id: string
          id: string
          notes: string | null
          payment_method: string
          receipt_path: string | null
          recorded_by: string | null
          recorded_by_name: string | null
          subcategory: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          entry_date?: string
          farm_id: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_path?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          subcategory: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          farm_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_path?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          subcategory?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_expenses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_member_permissions: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          member_id: string
          permission: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          member_id: string
          permission: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          member_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_member_permissions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_member_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "farm_members"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_members: {
        Row: {
          created_at: string
          custom_permissions: boolean
          email: string | null
          farm_id: string
          full_name: string
          id: string
          invited_by: string | null
          last_login_at: string | null
          must_change_password: boolean
          phone: string | null
          role_key: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_permissions?: boolean
          email?: string | null
          farm_id: string
          full_name?: string
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          role_key: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_permissions?: boolean
          email?: string | null
          farm_id?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          role_key?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_members_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_members_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "farm_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      farm_revenue: {
        Row: {
          amount: number
          category: string
          created_at: string
          customer: string | null
          entry_date: string
          farm_id: string
          id: string
          item: string
          notes: string | null
          payment_method: string
          quantity: number
          recorded_by: string | null
          recorded_by_name: string | null
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          customer?: string | null
          entry_date?: string
          farm_id: string
          id?: string
          item: string
          notes?: string | null
          payment_method?: string
          quantity?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          customer?: string | null
          entry_date?: string
          farm_id?: string
          id?: string
          item?: string
          notes?: string | null
          payment_method?: string
          quantity?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_revenue_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_roles: {
        Row: {
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      farms: {
        Row: {
          auto_renew: boolean
          bag_weight_kg: number
          bird_count: number | null
          bird_type: string | null
          country: string
          created_at: string
          farm_type: string | null
          feed_source: string
          geocoded_at: string | null
          geocoded_place: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          owner_id: string
          owner_name: string | null
          phone: string | null
          plan_updated_at: string
          rooms_count: number | null
          state: string | null
          status: string
          subscription_plan: string
          trial_ends_at: string
          trial_started_at: string
        }
        Insert: {
          auto_renew?: boolean
          bag_weight_kg?: number
          bird_count?: number | null
          bird_type?: string | null
          country?: string
          created_at?: string
          farm_type?: string | null
          feed_source?: string
          geocoded_at?: string | null
          geocoded_place?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          owner_id: string
          owner_name?: string | null
          phone?: string | null
          plan_updated_at?: string
          rooms_count?: number | null
          state?: string | null
          status?: string
          subscription_plan?: string
          trial_ends_at?: string
          trial_started_at?: string
        }
        Update: {
          auto_renew?: boolean
          bag_weight_kg?: number
          bird_count?: number | null
          bird_type?: string | null
          country?: string
          created_at?: string
          farm_type?: string | null
          feed_source?: string
          geocoded_at?: string | null
          geocoded_place?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string
          owner_name?: string | null
          phone?: string | null
          plan_updated_at?: string
          rooms_count?: number | null
          state?: string | null
          status?: string
          subscription_plan?: string
          trial_ends_at?: string
          trial_started_at?: string
        }
        Relationships: []
      }
      feed_formula_ingredients: {
        Row: {
          created_at: string
          farm_id: string
          formula_id: string
          id: string
          name: string
          position: number
          price_per_unit: number
          quantity_kg: number
          unit: string
          unit_weight_kg: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          formula_id: string
          id?: string
          name: string
          position?: number
          price_per_unit?: number
          quantity_kg?: number
          unit?: string
          unit_weight_kg?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          formula_id?: string
          id?: string
          name?: string
          position?: number
          price_per_unit?: number
          quantity_kg?: number
          unit?: string
          unit_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_formula_ingredients_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_formula_ingredients_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "feed_formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_formulas: {
        Row: {
          bag_weight_kg: number | null
          created_at: string
          farm_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          bag_weight_kg?: number | null
          created_at?: string
          farm_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          bag_weight_kg?: number | null
          created_at?: string
          farm_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_formulas_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_inventory: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          farm_id: string
          feed_type: string
          id: string
          initial_kg: number
          note: string | null
          purchase_date: string
          remaining_kg: number
          source: string
          supplier: string | null
          unit_cost_per_kg: number
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          farm_id: string
          feed_type: string
          id?: string
          initial_kg: number
          note?: string | null
          purchase_date?: string
          remaining_kg: number
          source?: string
          supplier?: string | null
          unit_cost_per_kg?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          farm_id?: string
          feed_type?: string
          id?: string
          initial_kg?: number
          note?: string | null
          purchase_date?: string
          remaining_kg?: number
          source?: string
          supplier?: string | null
          unit_cost_per_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_inventory_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_ledger: {
        Row: {
          action: string
          balance_after_kg: number
          created_at: string
          entry_date: string
          farm_id: string
          id: string
          inventory_id: string | null
          note: string | null
          quantity_kg: number
          source_ref: string | null
        }
        Insert: {
          action: string
          balance_after_kg?: number
          created_at?: string
          entry_date?: string
          farm_id: string
          id?: string
          inventory_id?: string | null
          note?: string | null
          quantity_kg: number
          source_ref?: string | null
        }
        Update: {
          action?: string
          balance_after_kg?: number
          created_at?: string
          entry_date?: string
          farm_id?: string
          id?: string
          inventory_id?: string | null
          note?: string | null
          quantity_kg?: number
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_ledger_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_ledger_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
            referencedColumns: ["id"]
          },
        ]
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
      landing_visits: {
        Row: {
          created_at: string
          id: string
          page_label: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_label?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_label?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      layer_batch_daily: {
        Row: {
          avg_weight_g: number | null
          batch_id: string
          birds_count: number | null
          created_at: string
          death_reason: string | null
          deaths: number
          entry_date: string
          farm_id: string
          feed_cost: number
          feed_kg: number
          feed_type: string | null
          id: string
          notes: string | null
          observation: string | null
          recorded_by: string | null
          recorded_by_name: string | null
          temperature_c: number | null
          updated_at: string
          water_litres: number
        }
        Insert: {
          avg_weight_g?: number | null
          batch_id: string
          birds_count?: number | null
          created_at?: string
          death_reason?: string | null
          deaths?: number
          entry_date: string
          farm_id: string
          feed_cost?: number
          feed_kg?: number
          feed_type?: string | null
          id?: string
          notes?: string | null
          observation?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          temperature_c?: number | null
          updated_at?: string
          water_litres?: number
        }
        Update: {
          avg_weight_g?: number | null
          batch_id?: string
          birds_count?: number | null
          created_at?: string
          death_reason?: string | null
          deaths?: number
          entry_date?: string
          farm_id?: string
          feed_cost?: number
          feed_kg?: number
          feed_type?: string | null
          id?: string
          notes?: string | null
          observation?: string | null
          recorded_by?: string | null
          recorded_by_name?: string | null
          temperature_c?: number | null
          updated_at?: string
          water_litres?: number
        }
        Relationships: [
          {
            foreignKeyName: "layer_batch_daily_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "layer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layer_batch_daily_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      layer_batch_health: {
        Row: {
          administered_by: string | null
          batch_id: string
          created_at: string
          dosage: string | null
          entry_date: string
          farm_id: string
          id: string
          kind: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          administered_by?: string | null
          batch_id: string
          created_at?: string
          dosage?: string | null
          entry_date: string
          farm_id: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          administered_by?: string | null
          batch_id?: string
          created_at?: string
          dosage?: string | null
          entry_date?: string
          farm_id?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layer_batch_health_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "layer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layer_batch_health_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      layer_batch_milestones: {
        Row: {
          batch_id: string
          created_at: string
          done_at: string
          farm_id: string
          id: string
          milestone_key: string
          note: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          done_at?: string
          farm_id: string
          id?: string
          milestone_key: string
          note?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          done_at?: string
          farm_id?: string
          id?: string
          milestone_key?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "layer_batch_milestones_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "layer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layer_batch_milestones_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      layer_batch_weights: {
        Row: {
          avg_weight_g: number
          batch_id: string
          birds_weighed: number
          created_at: string
          entry_date: string
          farm_id: string
          id: string
          notes: string | null
          target_weight_g: number | null
          updated_at: string
          week: number
        }
        Insert: {
          avg_weight_g?: number
          batch_id: string
          birds_weighed?: number
          created_at?: string
          entry_date?: string
          farm_id: string
          id?: string
          notes?: string | null
          target_weight_g?: number | null
          updated_at?: string
          week: number
        }
        Update: {
          avg_weight_g?: number
          batch_id?: string
          birds_weighed?: number
          created_at?: string
          entry_date?: string
          farm_id?: string
          id?: string
          notes?: string | null
          target_weight_g?: number | null
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "layer_batch_weights_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "layer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layer_batch_weights_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      layer_batches: {
        Row: {
          bird_type: string
          birds_placed: number
          breed: string | null
          created_at: string
          current_birds: number
          farm_id: string
          id: string
          name: string
          notes: string | null
          placement_date: string
          room: string | null
          room_id: string | null
          source: string | null
          start_age_days: number
          status: string
          transferred_at: string | null
          transferred_room_id: string | null
          updated_at: string
        }
        Insert: {
          bird_type?: string
          birds_placed?: number
          breed?: string | null
          created_at?: string
          current_birds?: number
          farm_id: string
          id?: string
          name: string
          notes?: string | null
          placement_date: string
          room?: string | null
          room_id?: string | null
          source?: string | null
          start_age_days?: number
          status?: string
          transferred_at?: string | null
          transferred_room_id?: string | null
          updated_at?: string
        }
        Update: {
          bird_type?: string
          birds_placed?: number
          breed?: string | null
          created_at?: string
          current_birds?: number
          farm_id?: string
          id?: string
          name?: string
          notes?: string | null
          placement_date?: string
          room?: string | null
          room_id?: string | null
          source?: string | null
          start_age_days?: number
          status?: string
          transferred_at?: string | null
          transferred_room_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layer_batches_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      layer_rearing_settings: {
        Row: {
          created_at: string
          farm_id: string
          maturity_weeks: number
          schedule: Json
          stages: Json
          updated_at: string
          weight_targets: Json
        }
        Insert: {
          created_at?: string
          farm_id: string
          maturity_weeks?: number
          schedule?: Json
          stages?: Json
          updated_at?: string
          weight_targets?: Json
        }
        Update: {
          created_at?: string
          farm_id?: string
          maturity_weeks?: number
          schedule?: Json
          stages?: Json
          updated_at?: string
          weight_targets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "layer_rearing_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: true
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
      platform_activity_log: {
        Row: {
          action: string
          browser: string | null
          created_at: string
          device: string | null
          entity_id: string | null
          farm_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          module: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          browser?: string | null
          created_at?: string
          device?: string | null
          entity_id?: string | null
          farm_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          browser?: string | null
          created_at?: string
          device?: string | null
          entity_id?: string | null
          farm_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      price_history: {
        Row: {
          category: string
          created_at: string
          device: string | null
          effective_from: string
          farm_id: string
          id: string
          item: string
          new_price: number
          note: string | null
          old_price: number | null
          price_id: string | null
          unit: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          device?: string | null
          effective_from?: string
          farm_id: string
          id?: string
          item: string
          new_price: number
          note?: string | null
          old_price?: number | null
          price_id?: string | null
          unit?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          device?: string | null
          effective_from?: string
          farm_id?: string
          id?: string
          item?: string
          new_price?: number
          note?: string | null
          old_price?: number | null
          price_id?: string | null
          unit?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      prices: {
        Row: {
          category: string
          created_at: string
          effective_from: string
          farm_id: string
          id: string
          item: string
          last_device: string | null
          note: string | null
          price: number
          unit: string
          updated: string
        }
        Insert: {
          category?: string
          created_at?: string
          effective_from?: string
          farm_id: string
          id?: string
          item: string
          last_device?: string | null
          note?: string | null
          price?: number
          unit?: string
          updated?: string
        }
        Update: {
          category?: string
          created_at?: string
          effective_from?: string
          farm_id?: string
          id?: string
          item?: string
          last_device?: string | null
          note?: string | null
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
      role_permissions: {
        Row: {
          permission: string
          role_key: string
        }
        Insert: {
          permission: string
          role_key: string
        }
        Update: {
          permission?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "farm_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      rooms: {
        Row: {
          age_anchor_date: string | null
          age_recorded_at: string | null
          age_status: string
          age_weeks: number | null
          batch_number: string | null
          bird_type: string | null
          breed: string | null
          created_at: string
          culled_birds_sold: number | null
          culled_notes: string | null
          culled_on: string | null
          culled_revenue: number | null
          culled_unit_price: number | null
          current: number
          date_stocked: string | null
          farm_id: string
          id: string
          initial: number
          name: string
          status: string
        }
        Insert: {
          age_anchor_date?: string | null
          age_recorded_at?: string | null
          age_status?: string
          age_weeks?: number | null
          batch_number?: string | null
          bird_type?: string | null
          breed?: string | null
          created_at?: string
          culled_birds_sold?: number | null
          culled_notes?: string | null
          culled_on?: string | null
          culled_revenue?: number | null
          culled_unit_price?: number | null
          current?: number
          date_stocked?: string | null
          farm_id: string
          id?: string
          initial?: number
          name: string
          status?: string
        }
        Update: {
          age_anchor_date?: string | null
          age_recorded_at?: string | null
          age_status?: string
          age_weeks?: number | null
          batch_number?: string | null
          bird_type?: string | null
          breed?: string | null
          created_at?: string
          culled_birds_sold?: number | null
          culled_notes?: string | null
          culled_on?: string | null
          culled_revenue?: number | null
          culled_unit_price?: number | null
          current?: number
          date_stocked?: string | null
          farm_id?: string
          id?: string
          initial?: number
          name?: string
          status?: string
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
      security_events: {
        Row: {
          actor_email: string | null
          actor_name: string | null
          actor_role: string | null
          browser: string | null
          created_at: string
          detail: string | null
          device: string | null
          event_type: string
          farm_id: string | null
          id: string
          ip_address: string | null
          location: string | null
          metadata: Json
          os: string | null
          user_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          browser?: string | null
          created_at?: string
          detail?: string | null
          device?: string | null
          event_type: string
          farm_id?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json
          os?: string | null
          user_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          browser?: string | null
          created_at?: string
          detail?: string | null
          device?: string | null
          event_type?: string
          farm_id?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json
          os?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          actions_taken: Json | null
          admin_user_id: string
          ended_at: string | null
          farm_id: string
          id: string
          reason: string
          started_at: string
        }
        Insert: {
          actions_taken?: Json | null
          admin_user_id: string
          ended_at?: string | null
          farm_id: string
          id?: string
          reason: string
          started_at?: string
        }
        Update: {
          actions_taken?: Json | null
          admin_user_id?: string
          ended_at?: string | null
          farm_id?: string
          id?: string
          reason?: string
          started_at?: string
        }
        Relationships: []
      }
      user_last_location: {
        Row: {
          context_id: string | null
          context_kind: string | null
          created_at: string
          farm_id: string | null
          hash: string | null
          label: string | null
          pathname: string
          search: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_kind?: string | null
          created_at?: string
          farm_id?: string | null
          hash?: string | null
          label?: string | null
          pathname: string
          search?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_kind?: string | null
          created_at?: string
          farm_id?: string | null
          hash?: string | null
          label?: string | null
          pathname?: string
          search?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_last_location_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          last_seen: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
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
      weather_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      whatsapp_clicks: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          page_label: string | null
          page_path: string | null
          referrer: string | null
          referrer_source: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          user_type: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          page_label?: string | null
          page_path?: string | null
          referrer?: string | null
          referrer_source?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_type?: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          page_label?: string | null
          page_path?: string | null
          referrer?: string | null
          referrer_source?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_active_support_session: {
        Args: { _farm_id: string }
        Returns: {
          actions_taken: Json | null
          admin_user_id: string
          ended_at: string | null
          farm_id: string
          id: string
          reason: string
          started_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "support_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      admin_delete_account: {
        Args: { _reason?: string; _user_id: string }
        Returns: Json
      }
      admin_end_support: { Args: { _session_id: string }; Returns: undefined }
      admin_farm_intelligence: { Args: { _farm_id: string }; Returns: Json }
      admin_farm_summary: { Args: { _farm_id: string }; Returns: Json }
      admin_get_settings: { Args: never; Returns: Json }
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
      admin_list_activity: {
        Args: {
          _action?: string
          _farm_id?: string
          _from?: string
          _limit?: number
          _module?: string
          _offset?: number
          _to?: string
          _user_id?: string
        }
        Returns: {
          action: string
          browser: string
          created_at: string
          device: string
          entity_id: string
          farm_id: string
          farm_name: string
          id: string
          ip_address: string
          metadata: Json
          module: string
          success: boolean
          total_count: number
          user_email: string
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
          is_online: boolean
          last_activity: string
          last_login: string
          location: string
          owner_email: string
          owner_name: string
          rooms_count: number
          state: string
          status: string
          subscription_plan: string
          users_count: number
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
      admin_list_subscriptions: {
        Args: never
        Returns: {
          auto_renew: boolean
          created_at: string
          days_remaining: number
          effective_plan: string
          farm_id: string
          farm_name: string
          is_trial: boolean
          owner_email: string
          plan: string
          status: string
          trial_ends_at: string
        }[]
      }
      admin_mark_all_notifications_read: { Args: never; Returns: undefined }
      admin_mark_notification_read: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_platform_stats: { Args: never; Returns: Json }
      admin_platform_timeseries: { Args: { _days?: number }; Returns: Json }
      admin_set_account_status: {
        Args: { _farm_id: string; _new_status: string; _reason?: string }
        Returns: Json
      }
      admin_set_setting: {
        Args: { _key: string; _value: Json }
        Returns: undefined
      }
      admin_start_support: {
        Args: { _farm_id: string; _reason: string }
        Returns: string
      }
      admin_subscription_stats: { Args: never; Returns: Json }
      admin_whatsapp_export: {
        Args: never
        Returns: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          page_label: string | null
          page_path: string | null
          referrer: string | null
          referrer_source: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          user_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_clicks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_whatsapp_recent: {
        Args: { _limit?: number }
        Returns: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          page_label: string | null
          page_path: string | null
          referrer: string | null
          referrer_source: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          user_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_clicks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_whatsapp_stats: { Args: never; Returns: Json }
      can: { Args: { _farm: string; _perm: string }; Returns: boolean }
      can_edit_recent: {
        Args: { _created: string; _farm: string; _perm: string }
        Returns: boolean
      }
      complete_password_change: { Args: never; Returns: undefined }
      consume_feed_fifo: {
        Args: {
          _entry_date: string
          _farm_id: string
          _kg: number
          _source_ref: string
        }
        Returns: undefined
      }
      current_farm_id: { Args: never; Returns: string }
      demo_greenfield_data: { Args: never; Returns: Json }
      farm_activity_log: {
        Args: { _limit?: number }
        Returns: {
          action: string
          actor_email: string
          actor_name: string
          actor_role: string
          browser: string
          created_at: string
          device: string
          entity_id: string
          id: string
          ip_address: string
          module: string
          success: boolean
        }[]
      }
      farm_feed_stock_kg: { Args: { _farm_id: string }; Returns: number }
      farm_security_events: {
        Args: {
          _event_type?: string
          _from?: string
          _limit?: number
          _role?: string
          _to?: string
          _user_id?: string
        }
        Returns: {
          actor_email: string | null
          actor_name: string | null
          actor_role: string | null
          browser: string | null
          created_at: string
          detail: string | null
          device: string | null
          event_type: string
          farm_id: string | null
          id: string
          ip_address: string | null
          location: string | null
          metadata: Json
          os: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "security_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      farm_staff_get_permissions: {
        Args: { _member_id: string }
        Returns: Json
      }
      farm_staff_list: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_login_at: string
          must_change_password: boolean
          phone: string
          role_key: string
          role_label: string
          status: string
          user_id: string
        }[]
      }
      farm_staff_set_permissions: {
        Args: { _custom: boolean; _member_id: string; _permissions: string[] }
        Returns: Json
      }
      farm_staff_set_role: {
        Args: { _member_id: string; _role: string }
        Returns: Json
      }
      farm_staff_set_status: {
        Args: { _member_id: string; _status: string }
        Returns: Json
      }
      farm_subscription_status: { Args: never; Returns: Json }
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
      log_security_event: {
        Args: {
          _browser?: string
          _detail?: string
          _device?: string
          _event_type: string
          _identifier?: string
          _ip?: string
          _location?: string
          _metadata?: Json
          _os?: string
        }
        Returns: undefined
      }
      member_effective_permissions: {
        Args: { _member_id: string }
        Returns: string[]
      }
      my_farm_context: { Args: never; Returns: Json }
      my_farm_ids: { Args: never; Returns: string[] }
      platform_stats: {
        Args: never
        Returns: {
          birds: number
          crates: number
          eggs: number
          revenue: number
        }[]
      }
      presentation_demo_data: { Args: never; Returns: Json }
      price_key: { Args: { _category: string; _item: string }; Returns: string }
      resolve_login_email: { Args: { _identifier: string }; Returns: string }
      touch_member_login: { Args: never; Returns: undefined }
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

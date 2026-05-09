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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_children: {
        Row: {
          age: number | null
          appointment_id: string
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          notes: string | null
        }
        Insert: {
          age?: number | null
          appointment_id: string
          created_at?: string
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          notes?: string | null
        }
        Update: {
          age?: number | null
          appointment_id?: string
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_children_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          child_name: string | null
          created_at: string
          deposit_cents: number
          guardian_name: string
          guardian_phone: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          notes: string | null
          party_size: number
          scheduled_date: string
          scheduled_end_time: string | null
          scheduled_start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          child_name?: string | null
          created_at?: string
          deposit_cents?: number
          guardian_name: string
          guardian_phone: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          notes?: string | null
          party_size?: number
          scheduled_date: string
          scheduled_end_time?: string | null
          scheduled_start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          total_cents?: number
          updated_at?: string
        }
        Update: {
          child_name?: string | null
          created_at?: string
          deposit_cents?: number
          guardian_name?: string
          guardian_phone?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          notes?: string | null
          party_size?: number
          scheduled_date?: string
          scheduled_end_time?: string | null
          scheduled_start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          completed_at: string | null
          cost_cents: number
          created_at: string
          id: string
          notes: string | null
          performed_by: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["maintenance_status"]
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          completed_at?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          completed_at?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          active: boolean
          category: string | null
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      child_guardians: {
        Row: {
          child_id: string
          created_at: string
          guardian_id: string
          is_primary: boolean
          relationship: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          guardian_id: string
          is_primary?: boolean
          relationship?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          guardian_id?: string
          is_primary?: boolean
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_guardians_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          notes: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          points_balance: number
          total_earned: number
          total_redeemed: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          points_balance?: number
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          points_balance?: number
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: true
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          active: boolean
          cost_points: number
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_points: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          account_id: string
          created_at: string
          delta: number
          id: string
          product_sale_id: string | null
          reason: string
          reward_id: string | null
          session_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          delta: number
          id?: string
          product_sale_id?: string | null
          reason: string
          reward_id?: string | null
          session_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          delta?: number
          id?: string
          product_sale_id?: string | null
          reason?: string
          reward_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_product_sale_id_fkey"
            columns: ["product_sale_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_with_timing"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          active: boolean
          created_at: string
          display_weight: number
          duration_seconds: number
          ends_on: string | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          name: string
          notes: string | null
          starts_on: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_weight?: number
          duration_seconds?: number
          ends_on?: string | null
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          name: string
          notes?: string | null
          starts_on?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_weight?: number
          duration_seconds?: number
          ends_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          name?: string
          notes?: string | null
          starts_on?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          key: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          key: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          key?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages_log: {
        Row: {
          body: string
          context: Json | null
          created_at: string
          event_type: string | null
          failed_at: string | null
          id: string
          phone: string
          provider_response: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template_key: string | null
          triggered_by: string | null
        }
        Insert: {
          body: string
          context?: Json | null
          created_at?: string
          event_type?: string | null
          failed_at?: string | null
          id?: string
          phone: string
          provider_response?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template_key?: string | null
          triggered_by?: string | null
        }
        Update: {
          body?: string
          context?: Json | null
          created_at?: string
          event_type?: string | null
          failed_at?: string | null
          id?: string
          phone?: string
          provider_response?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template_key?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_log_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "messages_log_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          child_name: string | null
          classification:
            | Database["public"]["Enums"]["nps_classification"]
            | null
          comment: string | null
          created_at: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          responded_at: string | null
          score: number | null
          sent_at: string | null
          session_id: string | null
          token: string
        }
        Insert: {
          child_name?: string | null
          classification?:
            | Database["public"]["Enums"]["nps_classification"]
            | null
          comment?: string | null
          created_at?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string | null
          session_id?: string | null
          token?: string
        }
        Update: {
          child_name?: string | null
          classification?:
            | Database["public"]["Enums"]["nps_classification"]
            | null
          comment?: string | null
          created_at?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string | null
          session_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_with_timing"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          commission_pct: number
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_pct?: number
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_pct?: number
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal_cents: number | null
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal_cents?: number | null
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal_cents?: number | null
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_method: string | null
          session_id: string | null
          total_cents: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          session_id?: string | null
          total_cents: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          session_id?: string | null
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_with_timing"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          notes: string | null
          price_cents: number
          sku: string | null
          stock_qty: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          notes?: string | null
          price_cents: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          price_cents?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          amount_paid_cents: number | null
          child_id: string
          contracted_minutes: number
          created_at: string
          created_by: string | null
          ended_at: string | null
          guardian_id: string | null
          id: string
          notes: string | null
          partner_id: string | null
          paused_at: string | null
          paused_total_seconds: number
          payment_method: string | null
          qr_code_token: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number | null
          child_id: string
          contracted_minutes: number
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          guardian_id?: string | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          paused_at?: string | null
          paused_total_seconds?: number
          payment_method?: string | null
          qr_code_token?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number | null
          child_id?: string
          contracted_minutes?: number
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          guardian_id?: string | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          paused_at?: string | null
          paused_total_seconds?: number
          payment_method?: string | null
          qr_code_token?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          commission_pct: number
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          role_label: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_pct?: number
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_pct?: number
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          member_id: string
          notes: string | null
          scheduled_date: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          member_id: string
          notes?: string | null
          scheduled_date: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          member_id?: string
          notes?: string | null
          scheduled_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          covers_period: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string
          payment_method: string | null
          subscription_id: string
        }
        Insert: {
          amount_cents: number
          covers_period?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
          subscription_id: string
        }
        Update: {
          amount_cents?: number
          covers_period?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          included_minutes: number
          monthly_cents: number
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          included_minutes?: number
          monthly_cents: number
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          included_minutes?: number
          monthly_cents?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          guardian_id: string
          id: string
          next_billing_on: string
          notes: string | null
          plan_id: string
          starts_on: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          guardian_id: string
          id?: string
          next_billing_on: string
          notes?: string | null
          plan_id: string
          starts_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          guardian_id?: string
          id?: string
          next_billing_on?: string
          notes?: string | null
          plan_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          arrived_at: string | null
          called_at: string | null
          child_age: number | null
          child_full_name: string | null
          child_gender: Database["public"]["Enums"]["gender"] | null
          closed_at: string | null
          created_at: string
          guardian_full_name: string
          guardian_phone: string
          id: string
          notes: string | null
          party_size: number
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          called_at?: string | null
          child_age?: number | null
          child_full_name?: string | null
          child_gender?: Database["public"]["Enums"]["gender"] | null
          closed_at?: string | null
          created_at?: string
          guardian_full_name: string
          guardian_phone: string
          id?: string
          notes?: string | null
          party_size?: number
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          called_at?: string | null
          child_age?: number | null
          child_full_name?: string | null
          child_gender?: Database["public"]["Enums"]["gender"] | null
          closed_at?: string | null
          created_at?: string
          guardian_full_name?: string
          guardian_phone?: string
          id?: string
          notes?: string | null
          party_size?: number
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
        }
        Relationships: []
      }
    }
    Views: {
      sessions_with_timing: {
        Row: {
          amount_paid_cents: number | null
          child_id: string | null
          contracted_minutes: number | null
          created_at: string | null
          created_by: string | null
          ended_at: string | null
          expected_end_at: string | null
          guardian_id: string | null
          id: string | null
          notes: string | null
          partner_id: string | null
          paused_at: string | null
          paused_total_seconds: number | null
          payment_method: string | null
          qr_code_token: string | null
          remaining_seconds: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount_paid_cents?: number | null
          child_id?: string | null
          contracted_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          expected_end_at?: never
          guardian_id?: string | null
          id?: string | null
          notes?: string | null
          partner_id?: string | null
          paused_at?: string | null
          paused_total_seconds?: number | null
          payment_method?: string | null
          qr_code_token?: string | null
          remaining_seconds?: never
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount_paid_cents?: number | null
          child_id?: string | null
          contracted_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          expected_end_at?: never
          guardian_id?: string | null
          id?: string | null
          notes?: string | null
          partner_id?: string | null
          paused_at?: string | null
          paused_total_seconds?: number | null
          payment_method?: string | null
          qr_code_token?: string | null
          remaining_seconds?: never
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      award_loyalty_points: {
        Args: {
          p_guardian_id: string
          p_points: number
          p_product_sale_id?: string
          p_reason: string
          p_session_id?: string
        }
        Returns: undefined
      }
      ensure_loyalty_account: {
        Args: { p_guardian_id: string }
        Returns: string
      }
      get_nps_by_token: {
        Args: { p_token: string }
        Returns: {
          child_name: string
          comment: string
          guardian_name: string
          id: string
          responded_at: string
          score: number
        }[]
      }
      redeem_loyalty_reward: {
        Args: { p_account_id: string; p_reward_id: string }
        Returns: undefined
      }
      staff_commissions_for_period: {
        Args: { p_from: string; p_to: string }
        Returns: {
          attributed_cents: number
          commission_cents: number
          commission_pct: number
          full_name: string
          member_id: string
          role_label: string
        }[]
      }
      submit_nps_response: {
        Args: { p_comment?: string; p_score: number; p_token: string }
        Returns: undefined
      }
    }
    Enums: {
      appointment_kind: "visit" | "event"
      appointment_status:
        | "requested"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "canceled"
        | "no_show"
      asset_condition: "good" | "attention" | "broken"
      gender: "boy" | "girl"
      maintenance_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "overdue"
        | "canceled"
      maintenance_type: "preventive" | "corrective"
      media_kind: "image" | "video"
      message_status: "queued" | "sent" | "failed"
      nps_classification: "detractor" | "passive" | "promoter"
      session_status: "active" | "paused" | "ended"
      shift_status: "scheduled" | "completed" | "no_show" | "canceled"
      subscription_status: "active" | "paused" | "canceled" | "expired"
      user_role: "owner" | "staff" | "partner" | "customer"
      waitlist_status: "waiting" | "called" | "arrived" | "no_show" | "canceled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_kind: ["visit", "event"],
      appointment_status: [
        "requested",
        "confirmed",
        "in_progress",
        "completed",
        "canceled",
        "no_show",
      ],
      asset_condition: ["good", "attention", "broken"],
      gender: ["boy", "girl"],
      maintenance_status: [
        "scheduled",
        "in_progress",
        "completed",
        "overdue",
        "canceled",
      ],
      maintenance_type: ["preventive", "corrective"],
      media_kind: ["image", "video"],
      message_status: ["queued", "sent", "failed"],
      nps_classification: ["detractor", "passive", "promoter"],
      session_status: ["active", "paused", "ended"],
      shift_status: ["scheduled", "completed", "no_show", "canceled"],
      subscription_status: ["active", "paused", "canceled", "expired"],
      user_role: ["owner", "staff", "partner", "customer"],
      waitlist_status: ["waiting", "called", "arrived", "no_show", "canceled"],
    },
  },
} as const

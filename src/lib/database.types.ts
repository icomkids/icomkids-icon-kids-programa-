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
          id: string
          notes: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
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
          child_full_name: string | null
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
          child_full_name?: string | null
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
          child_full_name?: string | null
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
    }
    Enums: {
      message_status: "queued" | "sent" | "failed"
      session_status: "active" | "paused" | "ended"
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
      message_status: ["queued", "sent", "failed"],
      session_status: ["active", "paused", "ended"],
      subscription_status: ["active", "paused", "canceled", "expired"],
      user_role: ["owner", "staff", "partner", "customer"],
      waitlist_status: ["waiting", "called", "arrived", "no_show", "canceled"],
    },
  },
} as const

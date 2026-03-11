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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      kite_config: {
        Row: {
          access_token: string
          api_key: string
          id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          api_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          api_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      last_scan_cache: {
        Row: {
          cached_at: string
          id: string
          index_name: string
          mode: string
          scan_data: Json
        }
        Insert: {
          cached_at?: string
          id?: string
          index_name: string
          mode?: string
          scan_data: Json
        }
        Update: {
          cached_at?: string
          id?: string
          index_name?: string
          mode?: string
          scan_data?: Json
        }
        Relationships: []
      }
      signals: {
        Row: {
          confidence: number
          created_at: string
          entry_price: number
          id: string
          index_name: string
          mode: string
          option_type: string
          reason: string
          stop_loss: number
          strike: number
          target1: number
          target2: number
          target3: number
          trading_symbol: string
        }
        Insert: {
          confidence: number
          created_at?: string
          entry_price: number
          id?: string
          index_name?: string
          mode?: string
          option_type: string
          reason?: string
          stop_loss: number
          strike: number
          target1: number
          target2: number
          target3: number
          trading_symbol: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entry_price?: number
          id?: string
          index_name?: string
          mode?: string
          option_type?: string
          reason?: string
          stop_loss?: number
          strike?: number
          target1?: number
          target2?: number
          target3?: number
          trading_symbol?: string
        }
        Relationships: []
      }
      support_resistance: {
        Row: {
          created_at: string
          id: string
          index_name: string
          level_type: string
          price: number
          strength: number
          timeframe: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          index_name?: string
          level_type: string
          price: number
          strength?: number
          timeframe: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          index_name?: string
          level_type?: string
          price?: number
          strength?: number
          timeframe?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_results: {
        Row: {
          created_at: string
          exit_price: number | null
          id: string
          index_name: string
          mode: string
          outcome: string
          pnl: number | null
          resolved_at: string | null
          signal_id: string
        }
        Insert: {
          created_at?: string
          exit_price?: number | null
          id?: string
          index_name?: string
          mode?: string
          outcome: string
          pnl?: number | null
          resolved_at?: string | null
          signal_id: string
        }
        Update: {
          created_at?: string
          exit_price?: number | null
          id?: string
          index_name?: string
          mode?: string
          outcome?: string
          pnl?: number | null
          resolved_at?: string | null
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_results_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      volume_history: {
        Row: {
          id: string
          instrument_token: number
          ltp: number
          oi: number
          option_type: string
          recorded_at: string
          strike: number
          trading_symbol: string
          volume: number
        }
        Insert: {
          id?: string
          instrument_token: number
          ltp?: number
          oi?: number
          option_type: string
          recorded_at?: string
          strike: number
          trading_symbol: string
          volume?: number
        }
        Update: {
          id?: string
          instrument_token?: number
          ltp?: number
          oi?: number
          option_type?: string
          recorded_at?: string
          strike?: number
          trading_symbol?: string
          volume?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_volume_history: { Args: never; Returns: undefined }
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

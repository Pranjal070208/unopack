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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      game_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          game_id: string | null
          id: number
          player_id: string | null
          room_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          game_id?: string | null
          id?: number
          player_id?: string | null
          room_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          game_id?: string | null
          id?: number
          player_id?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_private: {
        Row: {
          deck: Json
          full_state: Json
          game_id: string
          hands: Json
          pile: Json
        }
        Insert: {
          deck?: Json
          full_state?: Json
          game_id: string
          hands?: Json
          pile?: Json
        }
        Update: {
          deck?: Json
          full_state?: Json
          game_id?: string
          hands?: Json
          pile?: Json
        }
        Relationships: [
          {
            foreignKeyName: "game_private_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          active_color: string | null
          created_at: string
          current_player_id: string | null
          direction: number
          discard_top: Json | null
          id: string
          pending_draw: number
          phase: string
          public_state: Json
          room_id: string
          seed: number | null
          status: string
          turn_count: number
          turn_started_at: string
          winner_id: string | null
        }
        Insert: {
          active_color?: string | null
          created_at?: string
          current_player_id?: string | null
          direction?: number
          discard_top?: Json | null
          id?: string
          pending_draw?: number
          phase?: string
          public_state?: Json
          room_id: string
          seed?: number | null
          status?: string
          turn_count?: number
          turn_started_at?: string
          winner_id?: string | null
        }
        Update: {
          active_color?: string | null
          created_at?: string
          current_player_id?: string | null
          direction?: number
          discard_top?: Json | null
          id?: string
          pending_draw?: number
          phase?: string
          public_state?: Json
          room_id?: string
          seed?: number | null
          status?: string
          turn_count?: number
          turn_started_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_secrets: {
        Row: {
          player_id: string
          secret: string
        }
        Insert: {
          player_id: string
          secret: string
        }
        Update: {
          player_id?: string
          secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_secrets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar: string
          card_count: number
          eliminated: boolean
          finished_rank: number | null
          id: string
          is_connected: boolean
          is_host: boolean
          joined_at: string
          last_hand_points: number
          last_seen: string
          nickname: string
          room_id: string
          score: number
          seat: number
          session_id: string
        }
        Insert: {
          avatar?: string
          card_count?: number
          eliminated?: boolean
          finished_rank?: number | null
          id?: string
          is_connected?: boolean
          is_host?: boolean
          joined_at?: string
          last_hand_points?: number
          last_seen?: string
          nickname: string
          room_id: string
          score?: number
          seat?: number
          session_id: string
        }
        Update: {
          avatar?: string
          card_count?: number
          eliminated?: boolean
          finished_rank?: number | null
          id?: string
          is_connected?: boolean
          is_host?: boolean
          joined_at?: string
          last_hand_points?: number
          last_seen?: string
          nickname?: string
          room_id?: string
          score?: number
          seat?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          host_player_id: string | null
          id: string
          match_winner_id: string | null
          max_players: number
          score_mode: boolean
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          host_player_id?: string | null
          id?: string
          match_winner_id?: string | null
          max_players?: number
          score_mode?: boolean
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          host_player_id?: string | null
          id?: string
          match_winner_id?: string | null
          max_players?: number
          score_mode?: boolean
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

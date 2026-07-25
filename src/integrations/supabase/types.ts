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
      balls: {
        Row: {
          ball_in_over: number
          ball_index: number
          batting_team: string
          bowler_id: string | null
          commentary: string | null
          created_at: string
          extra_runs: number
          extra_type: string | null
          fielder_id: string | null
          id: string
          innings_number: number
          is_legal_ball: boolean
          is_wicket: boolean
          match_id: string
          new_batsman_id: string | null
          non_striker_id: string | null
          out_player_id: string | null
          over_number: number
          runs: number
          striker_id: string | null
          wicket_type: string | null
        }
        Insert: {
          ball_in_over: number
          ball_index: number
          batting_team: string
          bowler_id?: string | null
          commentary?: string | null
          created_at?: string
          extra_runs?: number
          extra_type?: string | null
          fielder_id?: string | null
          id?: string
          innings_number: number
          is_legal_ball?: boolean
          is_wicket?: boolean
          match_id: string
          new_batsman_id?: string | null
          non_striker_id?: string | null
          out_player_id?: string | null
          over_number: number
          runs?: number
          striker_id?: string | null
          wicket_type?: string | null
        }
        Update: {
          ball_in_over?: number
          ball_index?: number
          batting_team?: string
          bowler_id?: string | null
          commentary?: string | null
          created_at?: string
          extra_runs?: number
          extra_type?: string | null
          fielder_id?: string | null
          id?: string
          innings_number?: number
          is_legal_ball?: boolean
          is_wicket?: boolean
          match_id?: string
          new_batsman_id?: string | null
          non_striker_id?: string | null
          out_player_id?: string | null
          over_number?: number
          runs?: number
          striker_id?: string | null
          wicket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balls_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balls_fielder_id_fkey"
            columns: ["fielder_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balls_new_batsman_id_fkey"
            columns: ["new_batsman_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balls_non_striker_id_fkey"
            columns: ["non_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balls_out_player_id_fkey"
            columns: ["out_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balls_striker_id_fkey"
            columns: ["striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          batting_first: string
          common_player_id: string | null
          created_at: string
          fielder_players: Json
          id: string
          match_date: string
          name: string | null
          player_of_match_id: string | null
          result: Json | null
          state: Json
          status: string
          team_a_name: string
          team_a_players: Json
          team_b_name: string
          team_b_players: Json
          total_overs: number
          updated_at: string
          winner_team: string | null
        }
        Insert: {
          batting_first?: string
          common_player_id?: string | null
          created_at?: string
          fielder_players?: Json
          id?: string
          match_date?: string
          name?: string | null
          player_of_match_id?: string | null
          result?: Json | null
          state?: Json
          status?: string
          team_a_name?: string
          team_a_players?: Json
          team_b_name?: string
          team_b_players?: Json
          total_overs?: number
          updated_at?: string
          winner_team?: string | null
        }
        Update: {
          batting_first?: string
          common_player_id?: string | null
          created_at?: string
          fielder_players?: Json
          id?: string
          match_date?: string
          name?: string | null
          player_of_match_id?: string | null
          result?: Json | null
          state?: Json
          status?: string
          team_a_name?: string
          team_a_players?: Json
          team_b_name?: string
          team_b_players?: Json
          total_overs?: number
          updated_at?: string
          winner_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_common_player_id_fkey"
            columns: ["common_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_of_match_id_fkey"
            columns: ["player_of_match_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string
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

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audio_cache: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          engine: string
          id: string
          language: string
          section: string
          storage_path: string
          updated_at: string | null
          voice_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          engine: string
          id?: string
          language: string
          section: string
          storage_path: string
          updated_at?: string | null
          voice_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          section?: string
          storage_path?: string
          updated_at?: string | null
          voice_id?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          book_id: string
          content_type: string
          created_at: string | null
          is_active: boolean | null
          slug: string
          title: string | null
          title_en: string
          title_hi: string | null
        }
        Insert: {
          book_id?: string
          content_type: string
          created_at?: string | null
          is_active?: boolean | null
          slug: string
          title?: string | null
          title_en: string
          title_hi?: string | null
        }
        Update: {
          book_id?: string
          content_type?: string
          created_at?: string | null
          is_active?: boolean | null
          slug?: string
          title?: string | null
          title_en?: string
          title_hi?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      staging_mahabharat: {
        Row: {
          attempt_used: number | null
          chapter_no: number
          commentary: string | null
          language: string | null
          practical_examples: string | null
          review_note: string | null
          story: string | null
          title: string
        }
        Insert: {
          attempt_used?: number | null
          chapter_no: number
          commentary?: string | null
          language?: string | null
          practical_examples?: string | null
          review_note?: string | null
          story?: string | null
          title: string
        }
        Update: {
          attempt_used?: number | null
          chapter_no?: number
          commentary?: string | null
          language?: string | null
          practical_examples?: string | null
          review_note?: string | null
          story?: string | null
          title?: string
        }
        Relationships: []
      }
      staging_ramayan: {
        Row: {
          application: string | null
          commentary: string | null
          created_at: string | null
          episode_no: number
          id: string
          language: string
          story: string | null
          title: string
        }
        Insert: {
          application?: string | null
          commentary?: string | null
          created_at?: string | null
          episode_no: number
          id: string
          language: string
          story?: string | null
          title: string
        }
        Update: {
          application?: string | null
          commentary?: string | null
          created_at?: string | null
          episode_no?: number
          id?: string
          language?: string
          story?: string | null
          title?: string
        }
        Relationships: []
      }
      user_bookmarks: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_daily_usage: {
        Row: {
          created_at: string | null
          sessions_used: number | null
          updated_at: string | null
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          sessions_used?: number | null
          updated_at?: string | null
          usage_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          sessions_used?: number | null
          updated_at?: string | null
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          book_id: string
          content_type: string | null
          last_content_id: string
          last_position_seconds: number | null
          playback_speed: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          book_id: string
          content_type?: string | null
          last_content_id: string
          last_position_seconds?: number | null
          playback_speed?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          book_id?: string
          content_type?: string | null
          last_content_id?: string
          last_position_seconds?: number | null
          playback_speed?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "user_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "user_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "user_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["book_id"]
          },
        ]
      }
      verse_audio: {
        Row: {
          asset_type: string | null
          book_id: string
          created_at: string
          id: string
          is_active: boolean
          is_canonical: boolean | null
          is_primary_playback: boolean | null
          language: string
          section: string
          status: string | null
          storage_bucket: string | null
          storage_path: string
          updated_at: string
          verse_id: string
          voice_id: string
        }
        Insert: {
          asset_type?: string | null
          book_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_canonical?: boolean | null
          is_primary_playback?: boolean | null
          language: string
          section: string
          status?: string | null
          storage_bucket?: string | null
          storage_path: string
          updated_at?: string
          verse_id: string
          voice_id: string
        }
        Update: {
          asset_type?: string | null
          book_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_canonical?: boolean | null
          is_primary_playback?: boolean | null
          language?: string
          section?: string
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string
          updated_at?: string
          verse_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verse_audio_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verse_audio_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verse_audio_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verse_audio_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verse_audio_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_audio_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_audio_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_audio_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_audio_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["verse_id"]
          },
        ]
      }
      verse_content: {
        Row: {
          commentary: string | null
          created_at: string | null
          daily_life_application: string | null
          id: string
          language: string
          practical_examples: Json | null
          title: string | null
          translation: string | null
          updated_at: string | null
          verse_id: string
        }
        Insert: {
          commentary?: string | null
          created_at?: string | null
          daily_life_application?: string | null
          id?: string
          language: string
          practical_examples?: Json | null
          title?: string | null
          translation?: string | null
          updated_at?: string | null
          verse_id: string
        }
        Update: {
          commentary?: string | null
          created_at?: string | null
          daily_life_application?: string | null
          id?: string
          language?: string
          practical_examples?: Json | null
          title?: string | null
          translation?: string | null
          updated_at?: string | null
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["verse_id"]
          },
        ]
      }
      verses: {
        Row: {
          book_id: string
          chapter_no: number
          created_at: string | null
          ref: string
          sanskrit: string | null
          updated_at: string | null
          verse_id: string
          verse_no: number
        }
        Insert: {
          book_id: string
          chapter_no: number
          created_at?: string | null
          ref: string
          sanskrit?: string | null
          updated_at?: string | null
          verse_id?: string
          verse_no: number
        }
        Update: {
          book_id?: string
          chapter_no?: number
          created_at?: string | null
          ref?: string
          sanskrit?: string | null
          updated_at?: string | null
          verse_id?: string
          verse_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["book_id"]
          },
        ]
      }
    }
    Views: {
      canonical_audio: {
        Row: {
          language: string | null
          rn: number | null
          section: string | null
          storage_path: string | null
          updated_at: string | null
          verse_id: string | null
          verse_no: number | null
          voice_id: string | null
        }
        Relationships: []
      }
      canonical_gita_audio: {
        Row: {
          book_id: string | null
          book_slug: string | null
          chapter_no: number | null
          language: string | null
          section: string | null
          storage_path: string | null
          title_en: string | null
          updated_at: string | null
          verse_id: string | null
          verse_no: number | null
          voice_id: string | null
        }
        Relationships: []
      }
      canonical_mahabharat_audio: {
        Row: {
          book_id: string | null
          book_slug: string | null
          chapter_no: number | null
          language: string | null
          section: string | null
          storage_path: string | null
          title_en: string | null
          updated_at: string | null
          verse_id: string | null
          verse_no: number | null
          voice_id: string | null
        }
        Relationships: []
      }
      canonical_ramayan_audio: {
        Row: {
          book_id: string | null
          book_slug: string | null
          chapter_no: number | null
          language: string | null
          section: string | null
          storage_path: string | null
          title_en: string | null
          updated_at: string | null
          verse_id: string | null
          verse_no: number | null
          voice_id: string | null
        }
        Relationships: []
      }
      verse_content_full: {
        Row: {
          book_id: string | null
          chapter_no: number | null
          commentary: string | null
          created_at: string | null
          daily_life_application: string | null
          id: string | null
          language: string | null
          practical_examples: Json | null
          ref: string | null
          title: string | null
          translation: string | null
          updated_at: string | null
          verse_id: string | null
          verse_no: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verse_content_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verses"
            referencedColumns: ["verse_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_gita_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_mahabharat_audio"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "canonical_ramayan_audio"
            referencedColumns: ["book_id"]
          },
        ]
      }
    }
    Functions: {
      audit_audio_sync: {
        Args: never
        Returns: {
          book: string
          chapter_no: number
          language: string
          verse_no: number
        }[]
      }
      generate_all_tts: { Args: { book: string }; Returns: undefined }
      generate_tts_filtered: {
        Args: { book: string; chapter: number; verse: number }
        Returns: undefined
      }
      generate_tts_range:
        | {
            Args: {
              book: string
              chapter: number
              end_verse: number
              start_verse: number
            }
            Returns: undefined
          }
        | {
            Args: { book: string; end_verse: number; start_verse: number }
            Returns: undefined
          }
      get_top_content: {
        Args: { p_action_type: string; p_limit: number }
        Returns: {
          action_count: number
          book_slug: string
          chapter_no: number
          content_id: string
          subtitle: string
          title: string
          verse_no: number
        }[]
      }
      increment_daily_usage: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      upsert_user_progress_resume: {
        Args: {
          p_book_id: string
          p_content_type: string
          p_last_content_id: string
          p_last_position_seconds: number
          p_playback_speed: number
          p_updated_at: string
          p_user_id: string
        }
        Returns: undefined
      }
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

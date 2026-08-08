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
      daily_metrics: {
        Row: {
          created_at: string
          id: string
          log_date: string
          mood: number | null
          notes: string | null
          readiness: number | null
          sleep_hours: number | null
          soreness: number | null
          updated_at: string
          user_id: string
          water_ml: number
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_date: string
          mood?: number | null
          notes?: string | null
          readiness?: number | null
          sleep_hours?: number | null
          soreness?: number | null
          updated_at?: string
          user_id: string
          water_ml?: number
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          mood?: number | null
          notes?: string | null
          readiness?: number | null
          sleep_hours?: number | null
          soreness?: number | null
          updated_at?: string
          user_id?: string
          water_ml?: number
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          alternatives: string[]
          category: string
          confidence: string
          contraindications: string[]
          created_at: string
          created_by: string | null
          data_source: string
          default_reps: string | null
          default_sets: number | null
          difficulty: string
          duration_sec: number | null
          equipment: string[]
          id: string
          instructions: string[]
          min_age: number | null
          muscle_groups: string[]
          name: string
          progressions: string[]
          regressions: string[]
          rest_sec: number | null
          safety_cues: string[]
          setting: string
          slug: string | null
          source_url: string | null
          sports: string[]
          updated_at: string
          verified: boolean
          video_url: string | null
        }
        Insert: {
          alternatives?: string[]
          category?: string
          confidence?: string
          contraindications?: string[]
          created_at?: string
          created_by?: string | null
          data_source?: string
          default_reps?: string | null
          default_sets?: number | null
          difficulty?: string
          duration_sec?: number | null
          equipment?: string[]
          id?: string
          instructions?: string[]
          min_age?: number | null
          muscle_groups?: string[]
          name: string
          progressions?: string[]
          regressions?: string[]
          rest_sec?: number | null
          safety_cues?: string[]
          setting?: string
          slug?: string | null
          source_url?: string | null
          sports?: string[]
          updated_at?: string
          verified?: boolean
          video_url?: string | null
        }
        Update: {
          alternatives?: string[]
          category?: string
          confidence?: string
          contraindications?: string[]
          created_at?: string
          created_by?: string | null
          data_source?: string
          default_reps?: string | null
          default_sets?: number | null
          difficulty?: string
          duration_sec?: number | null
          equipment?: string[]
          id?: string
          instructions?: string[]
          min_age?: number | null
          muscle_groups?: string[]
          name?: string
          progressions?: string[]
          regressions?: string[]
          rest_sec?: number | null
          safety_cues?: string[]
          setting?: string
          slug?: string | null
          source_url?: string | null
          sports?: string[]
          updated_at?: string
          verified?: boolean
          video_url?: string | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          allergens: string[]
          barcode: string | null
          brand: string | null
          calories: number
          carbs: number
          category: string
          confidence: string
          created_at: string
          created_by: string | null
          cuisine: string | null
          data_source: string
          diet_tags: string[]
          est_cost: number | null
          fat: number
          fiber: number
          food_type: string
          id: string
          ingredients: string[]
          micros: Json
          name: string
          protein: number
          recipe_steps: string[]
          region: string | null
          serving_desc: string
          serving_grams: number
          sodium_mg: number | null
          source_url: string | null
          sugar: number | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          allergens?: string[]
          barcode?: string | null
          brand?: string | null
          calories?: number
          carbs?: number
          category?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          data_source?: string
          diet_tags?: string[]
          est_cost?: number | null
          fat?: number
          fiber?: number
          food_type?: string
          id?: string
          ingredients?: string[]
          micros?: Json
          name: string
          protein?: number
          recipe_steps?: string[]
          region?: string | null
          serving_desc?: string
          serving_grams?: number
          sodium_mg?: number | null
          source_url?: string | null
          sugar?: number | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          allergens?: string[]
          barcode?: string | null
          brand?: string | null
          calories?: number
          carbs?: number
          category?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          data_source?: string
          diet_tags?: string[]
          est_cost?: number | null
          fat?: number
          fiber?: number
          food_type?: string
          id?: string
          ingredients?: string[]
          micros?: Json
          name?: string
          protein?: number
          recipe_steps?: string[]
          region?: string | null
          serving_desc?: string
          serving_grams?: number
          sodium_mg?: number | null
          source_url?: string | null
          sugar?: number | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          aisle: string
          amount: string | null
          checked: boolean
          created_at: string
          id: string
          name: string
          reason: string | null
          source: string
          substitutes: Json
          unavailable: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          aisle?: string
          amount?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          name: string
          reason?: string | null
          source?: string
          substitutes?: Json
          unavailable?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          aisle?: string
          amount?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          reason?: string | null
          source?: string
          substitutes?: Json
          unavailable?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_consents: {
        Row: {
          consent_version: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          revoked_at: string | null
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_version?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_version?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_flags: {
        Row: {
          acknowledged: boolean
          blocks_diet: boolean
          blocks_training: boolean
          category: string
          created_at: string
          evidence: Json
          id: string
          level: string
          message: string
          report_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          blocks_diet?: boolean
          blocks_training?: boolean
          category?: string
          created_at?: string
          evidence?: Json
          id?: string
          level?: string
          message: string
          report_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          blocks_diet?: boolean
          blocks_training?: boolean
          category?: string
          created_at?: string
          evidence?: Json
          id?: string
          level?: string
          message?: string
          report_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_flags_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "health_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      health_reports: {
        Row: {
          alert_level: string
          blocks_plan: boolean
          created_at: string
          extracted: Json
          file_mime: string | null
          file_path: string | null
          id: string
          missing_fields: Json
          notes: string | null
          profile_mismatches: Json
          reminder_enabled: boolean
          reminder_time: string
          report_date: string | null
          report_type: string
          review_date: string | null
          reviewed_by_professional: boolean
          summary: string | null
          title: string
          updated_at: string
          upload_status: string
          user_id: string
        }
        Insert: {
          alert_level?: string
          blocks_plan?: boolean
          created_at?: string
          extracted?: Json
          file_mime?: string | null
          file_path?: string | null
          id?: string
          missing_fields?: Json
          notes?: string | null
          profile_mismatches?: Json
          reminder_enabled?: boolean
          reminder_time?: string
          report_date?: string | null
          report_type?: string
          review_date?: string | null
          reviewed_by_professional?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
          upload_status?: string
          user_id: string
        }
        Update: {
          alert_level?: string
          blocks_plan?: boolean
          created_at?: string
          extracted?: Json
          file_mime?: string | null
          file_path?: string | null
          id?: string
          missing_fields?: Json
          notes?: string | null
          profile_mismatches?: Json
          reminder_enabled?: boolean
          reminder_time?: string
          report_date?: string | null
          report_type?: string
          review_date?: string | null
          reviewed_by_professional?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
          upload_status?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          analysis: Json
          calories: number
          carbs: number
          consumed_at: string
          created_at: string
          fat: number
          fiber: number
          foods: Json
          grade: string | null
          id: string
          meal_score: number | null
          meal_type: string | null
          micros: Json
          name: string
          protein: number
          user_id: string
        }
        Insert: {
          analysis?: Json
          calories?: number
          carbs?: number
          consumed_at?: string
          created_at?: string
          fat?: number
          fiber?: number
          foods?: Json
          grade?: string | null
          id?: string
          meal_score?: number | null
          meal_type?: string | null
          micros?: Json
          name: string
          protein?: number
          user_id: string
        }
        Update: {
          analysis?: Json
          calories?: number
          carbs?: number
          consumed_at?: string
          created_at?: string
          fat?: number
          fiber?: number
          foods?: Json
          grade?: string | null
          id?: string
          meal_score?: number | null
          meal_type?: string | null
          micros?: Json
          name?: string
          protein?: number
          user_id?: string
        }
        Relationships: []
      }
      pantry_scans: {
        Row: {
          best_pick: string | null
          created_at: string
          id: string
          items: Json
          meal_ideas: Json
          missing_staples: Json
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_pick?: string | null
          created_at?: string
          id?: string
          items?: Json
          meal_ideas?: Json
          missing_staples?: Json
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_pick?: string | null
          created_at?: string
          id?: string
          items?: Json
          meal_ideas?: Json
          missing_staples?: Json
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_adjustments: {
        Row: {
          adherence_pct: number | null
          applied_on: string
          created_at: string
          id: string
          new_calories: number | null
          new_protein: number | null
          old_calories: number | null
          old_protein: number | null
          reason: string
          safety_note: string | null
          trend_kg_per_week: number | null
          user_id: string
        }
        Insert: {
          adherence_pct?: number | null
          applied_on?: string
          created_at?: string
          id?: string
          new_calories?: number | null
          new_protein?: number | null
          old_calories?: number | null
          old_protein?: number | null
          reason: string
          safety_note?: string | null
          trend_kg_per_week?: number | null
          user_id: string
        }
        Update: {
          adherence_pct?: number | null
          applied_on?: string
          created_at?: string
          id?: string
          new_calories?: number | null
          new_protein?: number | null
          old_calories?: number | null
          old_protein?: number | null
          reason?: string
          safety_note?: string | null
          trend_kg_per_week?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          allergies: string[]
          calorie_target: number | null
          carbs_target: number | null
          competition_level: string | null
          conditions: string[] | null
          consent_ai: boolean
          consent_analytics: boolean
          country: string | null
          created_at: string
          daily_budget: number | null
          daily_schedule: string | null
          equipment: string[]
          fat_target: number | null
          fiber_target: number | null
          fitness_level: string | null
          food_preference: string | null
          full_name: string | null
          gender: string | null
          goal: string | null
          goals: string[]
          height_cm: number | null
          id: string
          lifestyle: string[] | null
          medications: string[] | null
          onboarded: boolean
          protein_target: number | null
          reminder_times: Json
          reminders_enabled: boolean
          season_phase: string | null
          sleep_time: string | null
          sport: string | null
          sport_discipline: string | null
          sport_event: string | null
          sport_position: string | null
          theme: string
          timezone: string | null
          training_days_per_week: number | null
          training_hours_per_day: number | null
          training_schedule: Json
          updated_at: string
          wake_time: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[]
          calorie_target?: number | null
          carbs_target?: number | null
          competition_level?: string | null
          conditions?: string[] | null
          consent_ai?: boolean
          consent_analytics?: boolean
          country?: string | null
          created_at?: string
          daily_budget?: number | null
          daily_schedule?: string | null
          equipment?: string[]
          fat_target?: number | null
          fiber_target?: number | null
          fitness_level?: string | null
          food_preference?: string | null
          full_name?: string | null
          gender?: string | null
          goal?: string | null
          goals?: string[]
          height_cm?: number | null
          id: string
          lifestyle?: string[] | null
          medications?: string[] | null
          onboarded?: boolean
          protein_target?: number | null
          reminder_times?: Json
          reminders_enabled?: boolean
          season_phase?: string | null
          sleep_time?: string | null
          sport?: string | null
          sport_discipline?: string | null
          sport_event?: string | null
          sport_position?: string | null
          theme?: string
          timezone?: string | null
          training_days_per_week?: number | null
          training_hours_per_day?: number | null
          training_schedule?: Json
          updated_at?: string
          wake_time?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[]
          calorie_target?: number | null
          carbs_target?: number | null
          competition_level?: string | null
          conditions?: string[] | null
          consent_ai?: boolean
          consent_analytics?: boolean
          country?: string | null
          created_at?: string
          daily_budget?: number | null
          daily_schedule?: string | null
          equipment?: string[]
          fat_target?: number | null
          fiber_target?: number | null
          fitness_level?: string | null
          food_preference?: string | null
          full_name?: string | null
          gender?: string | null
          goal?: string | null
          goals?: string[]
          height_cm?: number | null
          id?: string
          lifestyle?: string[] | null
          medications?: string[] | null
          onboarded?: boolean
          protein_target?: number | null
          reminder_times?: Json
          reminders_enabled?: boolean
          season_phase?: string | null
          sleep_time?: string | null
          sport?: string | null
          sport_discipline?: string | null
          sport_event?: string | null
          sport_position?: string | null
          theme?: string
          timezone?: string | null
          training_days_per_week?: number | null
          training_hours_per_day?: number | null
          training_schedule?: Json
          updated_at?: string
          wake_time?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      program_report_requirements: {
        Row: {
          countdown_days: number
          created_at: string
          daily_reminder: boolean
          due_date: string | null
          id: string
          program: string
          region: string
          required: boolean
          required_report_types: Json
          satisfied_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          countdown_days?: number
          created_at?: string
          daily_reminder?: boolean
          due_date?: string | null
          id?: string
          program: string
          region?: string
          required?: boolean
          required_report_types?: Json
          satisfied_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          countdown_days?: number
          created_at?: string
          daily_reminder?: boolean
          due_date?: string | null
          id?: string
          program?: string
          region?: string
          required?: boolean
          required_report_types?: Json
          satisfied_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_report_requirements_satisfied_by_fkey"
            columns: ["satisfied_by"]
            isOneToOne: false
            referencedRelation: "health_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          aliases: string[]
          category: string
          confidence: string
          contact_level: string
          created_at: string
          created_by: string | null
          data_source: string
          disciplines: string[]
          energy_aerobic: number
          energy_alactic: number
          energy_glycolytic: number
          events: string[]
          id: string
          name: string
          popularity: number
          positions: string[]
          primary_qualities: string[]
          slug: string | null
          typical_season: string | null
          updated_at: string
          weight_sensitive: boolean
        }
        Insert: {
          aliases?: string[]
          category?: string
          confidence?: string
          contact_level?: string
          created_at?: string
          created_by?: string | null
          data_source?: string
          disciplines?: string[]
          energy_aerobic?: number
          energy_alactic?: number
          energy_glycolytic?: number
          events?: string[]
          id?: string
          name: string
          popularity?: number
          positions?: string[]
          primary_qualities?: string[]
          slug?: string | null
          typical_season?: string | null
          updated_at?: string
          weight_sensitive?: boolean
        }
        Update: {
          aliases?: string[]
          category?: string
          confidence?: string
          contact_level?: string
          created_at?: string
          created_by?: string | null
          data_source?: string
          disciplines?: string[]
          energy_aerobic?: number
          energy_alactic?: number
          energy_glycolytic?: number
          events?: string[]
          id?: string
          name?: string
          popularity?: number
          positions?: string[]
          primary_qualities?: string[]
          slug?: string | null
          typical_season?: string | null
          updated_at?: string
          weight_sensitive?: boolean
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          active: boolean
          adjustments: Json
          age_range: string | null
          created_at: string
          days_per_week: number
          equipment: string[]
          fitness_level: string | null
          focus: string[]
          goal: string | null
          id: string
          inputs_signature: string | null
          name: string
          rationale: string | null
          safety_notes: string[]
          session_minutes: number
          sport: string | null
          updated_at: string
          user_id: string
          week: Json
        }
        Insert: {
          active?: boolean
          adjustments?: Json
          age_range?: string | null
          created_at?: string
          days_per_week?: number
          equipment?: string[]
          fitness_level?: string | null
          focus?: string[]
          goal?: string | null
          id?: string
          inputs_signature?: string | null
          name?: string
          rationale?: string | null
          safety_notes?: string[]
          session_minutes?: number
          sport?: string | null
          updated_at?: string
          user_id: string
          week?: Json
        }
        Update: {
          active?: boolean
          adjustments?: Json
          age_range?: string | null
          created_at?: string
          days_per_week?: number
          equipment?: string[]
          fitness_level?: string | null
          focus?: string[]
          goal?: string | null
          id?: string
          inputs_signature?: string | null
          name?: string
          rationale?: string | null
          safety_notes?: string[]
          session_minutes?: number
          sport?: string | null
          updated_at?: string
          user_id?: string
          week?: Json
        }
        Relationships: []
      }
      workouts: {
        Row: {
          blocks: Json
          calories_burned: number | null
          completed: boolean
          created_at: string
          duration_min: number
          exercises: Json
          id: string
          intensity: string
          name: string
          notes: string | null
          perceived_effort: number | null
          plan_id: string | null
          rest_day: boolean
          scheduled_for: string
          updated_at: string
          user_id: string
          workout_type: string
        }
        Insert: {
          blocks?: Json
          calories_burned?: number | null
          completed?: boolean
          created_at?: string
          duration_min?: number
          exercises?: Json
          id?: string
          intensity?: string
          name: string
          notes?: string | null
          perceived_effort?: number | null
          plan_id?: string | null
          rest_day?: boolean
          scheduled_for?: string
          updated_at?: string
          user_id: string
          workout_type?: string
        }
        Update: {
          blocks?: Json
          calories_burned?: number | null
          completed?: boolean
          created_at?: string
          duration_min?: number
          exercises?: Json
          id?: string
          intensity?: string
          name?: string
          notes?: string | null
          perceived_effort?: number | null
          plan_id?: string | null
          rest_day?: boolean
          scheduled_for?: string
          updated_at?: string
          user_id?: string
          workout_type?: string
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

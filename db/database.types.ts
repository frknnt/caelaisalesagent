export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_type: string;
          actor_user_id: string | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: NonNullable<Json>;
          occurred_at: string;
          organization_id: string;
          outcome: string;
          request_id: string | null;
          site_id: string | null;
          trace_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_type: string;
          actor_user_id?: string | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          organization_id: string;
          outcome: string;
          request_id?: string | null;
          site_id?: string | null;
          trace_id?: string | null;
        };
        Update: {
          action?: string;
          actor_type?: string;
          actor_user_id?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          organization_id?: string;
          outcome?: string;
          request_id?: string | null;
          site_id?: string | null;
          trace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      domains: {
        Row: {
          allow_subdomains: boolean;
          created_at: string;
          environment: string;
          expires_at: string | null;
          hostname: string;
          id: string;
          is_primary: boolean;
          organization_id: string;
          site_id: string;
          verification_method: string | null;
          verification_token: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          allow_subdomains?: boolean;
          created_at?: string;
          environment?: string;
          expires_at?: string | null;
          hostname: string;
          id?: string;
          is_primary?: boolean;
          organization_id: string;
          site_id: string;
          verification_method?: string | null;
          verification_token?: string;
          verified_at?: string | null;
        };
        Update: {
          allow_subdomains?: boolean;
          created_at?: string;
          environment?: string;
          expires_at?: string | null;
          hostname?: string;
          id?: string;
          is_primary?: boolean;
          organization_id?: string;
          site_id?: string;
          verification_method?: string | null;
          verification_token?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "domains_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      llm_call_metrics: {
        Row: {
          attempt: number;
          cached_input_tokens: number | null;
          cost_micros: number | null;
          currency: string;
          id: string;
          input_tokens: number | null;
          is_simulated: boolean;
          latency_ms: number;
          model: string;
          occurred_at: string;
          organization_id: string;
          outcome: string;
          output_tokens: number | null;
          pricing_version: string | null;
          provider: string;
          purpose: string;
          request_id: string;
          site_id: string | null;
          trace_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt?: number;
          cached_input_tokens?: number | null;
          cost_micros?: number | null;
          currency?: string;
          id: string;
          input_tokens?: number | null;
          is_simulated: boolean;
          latency_ms: number;
          model: string;
          occurred_at?: string;
          organization_id: string;
          outcome: string;
          output_tokens?: number | null;
          pricing_version?: string | null;
          provider: string;
          purpose: string;
          request_id: string;
          site_id?: string | null;
          trace_id: string;
        };
        Update: {
          attempt?: number;
          cached_input_tokens?: number | null;
          cost_micros?: number | null;
          currency?: string;
          id?: string;
          input_tokens?: number | null;
          is_simulated?: boolean;
          latency_ms?: number;
          model?: string;
          occurred_at?: string;
          organization_id?: string;
          outcome?: string;
          output_tokens?: number | null;
          pricing_version?: string | null;
          provider?: string;
          purpose?: string;
          request_id?: string;
          site_id?: string | null;
          trace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "llm_call_metrics_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "llm_call_metrics_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          organization_id: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          organization_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          revoked_at: string | null;
          role: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          organization_id: string;
          revoked_at?: string | null;
          role: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          revoked_at?: string | null;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          public_name: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          public_name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          public_name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          environment: string;
          expires_at: string | null;
          id: string;
          organization_id: string;
          public_key: string;
          revoked_at: string | null;
          site_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          environment: string;
          expires_at?: string | null;
          id?: string;
          organization_id: string;
          public_key?: string;
          revoked_at?: string | null;
          site_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          environment?: string;
          expires_at?: string | null;
          id?: string;
          organization_id?: string;
          public_key?: string;
          revoked_at?: string | null;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_keys_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_keys_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      sites: {
        Row: {
          created_at: string;
          default_locale: string;
          handoff_url: string | null;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          public_name: string;
          updated_at: string;
          widget_accent_color: string;
          widget_position: string;
          widget_title: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_locale?: string;
          handoff_url?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
          public_name: string;
          updated_at?: string;
          widget_accent_color?: string;
          widget_position?: string;
          widget_title: string;
        };
        Update: {
          created_at?: string;
          default_locale?: string;
          handoff_url?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          public_name?: string;
          updated_at?: string;
          widget_accent_color?: string;
          widget_position?: string;
          widget_title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      widget_sessions: {
        Row: {
          bootstrap_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          organization_id: string;
          origin: string;
          revoked_at: string | null;
          site_id: string;
          site_key_id: string;
        };
        ComputedFields: never;
        Insert: {
          bootstrap_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          organization_id: string;
          origin: string;
          revoked_at?: string | null;
          site_id: string;
          site_key_id: string;
        };
        Update: {
          bootstrap_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          origin?: string;
          revoked_at?: string | null;
          site_id?: string;
          site_key_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "widget_sessions_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "widget_sessions_site_key_id_fkey";
            columns: ["site_key_id"];
            isOneToOne: false;
            referencedRelation: "site_keys";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_organization_invitation: {
        Args: { p_invitation_id: string };
        Returns: {
          created_at: string;
          organization_id: string;
          role: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "memberships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_preview_domain: {
        Args: { p_expires_at: string; p_hostname: string; p_site_id: string };
        Returns: {
          allow_subdomains: boolean;
          created_at: string;
          environment: string;
          expires_at: string | null;
          hostname: string;
          id: string;
          is_primary: boolean;
          organization_id: string;
          site_id: string;
          verification_method: string | null;
          verification_token: string;
          verified_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "domains";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      change_organization_member_role: {
        Args: { p_organization_id: string; p_role: string; p_user_id: string };
        Returns: {
          created_at: string;
          organization_id: string;
          role: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "memberships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      check_widget_session: {
        Args: {
          p_hostname: string;
          p_origin: string;
          p_session_id: string;
          p_site_key_id: string;
        };
        Returns: {
          expires_at: string;
          organization_id: string;
          outcome: string;
          retry_after: number;
          site_id: string;
        }[];
      };
      create_organization_invitation: {
        Args: {
          p_email: string;
          p_expires_at: string;
          p_organization_id: string;
          p_role: string;
        };
        Returns: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          revoked_at: string | null;
          role: string;
        };
        SetofOptions: {
          from: "*";
          to: "organization_invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_site_key: {
        Args: {
          p_environment: string;
          p_expires_at?: string;
          p_site_id: string;
        };
        Returns: {
          created_at: string;
          created_by: string | null;
          environment: string;
          expires_at: string | null;
          id: string;
          organization_id: string;
          public_key: string;
          revoked_at: string | null;
          site_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "site_keys";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_widget_session: {
        Args: {
          p_bootstrap_id: string;
          p_client_hash: string;
          p_hostname: string;
          p_origin: string;
          p_site_key_id: string;
          p_ttl_seconds: number;
        };
        Returns: {
          expires_at: string;
          outcome: string;
          retry_after: number;
          session_id: string;
          site_id: string;
        }[];
      };
      get_authorization_context: {
        Args: Record<PropertyKey, never>;
        Returns: {
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          role: string;
        }[];
      };
      purge_widget_runtime: {
        Args: Record<PropertyKey, never>;
        Returns: {
          removed_counters: number;
          removed_sessions: number;
        }[];
      };
      remove_organization_member: {
        Args: { p_organization_id: string; p_user_id: string };
        Returns: undefined;
      };
      revoke_organization_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      revoke_site_key: { Args: { p_key_id: string }; Returns: undefined };
      widget_bootstrap: {
        Args: {
          p_client_hash: string;
          p_hostname: string;
          p_public_key: string;
        };
        Returns: {
          accent_color: string;
          environment: string;
          handoff_url: string;
          locale: string;
          organization_id: string;
          outcome: string;
          retry_after: number;
          site_id: string;
          site_key_id: string;
          site_name: string;
          widget_position: string;
          widget_title: string;
        }[];
      };
      widget_frame: {
        Args: {
          p_client_hash: string;
          p_hostname: string;
          p_site_key_id: string;
        };
        Returns: {
          accent_color: string;
          handoff_url: string;
          locale: string;
          outcome: string;
          retry_after: number;
          site_id: string;
          site_name: string;
          widget_title: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

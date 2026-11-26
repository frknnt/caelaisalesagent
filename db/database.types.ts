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
      chunks: {
        Row: {
          content: string;
          content_sha256: string;
          created_at: string;
          document_id: string;
          embedded_at: string | null;
          embedding: string | null;
          embedding_model: string | null;
          end_line: number;
          has_price: boolean;
          id: string;
          ordinal: number;
          organization_id: string;
          pii_types: string[];
          price_line_numbers: number[];
          search_vector: unknown;
          site_id: string;
          source_id: string;
          start_line: number;
          version_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          content_sha256: string;
          created_at?: string;
          document_id: string;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_model?: string | null;
          end_line?: number;
          has_price?: boolean;
          id?: string;
          ordinal: number;
          organization_id: string;
          pii_types?: string[];
          price_line_numbers?: number[];
          search_vector?: never;
          site_id: string;
          source_id: string;
          start_line?: number;
          version_id: string;
        };
        Update: {
          content?: string;
          content_sha256?: string;
          created_at?: string;
          document_id?: string;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_model?: string | null;
          end_line?: number;
          has_price?: boolean;
          id?: string;
          ordinal?: number;
          organization_id?: string;
          pii_types?: string[];
          price_line_numbers?: number[];
          search_vector?: never;
          site_id?: string;
          source_id?: string;
          start_line?: number;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chunks_organization_id_document_id_fkey";
            columns: ["organization_id", "document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "chunks_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "chunks_organization_id_source_id_fkey";
            columns: ["organization_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_sources";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "chunks_organization_id_version_id_fkey";
            columns: ["organization_id", "version_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_versions";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
          organization_id: string;
          site_id: string;
          status: string;
          summarized_through: string | null;
          summary: string | null;
          visitor_id: string;
          visitor_message_count: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          organization_id: string;
          site_id: string;
          status?: string;
          summarized_through?: string | null;
          summary?: string | null;
          visitor_id: string;
          visitor_message_count?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          organization_id?: string;
          site_id?: string;
          status?: string;
          summarized_through?: string | null;
          summary?: string | null;
          visitor_id?: string;
          visitor_message_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "conversations_organization_id_visitor_id_fkey";
            columns: ["organization_id", "visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitor_identities";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      documents: {
        Row: {
          byte_size: number;
          canonical_url: string | null;
          content_sha256: string;
          created_at: string;
          id: string;
          malware_status: string;
          mime_type: string;
          organization_id: string;
          page_reference: string | null;
          raw_delete_claimed_at: string | null;
          raw_deleted_at: string | null;
          raw_retention_until: string | null;
          site_id: string;
          source_id: string;
          storage_bucket: string | null;
          storage_path: string | null;
          title: string;
          version_id: string;
        };
        ComputedFields: never;
        Insert: {
          byte_size: number;
          canonical_url?: string | null;
          content_sha256: string;
          created_at?: string;
          id?: string;
          malware_status?: string;
          mime_type: string;
          organization_id: string;
          page_reference?: string | null;
          raw_delete_claimed_at?: string | null;
          raw_deleted_at?: string | null;
          raw_retention_until?: string | null;
          site_id: string;
          source_id: string;
          storage_bucket?: string | null;
          storage_path?: string | null;
          title: string;
          version_id: string;
        };
        Update: {
          byte_size?: number;
          canonical_url?: string | null;
          content_sha256?: string;
          created_at?: string;
          id?: string;
          malware_status?: string;
          mime_type?: string;
          organization_id?: string;
          page_reference?: string | null;
          raw_delete_claimed_at?: string | null;
          raw_deleted_at?: string | null;
          raw_retention_until?: string | null;
          site_id?: string;
          source_id?: string;
          storage_bucket?: string | null;
          storage_path?: string | null;
          title?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "documents_organization_id_source_id_fkey";
            columns: ["organization_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_sources";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "documents_organization_id_version_id_fkey";
            columns: ["organization_id", "version_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_versions";
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
      ingestion_jobs: {
        Row: {
          attempt_count: number;
          created_at: string;
          finished_at: string | null;
          id: string;
          idempotency_key: string;
          last_error_code: string | null;
          max_attempts: number;
          next_attempt_at: string | null;
          organization_id: string;
          progress: number;
          queue_message_id: number | null;
          site_id: string;
          source_id: string;
          started_at: string | null;
          status: string;
          updated_at: string;
          version_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          idempotency_key: string;
          last_error_code?: string | null;
          max_attempts?: number;
          next_attempt_at?: string | null;
          organization_id: string;
          progress?: number;
          queue_message_id?: number | null;
          site_id: string;
          source_id: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          version_id: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string;
          last_error_code?: string | null;
          max_attempts?: number;
          next_attempt_at?: string | null;
          organization_id?: string;
          progress?: number;
          queue_message_id?: number | null;
          site_id?: string;
          source_id?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "ingestion_jobs_organization_id_source_id_fkey";
            columns: ["organization_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_sources";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "ingestion_jobs_organization_id_version_id_fkey";
            columns: ["organization_id", "version_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_versions";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      knowledge_sources: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          canonical_url: string | null;
          created_at: string;
          created_by: string;
          current_version_id: string | null;
          disabled_at: string | null;
          disabled_by: string | null;
          fresh_until: string | null;
          freshness_checked_at: string | null;
          freshness_ttl: string;
          id: string;
          last_crawled_at: string | null;
          last_reindex_requested_at: string | null;
          latest_error_code: string | null;
          name: string;
          next_recrawl_at: string | null;
          organization_id: string;
          progress: number;
          publication_status: string;
          site_id: string;
          source_key: string;
          source_type: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          canonical_url?: string | null;
          created_at?: string;
          created_by: string;
          current_version_id?: string | null;
          disabled_at?: string | null;
          disabled_by?: string | null;
          fresh_until?: string | null;
          freshness_checked_at?: string | null;
          freshness_ttl?: string;
          id?: string;
          last_crawled_at?: string | null;
          last_reindex_requested_at?: string | null;
          latest_error_code?: string | null;
          name: string;
          next_recrawl_at?: string | null;
          organization_id: string;
          progress?: number;
          publication_status?: string;
          site_id: string;
          source_key: string;
          source_type: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          canonical_url?: string | null;
          created_at?: string;
          created_by?: string;
          current_version_id?: string | null;
          disabled_at?: string | null;
          disabled_by?: string | null;
          fresh_until?: string | null;
          freshness_checked_at?: string | null;
          freshness_ttl?: string;
          id?: string;
          last_crawled_at?: string | null;
          last_reindex_requested_at?: string | null;
          latest_error_code?: string | null;
          name?: string;
          next_recrawl_at?: string | null;
          organization_id?: string;
          progress?: number;
          publication_status?: string;
          site_id?: string;
          source_key?: string;
          source_type?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_sources_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_sources_current_version_fkey";
            columns: ["organization_id", "current_version_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_versions";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "knowledge_sources_disabled_by_fkey";
            columns: ["disabled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_sources_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      knowledge_versions: {
        Row: {
          content_sha256: string;
          created_at: string;
          created_by: string;
          extracted_at: string | null;
          id: string;
          input_text: string | null;
          organization_id: string;
          site_id: string;
          source_id: string;
          status: string;
          version_number: number;
        };
        ComputedFields: never;
        Insert: {
          content_sha256: string;
          created_at?: string;
          created_by: string;
          extracted_at?: string | null;
          id?: string;
          input_text?: string | null;
          organization_id: string;
          site_id: string;
          source_id: string;
          status?: string;
          version_number: number;
        };
        Update: {
          content_sha256?: string;
          created_at?: string;
          created_by?: string;
          extracted_at?: string | null;
          id?: string;
          input_text?: string | null;
          organization_id?: string;
          site_id?: string;
          source_id?: string;
          status?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_versions_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "knowledge_versions_organization_id_source_id_fkey";
            columns: ["organization_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_sources";
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
      messages: {
        Row: {
          attempts: number;
          body: string;
          citations: NonNullable<Json>;
          claimed_at: string | null;
          client_message_id: string | null;
          conversation_id: string;
          created_at: string;
          feedback: number | null;
          handoff: boolean;
          id: string;
          organization_id: string;
          prompt_version: string | null;
          reply_to: string | null;
          role: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          body?: string;
          citations?: NonNullable<Json>;
          claimed_at?: string | null;
          client_message_id?: string | null;
          conversation_id: string;
          created_at?: string;
          feedback?: number | null;
          handoff?: boolean;
          id?: string;
          organization_id: string;
          prompt_version?: string | null;
          reply_to?: string | null;
          role: string;
          status?: string;
        };
        Update: {
          attempts?: number;
          body?: string;
          citations?: NonNullable<Json>;
          claimed_at?: string | null;
          client_message_id?: string | null;
          conversation_id?: string;
          created_at?: string;
          feedback?: number | null;
          handoff?: boolean;
          id?: string;
          organization_id?: string;
          prompt_version?: string | null;
          reply_to?: string | null;
          role?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_conversation_id_fkey";
            columns: ["organization_id", "conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "messages_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: true;
            referencedRelation: "messages";
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
      visitor_consents: {
        Row: {
          granted: boolean;
          id: string;
          organization_id: string;
          purpose: string;
          recorded_at: string;
          site_id: string;
          source: string;
          text_version: string;
          visitor_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted: boolean;
          id?: string;
          organization_id: string;
          purpose: string;
          recorded_at?: string;
          site_id: string;
          source: string;
          text_version: string;
          visitor_id: string;
        };
        Update: {
          granted?: boolean;
          id?: string;
          organization_id?: string;
          purpose?: string;
          recorded_at?: string;
          site_id?: string;
          source?: string;
          text_version?: string;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visitor_consents_organization_id_visitor_id_fkey";
            columns: ["organization_id", "visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitor_identities";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      visitor_identities: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string;
          memory_consent_at: string | null;
          memory_consent_text_version: string | null;
          organization_id: string;
          secret_hash: string;
          site_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          memory_consent_at?: string | null;
          memory_consent_text_version?: string | null;
          organization_id: string;
          secret_hash: string;
          site_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          memory_consent_at?: string | null;
          memory_consent_text_version?: string | null;
          organization_id?: string;
          secret_hash?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visitor_identities_organization_id_site_id_fkey";
            columns: ["organization_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      visitor_sessions: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          resumed: boolean;
          site_id: string;
          visitor_id: string;
          widget_session_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          resumed: boolean;
          site_id: string;
          visitor_id: string;
          widget_session_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          resumed?: boolean;
          site_id?: string;
          visitor_id?: string;
          widget_session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visitor_sessions_organization_id_visitor_id_fkey";
            columns: ["organization_id", "visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitor_identities";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "visitor_sessions_widget_session_id_fkey";
            columns: ["widget_session_id"];
            isOneToOne: true;
            referencedRelation: "widget_sessions";
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
      claim_expired_knowledge_files: {
        Args: { p_limit?: number };
        Returns: {
          document_id: string;
          storage_bucket: string;
          storage_path: string;
        }[];
      };
      claim_ingestion_job: {
        Args: { p_visibility_seconds?: number };
        Returns: {
          attempt_count: number;
          canonical_url: string;
          input_text: string;
          job_id: string;
          max_attempts: number;
          message_id: number;
          organization_id: string;
          site_id: string;
          source_id: string;
          source_type: string;
          version_id: string;
        }[];
      };
      complete_ingestion_job: {
        Args: { p_job_id: string; p_message_id: number };
        Returns: undefined;
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
      enqueue_due_knowledge_recrawls: {
        Args: { p_limit?: number };
        Returns: number;
      };
      enqueue_knowledge_source: {
        Args: {
          p_canonical_url?: string;
          p_content_sha256: string;
          p_input_text?: string;
          p_max_attempts?: number;
          p_name: string;
          p_organization_id: string;
          p_site_id: string;
          p_source_key: string;
          p_source_type: string;
        };
        Returns: {
          is_duplicate: boolean;
          job_id: string;
          source_id: string;
          version_id: string;
        }[];
      };
      fail_ingestion_job: {
        Args: {
          p_error_code: string;
          p_job_id: string;
          p_message_id: number;
          p_retry_delay_seconds?: number;
          p_retryable: boolean;
        };
        Returns: string;
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
      mark_knowledge_file_deleted: {
        Args: { p_document_id: string };
        Returns: undefined;
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
      request_knowledge_reindex: {
        Args: { p_source_id: string };
        Returns: string;
      };
      retrieve_approved_knowledge: {
        Args: {
          p_match_count?: number;
          p_organization_id: string;
          p_query_embedding?: string;
          p_query_text: string;
          p_rrf_k?: number;
          p_site_id: string;
        };
        Returns: {
          chunk_id: string;
          fresh_until: string;
          fused_score: number;
          lexical_rank: number;
          page_reference: string;
          semantic_rank: number;
          snippet: string;
          source_id: string;
          source_title: string;
          source_url: string;
        }[];
      };
      retry_ingestion_job: { Args: { p_job_id: string }; Returns: number };
      revoke_organization_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      revoke_site_key: { Args: { p_key_id: string }; Returns: undefined };
      set_knowledge_source_lifecycle: {
        Args: { p_publication_status: string; p_source_id: string };
        Returns: {
          fresh_until: string;
          publication_status: string;
          source_id: string;
        }[];
      };
      update_ingestion_progress: {
        Args: { p_job_id: string; p_progress: number };
        Returns: undefined;
      };
      widget_attach_visitor: {
        Args: {
          p_new_secret_hash: string;
          p_secret_hash: string;
          p_widget_session_id: string;
        };
        Returns: {
          conversation_id: string;
          memory_consent: boolean;
          outcome: string;
          resumed: boolean;
          visitor_id: string;
        }[];
      };
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
      widget_complete_reply: {
        Args: {
          p_body: string;
          p_citations: Json;
          p_handoff: boolean;
          p_prompt_version: string;
          p_reply_id: string;
          p_status: string;
        };
        Returns: boolean;
      };
      widget_conversation: {
        Args: { p_limit: number; p_widget_session_id: string };
        Returns: {
          body: string;
          citations: Json;
          client_message_id: string;
          conversation_id: string;
          created_at: string;
          feedback: number;
          handoff: boolean;
          memory_consent: boolean;
          message_id: string;
          reply_to: string;
          role: string;
          status: string;
          summarized_through: string;
          summary: string;
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
      widget_post_message: {
        Args: {
          p_body: string;
          p_client_message_id: string;
          p_widget_session_id: string;
        };
        Returns: {
          conversation_id: string;
          message_id: string;
          outcome: string;
          reply_body: string;
          reply_citations: Json;
          reply_handoff: boolean;
          reply_id: string;
          reply_status: string;
          retry_after: number;
        }[];
      };
      widget_set_feedback: {
        Args: {
          p_message_id: string;
          p_value: number;
          p_widget_session_id: string;
        };
        Returns: boolean;
      };
      widget_set_memory_consent: {
        Args: {
          p_granted: boolean;
          p_text_version: string;
          p_widget_session_id: string;
        };
        Returns: boolean;
      };
      widget_update_summary: {
        Args: {
          p_conversation_id: string;
          p_summary: string;
          p_through: string;
        };
        Returns: boolean;
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

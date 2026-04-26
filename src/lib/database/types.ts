// Database types - Generated from Supabase schema
// These types should be regenerated when schema changes

export type UserRole = 'admin' | 'customer' | 'store' | 'guest';
export type AuthProvider = 'email' | 'phone' | 'google' | 'facebook' | 'apple';
export type ProductCategory = string;
export type AvailabilityStatus = 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type NotificationType = 'price_drop' | 'back_in_stock' | 'deal_alert' | 'deal' | 'system' | 'account';
export type StoreStatus = 'active' | 'pending' | 'suspended' | 'inactive';
export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

// Type aliases for common table rows
export type ProductReview = Database['public']['Tables']['product_reviews']['Row'];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          full_name: string | null;
          role: UserRole;
          auth_provider: AuthProvider;
          auth_provider_id: string | null;
          avatar_url: string | null;
          email_verified: boolean;
          phone_verified: boolean;
          preferred_language: string;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          full_name?: string | null;
          role?: UserRole;
          auth_provider?: AuthProvider;
          auth_provider_id?: string | null;
          avatar_url?: string | null;
          email_verified?: boolean;
          phone_verified?: boolean;
          preferred_language?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          full_name?: string | null;
          role?: UserRole;
          auth_provider?: AuthProvider;
          auth_provider_id?: string | null;
          avatar_url?: string | null;
          email_verified?: boolean;
          phone_verified?: boolean;
          preferred_language?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          name_ar: string;
          name_en: string;
          slug: string;
          logo_url: string | null;
          website_url: string;
          description_ar: string | null;
          description_en: string | null;
          status: StoreStatus;
          contact_email: string | null;
          contact_phone: string | null;
          api_endpoint: string | null;
          requires_scraping: boolean;
          last_sync_at: string | null;
          delivery_info_ar: string | null;
          delivery_info_en: string | null;
          return_policy_ar: string | null;
          return_policy_en: string | null;
          warranty_info_ar: string | null;
          warranty_info_en: string | null;
          average_rating: number;
          total_reviews: number;
          total_products: number;
          commission_rate: number;
          affiliate_config: Record<string, unknown> | null;
          is_premium: boolean;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name_ar: string;
          name_en: string;
          slug: string;
          logo_url?: string | null;
          website_url: string;
          description_ar?: string | null;
          description_en?: string | null;
          status?: StoreStatus;
          contact_email?: string | null;
          contact_phone?: string | null;
          api_endpoint?: string | null;
          requires_scraping?: boolean;
          last_sync_at?: string | null;
          delivery_info_ar?: string | null;
          delivery_info_en?: string | null;
          return_policy_ar?: string | null;
          return_policy_en?: string | null;
          warranty_info_ar?: string | null;
          warranty_info_en?: string | null;
          average_rating?: number;
          total_reviews?: number;
          total_products?: number;
          commission_rate?: number;
          affiliate_config?: Record<string, unknown> | null;
          is_premium?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name_ar?: string;
          name_en?: string;
          slug?: string;
          logo_url?: string | null;
          website_url?: string;
          description_ar?: string | null;
          description_en?: string | null;
          status?: StoreStatus;
          contact_email?: string | null;
          contact_phone?: string | null;
          api_endpoint?: string | null;
          requires_scraping?: boolean;
          last_sync_at?: string | null;
          delivery_info_ar?: string | null;
          delivery_info_en?: string | null;
          return_policy_ar?: string | null;
          return_policy_en?: string | null;
          warranty_info_ar?: string | null;
          warranty_info_en?: string | null;
          average_rating?: number;
          total_reviews?: number;
          total_products?: number;
          commission_rate?: number;
          affiliate_config?: Record<string, unknown> | null;
          is_premium?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name_ar: string;
          name_en: string;
          slug: string;
          category: ProductCategory;
          brand: string;
          model: string;
          sku: string | null;
          description_ar: string | null;
          description_en: string | null;
          image_urls: string[] | null;
          video_url: string | null;
          specifications: Record<string, unknown> | null;
          view_count: number;
          save_count: number;
          comparison_count: number;
          average_rating: number | null;
          total_reviews: number | null;
          merchant_rating: number | null;
          merchant_review_count: number;
          enriched_at: string | null;
          embedding: unknown;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name_ar: string;
          name_en: string;
          slug: string;
          category: ProductCategory;
          brand: string;
          model: string;
          sku?: string | null;
          description_ar?: string | null;
          description_en?: string | null;
          image_urls?: string[] | null;
          video_url?: string | null;
          specifications?: Record<string, unknown> | null;
          view_count?: number;
          save_count?: number;
          comparison_count?: number;
          average_rating?: number | null;
          total_reviews?: number | null;
          merchant_rating?: number | null;
          merchant_review_count?: number;
          enriched_at?: string | null;
          embedding?: unknown;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name_ar?: string;
          name_en?: string;
          slug?: string;
          category?: ProductCategory;
          brand?: string;
          model?: string;
          sku?: string | null;
          description_ar?: string | null;
          description_en?: string | null;
          image_urls?: string[] | null;
          video_url?: string | null;
          specifications?: Record<string, unknown> | null;
          view_count?: number;
          save_count?: number;
          comparison_count?: number;
          average_rating?: number | null;
          total_reviews?: number | null;
          merchant_rating?: number | null;
          merchant_review_count?: number;
          enriched_at?: string | null;
          embedding?: unknown;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          rating: number;
          review_text: string | null;
          is_verified_purchase: boolean;
          helpful_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          rating: number;
          review_text?: string | null;
          is_verified_purchase?: boolean;
          helpful_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string;
          rating?: number;
          review_text?: string | null;
          is_verified_purchase?: boolean;
          helpful_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_stores: {
        Row: {
          id: string;
          product_id: string;
          store_id: string;
          current_price: number;
          original_price: number | null;
          currency: string;
          availability: AvailabilityStatus;
          stock_quantity: number | null;
          product_url: string;
          affiliate_url: string | null;
          delivery_time_days: number | null;
          delivery_cost: number;
          is_free_delivery: boolean;
          is_deal: boolean;
          deal_expires_at: string | null;
          coupon_code: string | null;
          last_checked_at: string;
          last_price_change_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          store_id: string;
          current_price: number;
          original_price?: number | null;
          currency?: string;
          availability?: AvailabilityStatus;
          stock_quantity?: number | null;
          product_url: string;
          affiliate_url?: string | null;
          delivery_time_days?: number | null;
          delivery_cost?: number;
          is_free_delivery?: boolean;
          is_deal?: boolean;
          deal_expires_at?: string | null;
          coupon_code?: string | null;
          last_checked_at?: string;
          last_price_change_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          store_id?: string;
          current_price?: number;
          original_price?: number | null;
          currency?: string;
          availability?: AvailabilityStatus;
          stock_quantity?: number | null;
          product_url?: string;
          affiliate_url?: string | null;
          delivery_time_days?: number | null;
          delivery_cost?: number;
          is_free_delivery?: boolean;
          is_deal?: boolean;
          deal_expires_at?: string | null;
          coupon_code?: string | null;
          last_checked_at?: string;
          last_price_change_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      price_history: {
        Row: {
          id: string;
          product_store_id: string;
          price: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          product_store_id: string;
          price: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          product_store_id?: string;
          price?: number;
          recorded_at?: string;
        };
        Relationships: [];
      };
      user_wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      search_history: {
        Row: {
          id: string;
          user_id: string | null;
          search_query: string;
          category: ProductCategory | null;
          filters: Record<string, unknown> | null;
          results_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          search_query: string;
          category?: ProductCategory | null;
          filters?: Record<string, unknown> | null;
          results_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          search_query?: string;
          category?: ProductCategory | null;
          filters?: Record<string, unknown> | null;
          results_count?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string | null;
          product_store_id: string;
          amount: number;
          commission_amount: number | null;
          commission_rate: number | null;
          status: TransactionStatus;
          click_id: string | null;
          clicked_at: string | null;
          converted_at: string | null;
          user_agent: string | null;
          ip_address: string | null;
          referrer: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          product_store_id: string;
          amount?: number;
          commission_amount?: number | null;
          commission_rate?: number | null;
          status?: TransactionStatus;
          click_id?: string | null;
          clicked_at?: string | null;
          converted_at?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          referrer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          product_store_id?: string;
          amount?: number;
          commission_amount?: number | null;
          commission_rate?: number | null;
          status?: TransactionStatus;
          click_id?: string | null;
          clicked_at?: string | null;
          converted_at?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          referrer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_reviews: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          rating: number;
          review_text: string | null;
          delivery_rating: number | null;
          product_quality_rating: number | null;
          customer_service_rating: number | null;
          is_verified_purchase: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          rating: number;
          review_text?: string | null;
          delivery_rating?: number | null;
          product_quality_rating?: number | null;
          customer_service_rating?: number | null;
          is_verified_purchase?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          rating?: number;
          review_text?: string | null;
          delivery_rating?: number | null;
          product_quality_rating?: number | null;
          customer_service_rating?: number | null;
          is_verified_purchase?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title_ar: string;
          title_en: string;
          message_ar: string | null;
          message_en: string | null;
          product_id: string | null;
          product_store_id: string | null;
          store_id: string | null;
          link: string | null;
          data: Record<string, unknown> | null;
          is_read: boolean;
          is_sent: boolean;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title_ar: string;
          title_en: string;
          message_ar?: string | null;
          message_en?: string | null;
          product_id?: string | null;
          product_store_id?: string | null;
          store_id?: string | null;
          link?: string | null;
          data?: Record<string, unknown> | null;
          is_read?: boolean;
          is_sent?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title_ar?: string;
          title_en?: string;
          message_ar?: string | null;
          message_en?: string | null;
          product_id?: string | null;
          product_store_id?: string | null;
          store_id?: string | null;
          link?: string | null;
          data?: Record<string, unknown> | null;
          is_read?: boolean;
          is_sent?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      price_alerts: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          target_price: number;
          is_active: boolean;
          notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          target_price: number;
          is_active?: boolean;
          notified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          target_price?: number;
          is_active?: boolean;
          notified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          details: Record<string, unknown> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          store_id: string;
          product_id: string | null;
          code: string;
          description_ar: string | null;
          description_en: string | null;
          discount_type: DiscountType;
          discount_value: number;
          min_purchase: number | null;
          max_discount: number | null;
          starts_at: string;
          expires_at: string | null;
          is_active: boolean;
          usage_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id?: string | null;
          code: string;
          description_ar?: string | null;
          description_en?: string | null;
          discount_type: DiscountType;
          discount_value: number;
          min_purchase?: number | null;
          max_discount?: number | null;
          starts_at?: string;
          expires_at?: string | null;
          is_active?: boolean;
          usage_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string | null;
          code?: string;
          description_ar?: string | null;
          description_en?: string | null;
          discount_type?: DiscountType;
          discount_value?: number;
          min_purchase?: number | null;
          max_discount?: number | null;
          starts_at?: string;
          expires_at?: string | null;
          is_active?: boolean;
          usage_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          notification_preferences: Record<string, unknown> | null;
          privacy_preferences: Record<string, unknown> | null;
          app_preferences: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_preferences?: Record<string, unknown> | null;
          privacy_preferences?: Record<string, unknown> | null;
          app_preferences?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_preferences?: Record<string, unknown> | null;
          privacy_preferences?: Record<string, unknown> | null;
          app_preferences?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      phone_otps: {
        Row: {
          id: string;
          phone: string;
          otp_code: string;
          expires_at: string;
          is_used: boolean;
          attempts: number;
          created_at: string;
          verified_at: string | null;
        };
        Insert: {
          id?: string;
          phone: string;
          otp_code: string;
          expires_at: string;
          is_used?: boolean;
          attempts?: number;
          created_at?: string;
          verified_at?: string | null;
        };
        Update: {
          id?: string;
          phone?: string;
          otp_code?: string;
          expires_at?: string;
          is_used?: boolean;
          attempts?: number;
          created_at?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      product_views: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          viewed_at: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          viewed_at?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string;
          viewed_at?: string | null;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          search_query: string | null;
          filters: Record<string, unknown> | null;
          last_result_count: number;
          last_checked_at: string | null;
          notify_on_new_results: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          search_query?: string | null;
          filters?: Record<string, unknown> | null;
          last_result_count?: number;
          last_checked_at?: string | null;
          notify_on_new_results?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          search_query?: string | null;
          filters?: Record<string, unknown> | null;
          last_result_count?: number;
          last_checked_at?: string | null;
          notify_on_new_results?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      login_sessions: {
        Row: {
          id: string;
          user_id: string;
          device_fingerprint: string;
          user_agent: string | null;
          ip_address: string | null;
          is_known_device: boolean;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_fingerprint: string;
          user_agent?: string | null;
          ip_address?: string | null;
          is_known_device?: boolean;
          last_seen_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_fingerprint?: string;
          user_agent?: string | null;
          ip_address?: string | null;
          is_known_device?: boolean;
          last_seen_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      scraping_schedules: {
        Row: {
          id: string;
          store_id: string;
          job_type: 'discovery' | 'price_update';
          cron_expression: string;
          is_enabled: boolean;
          max_pages: number | null;
          max_products: number | null;
          older_than_hours: number | null;
          categories: string[] | null;
          is_live_search_enabled: boolean;
          coverage_mode: boolean;
          target_refresh_hours: number;
          chunk_size: number | null;
          last_run_at: string | null;
          last_success_at: string | null;
          next_run_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          job_type: 'discovery' | 'price_update';
          cron_expression?: string;
          is_enabled?: boolean;
          max_pages?: number | null;
          max_products?: number | null;
          older_than_hours?: number | null;
          categories?: string[] | null;
          is_live_search_enabled?: boolean;
          last_run_at?: string | null;
          last_success_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          job_type?: 'discovery' | 'price_update';
          cron_expression?: string;
          is_enabled?: boolean;
          max_pages?: number | null;
          max_products?: number | null;
          older_than_hours?: number | null;
          categories?: string[] | null;
          is_live_search_enabled?: boolean;
          last_run_at?: string | null;
          last_success_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      scraping_runs: {
        Row: {
          id: string;
          schedule_id: string | null;
          store_id: string;
          job_type: 'discovery' | 'price_update';
          status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
          started_at: string | null;
          finished_at: string | null;
          duration_ms: number | null;
          products_discovered: number;
          products_updated: number;
          price_changes_detected: number;
          errors_count: number;
          error_summary: Record<string, unknown> | null;
          triggered_by: 'schedule' | 'manual' | 'api';
          triggered_by_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id?: string | null;
          store_id: string;
          job_type: 'discovery' | 'price_update';
          status?: 'pending' | 'running' | 'success' | 'failed' | 'partial';
          started_at?: string | null;
          finished_at?: string | null;
          duration_ms?: number | null;
          products_discovered?: number;
          products_updated?: number;
          price_changes_detected?: number;
          errors_count?: number;
          error_summary?: Record<string, unknown> | null;
          triggered_by?: 'schedule' | 'manual' | 'api';
          triggered_by_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string | null;
          store_id?: string;
          job_type?: 'discovery' | 'price_update';
          status?: 'pending' | 'running' | 'success' | 'failed' | 'partial';
          started_at?: string | null;
          finished_at?: string | null;
          duration_ms?: number | null;
          products_discovered?: number;
          products_updated?: number;
          price_changes_detected?: number;
          errors_count?: number;
          error_summary?: Record<string, unknown> | null;
          triggered_by?: 'schedule' | 'manual' | 'api';
          triggered_by_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      mv_product_analytics: {
        Row: {
          product_id: string | null;
          total_views: number | null;
          total_saves: number | null;
          total_comparisons: number | null;
          total_reviews: number | null;
          average_rating: number | null;
        };
        Relationships: [];
      };
      mv_store_analytics: {
        Row: {
          store_id: string | null;
          total_clicks: number | null;
          total_conversions: number | null;
          total_revenue: number | null;
          average_commission: number | null;
        };
        Relationships: [];
      };
      mv_user_analytics: {
        Row: {
          user_id: string | null;
          total_wishlists: number | null;
          total_price_alerts: number | null;
          total_searches: number | null;
          total_comparisons: number | null;
          last_active_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_id: { Args: never; Returns: string };
      current_user_role: { Args: never; Returns: UserRole };
      is_admin: { Args: never; Returns: boolean };
      is_store_owner: { Args: { store_uuid: string }; Returns: boolean };
      refresh_analytics_views: { Args: never; Returns: undefined };
      get_recommendations: {
        Args: {
          p_user_id?: string;
          p_product_id?: string;
          p_type?: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
          slug: string;
          category: ProductCategory;
          brand: string;
          model: string;
          image_urls: string[];
          score: number;
          source: string;
        }[];
      };
      match_similar_products: {
        Args: {
          target_product_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
          slug: string;
          category: ProductCategory;
          brand: string;
          model: string;
          image_urls: string[];
          similarity: number;
        }[];
      };
      get_collaborative_recommendations: {
        Args: {
          target_product_id: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
          slug: string;
          category: ProductCategory;
          brand: string;
          model: string;
          image_urls: string[];
          co_occurrence_count: number;
        }[];
      };
      get_personalized_recommendations: {
        Args: {
          target_user_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          name_ar: string;
          name_en: string;
          slug: string;
          category: ProductCategory;
          brand: string;
          model: string;
          image_urls: string[];
          relevance_score: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      auth_provider: AuthProvider;
      product_category: ProductCategory;
      availability_status: AvailabilityStatus;
      transaction_status: TransactionStatus;
      notification_type: NotificationType;
      store_status: StoreStatus;
      discount_type: DiscountType;
    };
    CompositeTypes: Record<string, never>;
  };
}

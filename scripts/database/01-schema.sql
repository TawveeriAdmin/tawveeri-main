-- Tawveeri Database Schema
-- Week 1: Foundation & Setup
-- Core entities: Users, Products, Stores, Transactions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'customer', 'store', 'guest');

-- Authentication providers
CREATE TYPE auth_provider AS ENUM ('email', 'phone', 'google', 'facebook', 'apple');

-- Product categories
CREATE TYPE product_category AS ENUM ('tv', 'laptop', 'smartphone', 'tablet', 'audio', 'camera', 'gaming', 'accessories');

-- Product availability status
CREATE TYPE availability_status AS ENUM ('in_stock', 'out_of_stock', 'limited_stock', 'pre_order');

-- Transaction status
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Notification types
CREATE TYPE notification_type AS ENUM ('price_drop', 'back_in_stock', 'deal_alert', 'system');

-- Store status
CREATE TYPE store_status AS ENUM ('active', 'pending', 'suspended', 'inactive');

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    full_name VARCHAR(255),
    role user_role DEFAULT 'customer' NOT NULL,
    auth_provider auth_provider DEFAULT 'email',
    auth_provider_id VARCHAR(255), -- External provider ID
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    preferred_language VARCHAR(2) DEFAULT 'ar', -- 'ar' or 'en'
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_auth_provider ON users(auth_provider, auth_provider_id);

-- ============================================================================
-- STORES TABLE
-- ============================================================================

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    website_url TEXT NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    status store_status DEFAULT 'active',

    -- Contact information
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),

    -- Integration details
    api_endpoint TEXT,
    requires_scraping BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE,

    -- Store policies
    delivery_info_ar TEXT,
    delivery_info_en TEXT,
    return_policy_ar TEXT,
    return_policy_en TEXT,
    warranty_info_ar TEXT,
    warranty_info_en TEXT,

    -- Ratings & stats
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 0,

    -- Monetization
    commission_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    affiliate_config JSONB DEFAULT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_stores_featured ON stores(is_featured) WHERE is_featured = TRUE;

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic information
    name_ar VARCHAR(500) NOT NULL,
    name_en VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    category product_category NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(200) NOT NULL,
    sku VARCHAR(100),

    -- Descriptions
    description_ar TEXT,
    description_en TEXT,

    -- Media
    image_urls TEXT[], -- Array of image URLs
    video_url TEXT, -- YouTube or product video URL

    -- Specifications (JSONB for flexibility)
    specifications JSONB DEFAULT '{}', -- Dynamic specs based on category

    -- Metadata
    search_vector tsvector, -- Full-text search
    view_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    comparison_count INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_model ON products(model);
CREATE INDEX idx_products_search ON products USING gin(search_vector);
CREATE INDEX idx_products_specs ON products USING gin(specifications);

-- ============================================================================
-- PRODUCT_STORES (Pricing & Availability)
-- ============================================================================

CREATE TABLE product_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Pricing
    current_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2), -- For discount calculation
    currency VARCHAR(3) DEFAULT 'SAR',

    -- Availability
    availability availability_status DEFAULT 'in_stock',
    stock_quantity INTEGER,

    -- Product URL at store
    product_url TEXT NOT NULL,
    affiliate_url TEXT, -- Tracking URL for commissions

    -- Delivery & shipping
    delivery_time_days INTEGER,
    delivery_cost DECIMAL(10,2) DEFAULT 0.00,
    is_free_delivery BOOLEAN DEFAULT FALSE,

    -- Deals & promotions
    is_deal BOOLEAN DEFAULT FALSE,
    deal_expires_at TIMESTAMP WITH TIME ZONE,
    coupon_code VARCHAR(50),

    -- Metadata
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_price_change_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id, store_id)
);

-- Indexes
CREATE INDEX idx_product_stores_product ON product_stores(product_id);
CREATE INDEX idx_product_stores_store ON product_stores(store_id);
CREATE INDEX idx_product_stores_price ON product_stores(current_price);
CREATE INDEX idx_product_stores_availability ON product_stores(availability);
CREATE INDEX idx_product_stores_deals ON product_stores(is_deal) WHERE is_deal = TRUE;

-- ============================================================================
-- PRICE_HISTORY (Track price changes)
-- ============================================================================

CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_store_id UUID NOT NULL REFERENCES product_stores(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_price_history_product_store ON price_history(product_store_id);
CREATE INDEX idx_price_history_date ON price_history(recorded_at);

-- ============================================================================
-- USER_WISHLISTS (Saved products)
-- ============================================================================

CREATE TABLE user_wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, product_id)
);

-- Indexes
CREATE INDEX idx_wishlists_user ON user_wishlists(user_id);
CREATE INDEX idx_wishlists_product ON user_wishlists(product_id);

-- ============================================================================
-- SEARCH_HISTORY (Track user searches)
-- ============================================================================

CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    search_query TEXT NOT NULL,
    category product_category,
    filters JSONB, -- Store applied filters
    results_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_history_date ON search_history(created_at);

-- ============================================================================
-- TRANSACTIONS (Commission tracking)
-- ============================================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_store_id UUID NOT NULL REFERENCES product_stores(id),

    -- Transaction details
    amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2),
    commission_rate DECIMAL(5,2),
    status transaction_status DEFAULT 'pending',

    -- Tracking
    click_id VARCHAR(255) UNIQUE, -- Unique click tracking ID
    clicked_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    user_agent TEXT,
    ip_address INET,
    referrer TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_product_store ON transactions(product_store_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_click_id ON transactions(click_id);

-- ============================================================================
-- STORE_REVIEWS (User ratings for stores)
-- ============================================================================

CREATE TABLE store_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,

    -- Review categories
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    product_quality_rating INTEGER CHECK (product_quality_rating >= 1 AND product_quality_rating <= 5),
    customer_service_rating INTEGER CHECK (customer_service_rating >= 1 AND customer_service_rating <= 5),

    is_verified_purchase BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(store_id, user_id) -- One review per user per store
);

-- Indexes
CREATE INDEX idx_store_reviews_store ON store_reviews(store_id);
CREATE INDEX idx_store_reviews_user ON store_reviews(user_id);
CREATE INDEX idx_store_reviews_rating ON store_reviews(rating);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,

    title_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    message_ar TEXT,
    message_en TEXT,

    -- Related entities
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_store_id UUID REFERENCES product_stores(id) ON DELETE CASCADE,

    -- Notification data
    data JSONB, -- Additional metadata

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(is_read) WHERE is_read = FALSE;

-- ============================================================================
-- PRICE_ALERTS (User subscriptions to price drops)
-- ============================================================================

CREATE TABLE price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    target_price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    notified_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, product_id)
);

-- Indexes
CREATE INDEX idx_price_alerts_user ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_product ON price_alerts(product_id);
CREATE INDEX idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- ADMIN_LOGS (System activity logging)
-- ============================================================================

CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_logs_user ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_date ON admin_logs(created_at);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_stores_updated_at BEFORE UPDATE ON product_stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_reviews_updated_at BEFORE UPDATE ON store_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FULL-TEXT SEARCH UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('arabic', COALESCE(NEW.name_ar, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.name_en, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.brand, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.model, '')), 'B') ||
        setweight(to_tsvector('arabic', COALESCE(NEW.description_ar, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.description_en, '')), 'C');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_search_vector_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

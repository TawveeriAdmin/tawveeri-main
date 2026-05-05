-- Product Reviews Schema
-- Adds product_reviews table and updates products table with review statistics

-- ============================================================================
-- ADD REVIEW STATISTICS TO PRODUCTS TABLE
-- ============================================================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- ============================================================================
-- PRODUCT_REVIEWS TABLE
-- ============================================================================

CREATE TABLE product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(product_id, user_id)
);

-- Indexes
CREATE INDEX idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at DESC);

-- ============================================================================
-- TRIGGER FUNCTION: UPDATE PRODUCT REVIEW STATISTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Update product stats after review deletion
        UPDATE products
        SET 
            total_reviews = (
                SELECT COUNT(*) 
                FROM product_reviews 
                WHERE product_id = OLD.product_id
            ),
            average_rating = (
                SELECT COALESCE(ROUND(AVG(rating::numeric), 2), 0.00)
                FROM product_reviews 
                WHERE product_id = OLD.product_id
            )
        WHERE id = OLD.product_id;
        
        RETURN OLD;
    ELSE
        -- Update product stats after review insert or update
        UPDATE products
        SET 
            total_reviews = (
                SELECT COUNT(*) 
                FROM product_reviews 
                WHERE product_id = NEW.product_id
            ),
            average_rating = (
                SELECT COALESCE(ROUND(AVG(rating::numeric), 2), 0.00)
                FROM product_reviews 
                WHERE product_id = NEW.product_id
            )
        WHERE id = NEW.product_id;
        
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_product_review_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION update_product_review_stats();

-- Apply updated_at trigger
CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


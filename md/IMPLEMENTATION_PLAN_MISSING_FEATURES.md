# Implementation Plan: Missing Features
## Monolithic PostgreSQL-Native Approach

**Approach**: Build all features using existing infrastructure (PostgreSQL/Supabase + Next.js only)  
**Exclusions**: Mobile app, Authentica/login features (to be done later)  
**Timeline**: 10 phases, sequential implementation

---

## PHASE 1: Database Schema Updates & Core Infrastructure

### 1.1 Database Schema Additions

**File**: `scripts/database/04-product-reviews-schema.sql`

**Actions**:
1. Create `product_reviews` table with columns:
   - `id` UUID PRIMARY KEY
   - `product_id` UUID REFERENCES products(id) ON DELETE CASCADE
   - `user_id` UUID REFERENCES users(id) ON DELETE CASCADE
   - `rating` INTEGER CHECK (rating >= 1 AND rating <= 5)
   - `review_text` TEXT
   - `is_verified_purchase` BOOLEAN DEFAULT FALSE
   - `helpful_count` INTEGER DEFAULT 0
   - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   - `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   - UNIQUE(product_id, user_id)

2. Add `average_rating` and `total_reviews` columns to `products` table:
   - `average_rating` DECIMAL(3,2) DEFAULT 0.00
   - `total_reviews` INTEGER DEFAULT 0

3. Create indexes:
   - `idx_product_reviews_product` ON product_reviews(product_id)
   - `idx_product_reviews_user` ON product_reviews(user_id)
   - `idx_product_reviews_rating` ON product_reviews(rating)

4. Create trigger function `update_product_review_stats()` to update `average_rating` and `total_reviews` in products table when reviews are inserted/updated/deleted

5. Apply trigger to `product_reviews` table

**File**: `scripts/database/05-analytics-materialized-views.sql`

**Actions**:
1. Create materialized view `mv_user_analytics` with columns:
   - `user_id` UUID
   - `total_wishlists` INTEGER
   - `total_searches` INTEGER
   - `total_price_alerts` INTEGER
   - `total_comparisons` INTEGER
   - `last_active_at` TIMESTAMP WITH TIME ZONE

2. Create materialized view `mv_product_analytics` with columns:
   - `product_id` UUID
   - `total_views` INTEGER
   - `total_saves` INTEGER
   - `total_comparisons` INTEGER
   - `average_rating` DECIMAL(3,2)
   - `total_reviews` INTEGER

3. Create materialized view `mv_store_analytics` with columns:
   - `store_id` UUID
   - `total_clicks` INTEGER
   - `total_conversions` INTEGER
   - `total_revenue` DECIMAL(10,2)
   - `average_commission` DECIMAL(10,2)

4. Create function `refresh_analytics_views()` to refresh all materialized views

5. Create scheduled job using pg_cron to refresh views every hour (if supported) or manual refresh

**File**: `scripts/database/06-rls-product-reviews.sql`

**Actions**:
1. Enable RLS on `product_reviews` table
2. Create policy "Anyone can view product reviews" for SELECT (authenticated, anon)
3. Create policy "Users can insert own reviews" for INSERT (authenticated, user_id = auth.uid())
4. Create policy "Users can update own reviews" for UPDATE (authenticated, user_id = auth.uid())
5. Create policy "Users can delete own reviews" for DELETE (authenticated, user_id = auth.uid())
6. Create policy "Admins can manage all reviews" for ALL (authenticated, is_admin())

### 1.2 TypeScript Types Update

**File**: `src/lib/database/types.ts`

**Actions**:
1. Add `product_reviews` table definition to Database interface with Row, Insert, Update types
2. Update `products` table to include `average_rating` and `total_reviews` fields
3. Export `ProductReview` type alias

### 1.3 Core Utility Functions

**File**: `src/lib/admin/utils.ts`

**Functions to create**:
- `getAdminStats()`: Returns object with `totalUsers`, `totalProducts`, `totalStores`, `totalTransactions`, `totalRevenue`
- `getUserAnalytics(userId: string)`: Returns user analytics from materialized view
- `getProductAnalytics(productId: string)`: Returns product analytics from materialized view
- `getStoreAnalytics(storeId: string)`: Returns store analytics from materialized view
- `refreshAnalyticsViews()`: Calls refresh function in database

**File**: `src/lib/store/utils.ts`

**Functions to create**:
- `getStoreOwnerStats(storeId: string, userId: string)`: Returns store stats for owner
- `getStoreProductAnalytics(storeId: string)`: Returns product performance for store
- `getStoreRevenue(storeId: string, startDate?: Date, endDate?: Date)`: Returns revenue data

**File**: `src/lib/reviews/product-reviews.ts`

**Functions to create**:
- `createProductReview(productId: string, userId: string, rating: number, reviewText: string, isVerified: boolean)`: Create review
- `getProductReviews(productId: string, options?: { limit?: number, offset?: number, sortBy?: 'newest' | 'oldest' | 'rating' })`: Get reviews with pagination
- `updateProductReview(reviewId: string, userId: string, updates: { rating?: number, reviewText?: string })`: Update review
- `deleteProductReview(reviewId: string, userId: string)`: Delete review
- `markReviewHelpful(reviewId: string, userId: string)`: Increment helpful count

**File**: `src/lib/transactions/tracking.ts`

**Functions to create**:
- `trackProductClick(productStoreId: string, userId: string | null, metadata?: { userAgent?: string, ipAddress?: string, referrer?: string })`: Track click and return click_id
- `trackConversion(clickId: string, amount: number, metadata?: Record<string, any>)`: Update transaction status to completed
- `getTransactionStats(userId?: string, storeId?: string, startDate?: Date, endDate?: Date)`: Get transaction statistics
- `generateAffiliateUrl(productStoreId: string, userId?: string)`: Generate tracking URL with click_id

**File**: `src/lib/analytics/charts.ts`

**Functions to create**:
- `formatChartData(data: Array<{ date: string, value: number }>, type: 'line' | 'bar')`: Format data for charts
- `getRevenueChartData(storeId: string, period: '7d' | '30d' | '90d' | '1y')`: Get revenue data for charts
- `getUserGrowthChartData(period: '7d' | '30d' | '90d' | '1y')`: Get user growth data
- `getProductPerformanceChartData(productId: string, period: '7d' | '30d' | '90d')`: Get product views/saves over time

---

## PHASE 2: Admin Dashboard Pages

### 2.1 Admin Layout

**File**: `src/app/[locale]/admin/layout.tsx`

**Actions**:
1. Create layout component with:
   - Admin sidebar navigation with links: Dashboard, Users, Products, Stores, Transactions, Analytics, Logs
   - Admin header with user info and logout
   - Breadcrumb component
   - Check user role is 'admin', redirect if not
2. Fetch user session in server component
3. Pass locale to layout children

### 2.2 Admin Dashboard Page

**File**: `src/app/[locale]/admin/dashboard/page.tsx`

**Actions**:
1. Create server component that fetches:
   - Total users count
   - Total products count
   - Total stores count
   - Total transactions count
   - Total revenue (sum of completed transactions)
   - Recent activity (last 10 admin_logs)
   - User growth data (last 30 days)
   - Revenue chart data (last 30 days)
2. Display stats cards using `StatsCard` component
3. Display charts using `RevenueChart` and `UserGrowthChart` components
4. Display recent activity table

### 2.3 Admin Users Management Page

**File**: `src/app/[locale]/admin/users/page.tsx`

**Actions**:
1. Create page with:
   - Users table with columns: Name, Email, Phone, Role, Status, Joined Date, Actions
   - Search input for filtering users
   - Role filter dropdown
   - Pagination (20 per page)
2. Implement client-side search and filtering
3. Add "Edit Role" action button that opens dialog
4. Add "View Details" action button that navigates to user detail page

**File**: `src/app/[locale]/admin/users/[id]/page.tsx`

**Actions**:
1. Create user detail page showing:
   - User profile information
   - User statistics (wishlists, searches, alerts)
   - User activity timeline
   - Associated data (wishlists, reviews, etc.)

**File**: `src/components/admin/user-role-dialog.tsx`

**Actions**:
1. Create dialog component for editing user role
2. Include Select component for role selection
3. Include submit button that calls API route

**File**: `src/app/api/admin/users/[id]/role/route.ts`

**Actions**:
1. Create PUT route handler
2. Verify admin role
3. Update user role in database
4. Create audit log entry
5. Return success/error response

### 2.4 Admin Products Management Page

**File**: `src/app/[locale]/admin/products/page.tsx`

**Actions**:
1. Create page with:
   - Products table with columns: Name, Category, Brand, Stores, Views, Saves, Created Date, Actions
   - Search input
   - Category filter
   - Brand filter
   - Pagination (20 per page)
2. Implement client-side filtering
3. Add "Edit" action button
4. Add "Delete" action button with confirmation dialog

**File**: `src/app/[locale]/admin/products/[id]/page.tsx`

**Actions**:
1. Create product detail page showing:
   - Product information
   - Product stores and prices
   - Product reviews
   - Product analytics
   - Edit form

### 2.5 Admin Stores Management Page

**File**: `src/app/[locale]/admin/stores/page.tsx`

**Actions**:
1. Create page with:
   - Stores table with columns: Name, Status, Products, Rating, Revenue, Created Date, Actions
   - Status filter dropdown
   - Search input
   - Pagination
2. Add "Approve/Suspend" action button
3. Add "View Details" action button

**File**: `src/app/[locale]/admin/stores/[id]/page.tsx`

**Actions**:
1. Create store detail page showing:
   - Store information
   - Store products
   - Store reviews
   - Store analytics
   - Store transaction history

### 2.6 Admin Transactions Page

**File**: `src/app/[locale]/admin/transactions/page.tsx`

**Actions**:
1. Create page with:
   - Transactions table with columns: ID, User, Product, Store, Amount, Commission, Status, Date, Actions
   - Status filter dropdown
   - Date range filter
   - Export button (CSV)
   - Pagination
2. Display total revenue and total commissions
3. Add "Mark Complete" action for pending transactions

**File**: `src/app/api/admin/transactions/export/route.ts`

**Actions**:
1. Create GET route handler
2. Fetch all transactions with filters
3. Convert to CSV format
4. Return CSV file download

### 2.7 Admin Analytics Page

**File**: `src/app/[locale]/admin/analytics/page.tsx`

**Actions**:
1. Create page with multiple chart sections:
   - User Growth Chart (line chart, last 30/90/365 days)
   - Revenue Chart (line chart, last 30/90/365 days)
   - Product Performance Chart (bar chart, top 10 products)
   - Store Performance Chart (bar chart, top 10 stores)
   - Category Distribution Chart (pie chart)
   - Search Analytics (table of top searches)

### 2.8 Admin Logs Page

**File**: `src/app/[locale]/admin/logs/page.tsx`

**Actions**:
1. Create page with:
   - Logs table with columns: Date, User, Action, Entity Type, Entity ID, Details, IP Address
   - Action filter dropdown
   - User search input
   - Date range filter
   - Export button (CSV)
   - Pagination
2. Use existing `getAuditLogs` function from `src/lib/auth/audit.ts`
3. Add filtering and search functionality

### 2.9 Admin Components

**File**: `src/components/admin/stats-card.tsx`

**Props**:
- `title: string`
- `value: string | number`
- `change?: { value: number, type: 'increase' | 'decrease' }`
- `icon: React.ReactNode`
- `className?: string`

**Actions**:
1. Create reusable stats card component
2. Display title, value, optional change indicator
3. Include icon display
4. Support dark mode

**File**: `src/components/admin/data-table.tsx`

**Props**:
- `data: Array<Record<string, any>>`
- `columns: Array<{ key: string, label: string, render?: (row: any) => React.ReactNode }>`
- `pagination?: { page: number, limit: number, total: number, onPageChange: (page: number) => void }`
- `onRowClick?: (row: any) => void`
- `loading?: boolean`

**Actions**:
1. Create reusable data table component
2. Support sorting by column
3. Support pagination
4. Support row click handlers
5. Support custom cell rendering
6. Include loading state

**File**: `src/components/admin/chart-card.tsx`

**Props**:
- `title: string`
- `children: React.ReactNode`
- `className?: string`

**Actions**:
1. Create wrapper component for charts
2. Include title and optional actions
3. Support full-width option

**File**: `src/components/analytics/revenue-chart.tsx`

**Props**:
- `data: Array<{ date: string, value: number }>`
- `period: '7d' | '30d' | '90d' | '1y'`
- `className?: string`

**Actions**:
1. Create line chart component using Recharts
2. Display revenue over time
3. Support period switching
4. Include tooltip showing exact values

**File**: `src/components/analytics/user-growth-chart.tsx`

**Props**:
- `data: Array<{ date: string, value: number }>`
- `period: '7d' | '30d' | '90d' | '1y'`
- `className?: string`

**Actions**:
1. Create line chart component using Recharts
2. Display user growth over time
3. Support period switching

**File**: `src/components/analytics/bar-chart.tsx`

**Props**:
- `data: Array<{ name: string, value: number }>`
- `title?: string`
- `xLabel?: string`
- `yLabel?: string`
- `className?: string`

**Actions**:
1. Create reusable bar chart component using Recharts
2. Support horizontal and vertical orientations
3. Include labels and tooltips

**File**: `src/components/analytics/pie-chart.tsx`

**Props**:
- `data: Array<{ name: string, value: number }>`
- `title?: string`
- `className?: string`

**Actions**:
1. Create pie chart component using Recharts
2. Include legend
3. Include tooltips with percentages

---

## PHASE 3: Store Owner Dashboard

### 3.1 Store Layout

**File**: `src/app/[locale]/store/layout.tsx`

**Actions**:
1. Create layout component with:
   - Store sidebar navigation: Dashboard, Products, Analytics, Settings
   - Store header with store name and logout
   - Breadcrumb component
   - Check user role is 'store' or 'admin', redirect if not
   - Fetch user's store(s) and pass to layout

### 3.2 Store Dashboard Page

**File**: `src/app/[locale]/store/dashboard/page.tsx`

**Actions**:
1. Create page that fetches:
   - Store stats (total products, total views, total clicks, total conversions, total revenue)
   - Recent reviews (last 5)
   - Top performing products (by views)
   - Revenue chart data (last 30 days)
   - Click-through rate
2. Display stats cards
3. Display revenue chart
4. Display recent reviews list
5. Display top products table

### 3.3 Store Products Management Page

**File**: `src/app/[locale]/store/products/page.tsx`

**Actions**:
1. Create page with:
   - Products table showing: Name, Category, Current Price, Stock, Status, Actions
   - "Add Product" button
   - Search input
   - Category filter
   - Status filter (in_stock, out_of_stock, etc.)
   - Pagination
2. Implement client-side filtering
3. Add "Edit" action button
4. Add "Update Price" quick action
5. Add "Delete" action with confirmation

**File**: `src/app/[locale]/store/products/new/page.tsx`

**Actions**:
1. Create product creation form with fields:
   - Product search/select (search existing products in database)
   - OR create new product (name, category, brand, model, description, images, specifications)
   - Price input
   - Stock quantity input
   - Availability status select
   - Product URL input
   - Affiliate URL input (optional)
   - Delivery info (days, cost, free delivery checkbox)
   - Deal info (is_deal checkbox, expires_at, coupon_code)
2. Handle form submission
3. Create product_store entry
4. Redirect to products list

**File**: `src/app/[locale]/store/products/[id]/page.tsx`

**Actions**:
1. Create product edit page with same form as new page
2. Pre-fill form with existing data
3. Handle update submission
4. Display product analytics on same page

**File**: `src/components/store/product-form.tsx`

**Actions**:
1. Create reusable product form component
2. Support both create and edit modes
3. Include all product fields
4. Include validation
5. Include loading states

**File**: `src/components/store/bulk-price-update-dialog.tsx`

**Actions**:
1. Create dialog for bulk price updates
2. Allow selecting multiple products
3. Allow setting percentage or fixed amount change
4. Preview changes before applying
5. Submit bulk update via API route

**File**: `src/app/api/store/products/bulk-update/route.ts`

**Actions**:
1. Create POST route handler
2. Verify store owner role
3. Update multiple product_store entries
4. Create price history entries for changes
5. Return success/error response

### 3.4 Store Analytics Page

**File**: `src/app/[locale]/store/analytics/page.tsx`

**Actions**:
1. Create page with:
   - Overview stats cards
   - Revenue chart (line chart)
   - Product performance chart (bar chart, top 10 products)
   - Click-through rate over time
   - Conversion rate over time
   - Geographic data (if available)
2. Include date range selector
3. Include export functionality

---

## PHASE 4: Product Reviews System

### 4.1 Product Review Components

**File**: `src/components/products/product-review-form.tsx`

**Props**:
- `productId: string`
- `productName: string`
- `onSubmit: () => void`
- `existingReview?: ProductReview`

**Actions**:
1. Create review form with:
   - Star rating selector (1-5 stars)
   - Review text textarea (required, min 10 chars)
   - "Verified Purchase" checkbox (if user has transaction for this product)
   - Submit button
2. Handle form submission
3. Call `createProductReview` or `updateProductReview` function
4. Show success toast
5. Call `onSubmit` callback

**File**: `src/components/products/product-reviews.tsx`

**Props**:
- `productId: string`
- `locale: string`

**Actions**:
1. Create component that:
   - Fetches product reviews using `getProductReviews`
   - Displays review list with pagination
   - Includes sort options (newest, oldest, highest rating, lowest rating)
   - Displays average rating and total reviews count
   - Shows "Write Review" button if user is authenticated and hasn't reviewed
2. Display each review with:
   - User avatar and name
   - Star rating
   - Review text
   - "Verified Purchase" badge if applicable
   - "Helpful" button
   - Review date
3. Include pagination controls

**File**: `src/components/products/product-review-card.tsx`

**Props**:
- `review: ProductReview`
- `onHelpful: (reviewId: string) => void`
- `onEdit?: (review: ProductReview) => void`
- `onDelete?: (reviewId: string) => void`

**Actions**:
1. Create review card component
2. Display review details
3. Include helpful button
4. Include edit/delete buttons if review belongs to current user

**File**: `src/components/products/product-rating-display.tsx`

**Props**:
- `rating: number`
- `totalReviews: number`
- `showBreakdown?: boolean`
- `size?: 'sm' | 'md' | 'lg'`

**Actions**:
1. Create rating display component
2. Show stars (filled/empty)
3. Show rating number and total reviews
4. Optional: show rating breakdown (5 stars: X, 4 stars: Y, etc.)

### 4.2 Product Review Integration

**File**: `src/app/[locale]/products/[slug]/page.tsx`

**Actions**:
1. Update product page to:
   - Fetch product reviews using `getProductReviews(productId)`
   - Display average rating and total reviews near product title
   - Add "Reviews" tab in product details tabs
   - Include `<ProductReviews productId={productId} locale={locale} />` component in Reviews tab
   - Show "Write Review" button if user authenticated and hasn't reviewed
   - Open review form dialog when button clicked

### 4.3 Review Moderation (Admin)

**File**: `src/app/[locale]/admin/reviews/page.tsx`

**Actions**:
1. Create admin reviews page with:
   - Reviews table showing: Product, User, Rating, Review Text, Date, Status, Actions
   - Filter by product, user, rating
   - Search input
   - "Approve" and "Delete" action buttons
2. Add review moderation functionality

---

## PHASE 5: Transaction/Commission Tracking

### 5.1 Click Tracking Implementation

**File**: `src/app/[locale]/products/[slug]/page.tsx`

**Actions**:
1. Update `handleViewAtStore` function to:
   - Call `trackProductClick(productStoreId, userId, { userAgent, referrer })`
   - Get returned `click_id`
   - Generate affiliate URL with click_id as query parameter
   - Store click_id in sessionStorage or cookie
   - Open URL with tracking

**File**: `src/lib/transactions/tracking.ts`

**Actions**:
1. Implement `trackProductClick` function:
   - Create transaction record with status 'pending'
   - Generate unique click_id (UUID)
   - Capture user_agent, ip_address, referrer
   - Return click_id
2. Implement `generateAffiliateUrl` function:
   - Take product_store.affiliate_url or product_store.product_url
   - Append click_id as query parameter (e.g., ?click_id=xxx or &click_id=xxx)
   - If affiliate_url exists, use it; otherwise use product_url with tracking
   - Return tracking URL

### 5.2 Conversion Tracking

**File**: `src/app/api/transactions/conversion/route.ts`

**Actions**:
1. Create POST route handler that:
   - Accepts click_id and amount in request body
   - Verifies click_id exists and is valid
   - Updates transaction status to 'completed'
   - Sets converted_at timestamp
   - Calculates commission_amount based on store commission_rate
   - Returns success/error response

**Note**: This endpoint would be called by store's website via webhook or pixel when purchase is completed. Implementation depends on store integration method.

### 5.3 Transaction Display & Reports

**File**: `src/app/[locale]/admin/transactions/page.tsx`

**Actions**:
1. Update transactions page to:
   - Fetch transactions with product and store details
   - Display commission_amount and commission_rate columns
   - Show transaction status badges
   - Include filters for status, date range, store
   - Calculate and display total revenue and total commissions

**File**: `src/app/[locale]/store/transactions/page.tsx`

**Actions**:
1. Create store transactions page showing:
   - Only transactions for store owner's products
   - Transaction details
   - Commission breakdown
   - Revenue summary

---

## PHASE 6: Price Alerts Page & Notification System

### 6.1 Price Alerts Page

**File**: `src/app/[locale]/price-alerts/page.tsx`

**Actions**:
1. Create page that:
   - Fetches user's price alerts using existing price alerts functions
   - Displays alerts in a table/cards showing: Product, Target Price, Current Price, Status, Created Date, Actions
   - Includes "Active" and "Inactive" filter tabs
   - Shows "Delete" and "Edit" action buttons
   - Includes "Add Alert" button
   - Shows price difference and percentage
2. Include pagination

**File**: `src/components/products/price-alert-card.tsx`

**Props**:
- `alert: PriceAlert`
- `product: Product`
- `currentPrice: number`
- `onEdit: (alert: PriceAlert) => void`
- `onDelete: (alertId: string) => void`
- `onToggle: (alertId: string, isActive: boolean) => void`

**Actions**:
1. Create price alert card component
2. Display product image, name, target price, current price
3. Show price difference
4. Include edit, delete, and toggle active buttons

### 6.2 Price Alert Checker Job

**File**: `src/app/api/cron/check-price-alerts/route.ts`

**Actions**:
1. Create API route that:
   - Fetches all active price alerts
   - For each alert, gets current lowest price for product
   - If current price <= target_price, creates notification
   - Marks alert as inactive
   - Updates notified_at timestamp
2. This route should be called periodically (via Supabase Edge Function or external cron service)

**Note**: For Supabase Edge Functions, create `supabase/functions/check-price-alerts/index.ts` that calls this logic.

### 6.3 Notification Preferences

**File**: `src/app/[locale]/settings/notifications/page.tsx`

**Actions**:
1. Create notification preferences page with:
   - Toggle switches for: Email notifications, SMS notifications, Push notifications, In-app notifications
   - Per-type preferences (price drops, deals, account updates, etc.)
   - Frequency settings (immediate, daily digest, weekly digest)
2. Save preferences to user profile or separate `user_notification_preferences` table

---

## PHASE 7: Advanced Search & Filtering

### 7.1 Advanced Search Filters

**File**: `src/components/search/advanced-filters.tsx`

**Props**:
- `onFiltersChange: (filters: SearchFilters) => void`
- `initialFilters?: SearchFilters`

**Actions**:
1. Create advanced filters component with:
   - Multi-select brand filter (fetch brands from database)
   - Price range slider (min/max inputs)
   - Multi-select store filter
   - Availability filter (in stock, out of stock, etc.)
   - Specifications filter (dynamic based on category)
   - Rating filter (minimum rating)
   - Deal filter (only deals checkbox)
   - Free delivery filter
2. Emit filter changes to parent

**File**: `src/app/[locale]/search/page.tsx`

**Actions**:
1. Update search page to:
   - Include `<AdvancedFilters />` component in sidebar
   - Apply filters to search query
   - Persist filters in URL query parameters
   - Load filters from URL on mount

### 7.2 Saved Searches

**File**: `src/components/search/saved-searches.tsx`

**Actions**:
1. Create component that:
   - Displays list of saved searches
   - Allows saving current search with name
   - Allows deleting saved searches
   - Allows clicking saved search to apply filters

**File**: `scripts/database/07-saved-searches-schema.sql`

**Actions**:
1. Create `saved_searches` table with:
   - `id` UUID PRIMARY KEY
   - `user_id` UUID REFERENCES users(id) ON DELETE CASCADE
   - `name` VARCHAR(255)
   - `search_query` TEXT
   - `filters` JSONB
   - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
2. Enable RLS with policies for user access

**File**: `src/lib/search/saved-searches.ts`

**Functions to create**:
- `saveSearch(userId: string, name: string, query: string, filters: Record<string, any>)`: Save search
- `getSavedSearches(userId: string)`: Get user's saved searches
- `deleteSavedSearch(searchId: string, userId: string)`: Delete saved search

### 7.3 Search Analytics

**File**: `src/app/[locale]/admin/analytics/search/page.tsx`

**Actions**:
1. Create search analytics page showing:
   - Top searches table
   - Search trends chart
   - No results searches
   - Search conversion rate

---

## PHASE 8: Image Gallery & Media Enhancements

### 8.1 Image Gallery Modal

**File**: `src/components/products/image-gallery-modal.tsx`

**Props**:
- `images: string[]`
- `initialIndex?: number`
- `isOpen: boolean`
- `onClose: () => void`

**Actions**:
1. Create full-screen modal for image gallery
2. Display large image in center
3. Include thumbnail strip at bottom
4. Include navigation arrows (prev/next)
5. Support keyboard navigation (arrow keys, Escape)
6. Include zoom functionality (pinch/scroll to zoom)
7. Use Next.js Image component for optimization

**File**: `src/app/[locale]/products/[slug]/page.tsx`

**Actions**:
1. Update product page to:
   - Open image gallery modal when main image is clicked
   - Pass all product images to modal
   - Set initial index based on clicked image

### 8.2 Video Player Component

**File**: `src/components/products/product-video-player.tsx`

**Props**:
- `videoUrl: string`
- `thumbnailUrl?: string`
- `className?: string`

**Actions**:
1. Create video player component
2. Support YouTube URLs (embed format)
3. Support direct video URLs
4. Include thumbnail with play button overlay
5. Load video on play button click
6. Use iframe for YouTube, video tag for direct URLs

**File**: `src/app/[locale]/products/[slug]/page.tsx`

**Actions**:
1. Update product page to:
   - Check if product has video_url
   - Display video player component if video exists
   - Position video in product media section

### 8.3 Image Zoom Functionality

**File**: `src/components/products/image-zoom.tsx`

**Props**:
- `src: string`
- `alt: string`
- `className?: string`

**Actions**:
1. Create image zoom component
2. Implement hover zoom or click-to-zoom
3. Use CSS transform for smooth zoom
4. Include zoom controls (zoom in, zoom out, reset)

---

## PHASE 9: Multi-Store Cart & Checkout

### 9.1 Cart Enhancements

**File**: `src/lib/cart/cart-context.tsx`

**Actions**:
1. Update cart context to:
   - Persist cart to localStorage
   - Sync cart with database for authenticated users
   - Group items by store
   - Calculate totals per store
   - Support cart notes per item
   - Support gift wrapping option per item

**File**: `src/components/cart/cart-summary.tsx`

**Actions**:
1. Create cart summary component showing:
   - Items grouped by store
   - Subtotal per store
   - Delivery cost per store
   - Total across all stores
   - Store-wise checkout buttons

### 9.2 Checkout Flow

**File**: `src/app/[locale]/cart/page.tsx`

**Actions**:
1. Create cart page displaying:
   - Cart items grouped by store
   - Edit quantity/remove buttons
   - Delivery options per store
   - Gift options
   - Total breakdown
   - "Checkout" buttons (one per store or combined)

**File**: `src/app/[locale]/checkout/page.tsx`

**Actions**:
1. Create checkout page with:
   - Review cart items
   - Select delivery address (if applicable)
   - Review totals
   - "Proceed to Store" buttons (redirect to store's checkout with affiliate tracking)
   - Or handle multi-store checkout if stores support it

**Note**: Since stores have their own checkout systems, this page primarily tracks the checkout initiation and redirects to store's checkout with tracking parameters.

---

## PHASE 10: Polish, Enhancements & Legal Pages

### 10.1 Unauthorized Page

**File**: `src/app/[locale]/unauthorized/page.tsx`

**Actions**:
1. Create unauthorized access page with:
   - Error message explaining access denied
   - "Go to Home" button
   - "Go to Login" button (if not authenticated)
   - Styled with theme support

### 10.2 Legal Pages

**File**: `src/app/[locale]/terms/page.tsx`

**Actions**:
1. Create Terms of Service page
2. Display terms content (can be stored in database or markdown file)
3. Include last updated date
4. Style consistently with app theme

**File**: `src/app/[locale]/privacy/page.tsx`

**Actions**:
1. Create Privacy Policy page
2. Display privacy policy content
3. Include last updated date
4. Style consistently with app theme

### 10.3 Wishlist Enhancements

**File**: `src/app/[locale]/wishlist/page.tsx`

**Actions**:
1. Update wishlist page to:
   - Display note field if wishlist item has notes
   - Include "Add Note" button for each item
   - Show note in wishlist item card
   - Support editing notes

**File**: `src/components/wishlist/wishlist-item-note-dialog.tsx`

**Actions**:
1. Create dialog for adding/editing wishlist item notes
2. Include textarea for note
3. Save note to database

### 10.4 Store Policies Display

**File**: `src/app/[locale]/stores/[slug]/page.tsx`

**Actions**:
1. Update store detail page to:
   - Add "Policies" section/tab
   - Display delivery_info, return_policy, warranty_info
   - Format text properly (handle markdown if stored)
   - Show policies in expandable accordions

### 10.5 Product Specifications Display

**File**: `src/components/products/product-specifications.tsx`

**Props**:
- `specifications: Record<string, any>`
- `category: ProductCategory`
- `locale: string`

**Actions**:
1. Create specifications display component
2. Render specifications based on category
3. Support different spec types (text, number, boolean, array)
4. Display in organized table or list format
5. Translate spec keys based on locale

**File**: `src/app/[locale]/products/[slug]/page.tsx`

**Actions**:
1. Update product page to:
   - Include specifications in product details tabs
   - Display specifications using `<ProductSpecifications />` component

### 10.6 Product View Count Tracking

**File**: `src/app/[locale]/products/[slug]/page.tsx`

**Actions**:
1. Update product page to:
   - Increment view_count when page loads (use useEffect)
   - Call API route to update view_count in database
   - Display view_count on product page

**File**: `src/app/api/products/[id]/view/route.ts`

**Actions**:
1. Create POST route handler that:
   - Increments product view_count
   - Returns updated count
   - Rate limit to prevent abuse (one view per user per hour)

### 10.7 Product Save Count Tracking

**File**: `src/lib/wishlist/utils.ts`

**Actions**:
1. Update wishlist add function to:
   - Increment product save_count when item added
   - Decrement when item removed

### 10.8 Product Comparison Count Tracking

**File**: `src/app/[locale]/compare/page.tsx`

**Actions**:
1. Update compare page to:
   - Increment comparison_count for each product added to comparison
   - Track in database via API route

### 10.9 Store Integration API Routes

**File**: `src/app/api/store/sync/[storeId]/route.ts`

**Actions**:
1. Create POST route handler for store data sync
2. Accept product data in request body
3. Update or create product_store entries
4. Update price_history if price changed
5. Return sync results

**Note**: This endpoint would be called by store's system or by scheduled job.

### 10.10 Dependencies Installation

**File**: `package.json`

**Actions**:
1. Add dependencies:
   - `recharts`: For chart components
   - `react-hook-form`: For form handling (if not already present)
   - `zod`: For validation (if not already present)
   - `date-fns`: For date formatting (if not already present)

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Database Schema & Core Infrastructure
1. [ ] Create `scripts/database/04-product-reviews-schema.sql` with product_reviews table, indexes, triggers
2. [ ] Create `scripts/database/05-analytics-materialized-views.sql` with analytics views and refresh function
3. [ ] Create `scripts/database/06-rls-product-reviews.sql` with RLS policies for product_reviews
4. [ ] Update `src/lib/database/types.ts` with product_reviews table types
5. [ ] Create `src/lib/admin/utils.ts` with admin utility functions
6. [ ] Create `src/lib/store/utils.ts` with store utility functions
7. [ ] Create `src/lib/reviews/product-reviews.ts` with review management functions
8. [ ] Create `src/lib/transactions/tracking.ts` with transaction tracking functions
9. [ ] Create `src/lib/analytics/charts.ts` with chart data formatting functions

### Phase 2: Admin Dashboard
10. [ ] Create `src/app/[locale]/admin/layout.tsx` with admin navigation
11. [ ] Create `src/app/[locale]/admin/dashboard/page.tsx` with stats and charts
12. [ ] Create `src/app/[locale]/admin/users/page.tsx` with users table
13. [ ] Create `src/app/[locale]/admin/users/[id]/page.tsx` with user detail page
14. [ ] Create `src/components/admin/user-role-dialog.tsx` for role editing
15. [ ] Create `src/app/api/admin/users/[id]/role/route.ts` for role update API
16. [ ] Create `src/app/[locale]/admin/products/page.tsx` with products table
17. [ ] Create `src/app/[locale]/admin/products/[id]/page.tsx` with product detail page
18. [ ] Create `src/app/[locale]/admin/stores/page.tsx` with stores table
19. [ ] Create `src/app/[locale]/admin/stores/[id]/page.tsx` with store detail page
20. [ ] Create `src/app/[locale]/admin/transactions/page.tsx` with transactions table
21. [ ] Create `src/app/api/admin/transactions/export/route.ts` for CSV export
22. [ ] Create `src/app/[locale]/admin/analytics/page.tsx` with analytics charts
23. [ ] Create `src/app/[locale]/admin/logs/page.tsx` with admin logs viewer
24. [ ] Create `src/components/admin/stats-card.tsx` reusable component
25. [ ] Create `src/components/admin/data-table.tsx` reusable component
26. [ ] Create `src/components/admin/chart-card.tsx` wrapper component
27. [ ] Create `src/components/analytics/revenue-chart.tsx` line chart
28. [ ] Create `src/components/analytics/user-growth-chart.tsx` line chart
29. [ ] Create `src/components/analytics/bar-chart.tsx` reusable bar chart
30. [ ] Create `src/components/analytics/pie-chart.tsx` pie chart

### Phase 3: Store Owner Dashboard
31. [ ] Create `src/app/[locale]/store/layout.tsx` with store navigation
32. [ ] Create `src/app/[locale]/store/dashboard/page.tsx` with store stats
33. [ ] Create `src/app/[locale]/store/products/page.tsx` with products table
34. [ ] Create `src/app/[locale]/store/products/new/page.tsx` for product creation
35. [ ] Create `src/app/[locale]/store/products/[id]/page.tsx` for product editing
36. [ ] Create `src/components/store/product-form.tsx` reusable form
37. [ ] Create `src/components/store/bulk-price-update-dialog.tsx` for bulk updates
38. [ ] Create `src/app/api/store/products/bulk-update/route.ts` for bulk update API
39. [ ] Create `src/app/[locale]/store/analytics/page.tsx` with store analytics

### Phase 4: Product Reviews
40. [ ] Create `src/components/products/product-review-form.tsx` for review submission
41. [ ] Create `src/components/products/product-reviews.tsx` for reviews display
42. [ ] Create `src/components/products/product-review-card.tsx` for individual review
43. [ ] Create `src/components/products/product-rating-display.tsx` for rating display
44. [ ] Update `src/app/[locale]/products/[slug]/page.tsx` to integrate reviews
45. [ ] Create `src/app/[locale]/admin/reviews/page.tsx` for review moderation

### Phase 5: Transaction Tracking
46. [ ] Update `src/app/[locale]/products/[slug]/page.tsx` handleViewAtStore to track clicks
47. [ ] Implement `trackProductClick` in `src/lib/transactions/tracking.ts`
48. [ ] Implement `generateAffiliateUrl` in `src/lib/transactions/tracking.ts`
49. [ ] Create `src/app/api/transactions/conversion/route.ts` for conversion tracking
50. [ ] Update `src/app/[locale]/admin/transactions/page.tsx` with commission display
51. [ ] Create `src/app/[locale]/store/transactions/page.tsx` for store transactions

### Phase 6: Price Alerts & Notifications
52. [ ] Create `src/app/[locale]/price-alerts/page.tsx` with alerts list
53. [ ] Create `src/components/products/price-alert-card.tsx` for alert display
54. [ ] Create `src/app/api/cron/check-price-alerts/route.ts` for alert checking job
55. [ ] Create `src/app/[locale]/settings/notifications/page.tsx` for notification preferences

### Phase 7: Advanced Search
56. [ ] Create `src/components/search/advanced-filters.tsx` with all filter options
57. [ ] Update `src/app/[locale]/search/page.tsx` to use advanced filters
58. [ ] Create `src/components/search/saved-searches.tsx` for saved searches
59. [ ] Create `scripts/database/07-saved-searches-schema.sql` for saved_searches table
60. [ ] Create `src/lib/search/saved-searches.ts` for saved search functions
61. [ ] Create `src/app/[locale]/admin/analytics/search/page.tsx` for search analytics

### Phase 8: Image Gallery & Media
62. [ ] Create `src/components/products/image-gallery-modal.tsx` full-screen gallery
63. [ ] Update `src/app/[locale]/products/[slug]/page.tsx` to open gallery on image click
64. [ ] Create `src/components/products/product-video-player.tsx` for video display
65. [ ] Update `src/app/[locale]/products/[slug]/page.tsx` to display video if exists
66. [ ] Create `src/components/products/image-zoom.tsx` for zoom functionality

### Phase 9: Cart & Checkout
67. [ ] Update `src/lib/cart/cart-context.tsx` with database sync and store grouping
68. [ ] Create `src/components/cart/cart-summary.tsx` with store grouping
69. [ ] Create `src/app/[locale]/cart/page.tsx` cart page
70. [ ] Create `src/app/[locale]/checkout/page.tsx` checkout page

### Phase 10: Polish & Legal
71. [ ] Create `src/app/[locale]/unauthorized/page.tsx` unauthorized access page
72. [ ] Create `src/app/[locale]/terms/page.tsx` Terms of Service page
73. [ ] Create `src/app/[locale]/privacy/page.tsx` Privacy Policy page
74. [ ] Update `src/app/[locale]/wishlist/page.tsx` to display and edit notes
75. [ ] Create `src/components/wishlist/wishlist-item-note-dialog.tsx` for note editing
76. [ ] Update `src/app/[locale]/stores/[slug]/page.tsx` to display store policies
77. [ ] Create `src/components/products/product-specifications.tsx` for specs display
78. [ ] Update `src/app/[locale]/products/[slug]/page.tsx` to display specifications
79. [ ] Update `src/app/[locale]/products/[slug]/page.tsx` to track view_count
80. [ ] Create `src/app/api/products/[id]/view/route.ts` for view count API
81. [ ] Update wishlist functions to track save_count
82. [ ] Update compare page to track comparison_count
83. [ ] Create `src/app/api/store/sync/[storeId]/route.ts` for store data sync
84. [ ] Install dependencies: recharts, react-hook-form, zod, date-fns (if needed)
85. [ ] Update translations files with all new strings
86. [ ] Test all features end-to-end
87. [ ] Fix any bugs or edge cases
88. [ ] Optimize performance (queries, caching, etc.)

---

## Translation Files to Update

**Files to update**:
- `messages/ar/admin.json` - Admin dashboard translations
- `messages/en/admin.json` - Admin dashboard translations
- `messages/ar/store.json` - Store dashboard translations
- `messages/en/store.json` - Store dashboard translations
- `messages/ar/product.json` - Product review translations
- `messages/en/product.json` - Product review translations
- `messages/ar/transactions.json` - Transaction translations
- `messages/en/transactions.json` - Transaction translations
- `messages/ar/analytics.json` - Analytics translations
- `messages/en/analytics.json` - Analytics translations

---

## Notes

1. **Email/SMS Notifications**: Code structure exists in `src/lib/auth/notifications.ts`. Email/SMS sending is currently stubbed out and will work once external services (SendGrid, Authentica) are configured. In-app notifications are fully functional.

2. **Edge Functions**: For scheduled jobs (price sync, alert checking), create Supabase Edge Functions in `supabase/functions/` directory. These can be scheduled using Supabase cron or external cron services.

3. **Image Optimization**: Use Next.js Image component throughout for all product images to ensure optimal performance.

4. **Error Handling**: All API routes and components should include proper error handling and user feedback via toast notifications.

5. **Loading States**: All data-fetching components should include loading states using Skeleton components from `src/components/ui/skeleton.tsx`.

6. **Accessibility**: Ensure all new components follow WCAG 2.1 guidelines and include proper ARIA labels.

7. **Type Safety**: Maintain full TypeScript coverage. All database queries should use types from `src/lib/database/types.ts`.

8. **RLS Policies**: Ensure all new tables have proper RLS policies defined in separate SQL files following the existing pattern.

---

**End of Implementation Plan**


# Complete Implementation Plan
## Tawveeri Customer UI/UX - Full Feature Implementation

**Date:** 2025-11-06  
**Status:** APPROVED PLAN  
**Approach:** Critical Path First + Reusable Components + Feature-Complete Iteration

---

## 📋 PLAN OVERVIEW

This plan implements ALL features from `CUSTOMER_UI_UX_REQUIREMENTS.md` and fixes all broken links. The implementation follows existing design patterns, maintains consistency, and delivers complete features end-to-end. **Note:** Apple ID login has been removed per requirements. Multi-Store Cart and SSO are noted but marked as Phase 2+ and Optional respectively.

### Implementation Strategy

1. **Phase 1:** Fix critical broken links (dashboard, profile, products, stores, deals)
2. **Phase 2:** Build reusable components (ProductCard, StoreCard, SearchBar, etc.)
3. **Phase 3:** Implement core features (search, products, comparison, wishlist)
4. **Phase 4:** User account features (profile, settings, dashboard)
5. **Phase 5:** Store features (store pages, reviews, ratings)
6. **Phase 6:** Notifications & alerts (notification center, settings)
7. **Phase 7:** Additional features (voice search, scanner, etc.)
8. **Phase 8:** Polish & optimization

---

## PHASE 1: CRITICAL BROKEN LINKS FIX (Priority: URGENT)

### 1.1 Products Page (`/[locale]/products`)

**File:** `src/app/[locale]/products/page.tsx`

**Implementation:**
- Create products listing page
- Use container layout (same as landing page)
- Display products in grid layout
- Add search bar at top
- Add category filter tabs
- Add sorting options (lowest price, popularity, rating)
- Add pagination
- Show products count
- Use ProductCard component (to be created in Phase 2)
- Add breadcrumbs: Home > Products
- Support RTL/LTR
- Support dark mode
- Add loading states
- Add empty states
- Add error states

**Database Query:**
```typescript
// Fetch products with store prices
const { data, error } = await supabase
  .from('products')
  .select(`
    *,
    product_stores(
      current_price,
      original_price,
      availability,
      stores(
        id,
        name_ar,
        name_en,
        logo_url,
        slug
      )
    )
  `)
  .eq('is_active', true)
  .order('view_count', { ascending: false })
  .range(offset, offset + limit - 1);
```

**Translation Keys:**
- `products.title`
- `products.subtitle`
- `products.allProducts`
- `products.noProducts`
- `products.loading`
- `products.error`

**Files to Create:**
1. `src/app/[locale]/products/page.tsx`
2. `messages/en/products.json`
3. `messages/ar/products.json`

---

### 1.2 Dashboard Page (`/[locale]/dashboard`)

**File:** `src/app/[locale]/dashboard/page.tsx`

**Implementation:**
- Create user dashboard page
- Show user's wishlist count
- Show recent searches
- Show active price alerts
- Show recent notifications
- Show recently viewed products
- Add quick actions (search, compare, view wishlist)
- Use Card components for widgets
- Add stats (total saved, products compared, etc.)
- Support guest mode (show limited info)
- Add "Sign in to unlock features" message for guests
- Support RTL/LTR
- Support dark mode

**Database Queries:**
```typescript
// Fetch user's wishlist count
const { count } = await supabase
  .from('user_wishlists')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId);

// Fetch recent searches
const { data: searches } = await supabase
  .from('search_history')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(5);

// Fetch active price alerts
const { data: alerts } = await supabase
  .from('price_alerts')
  .select('*, products(*)')
  .eq('user_id', userId)
  .eq('is_active', true);

// Fetch recent notifications
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .eq('is_read', false)
  .order('created_at', { ascending: false })
  .limit(5);
```

**Translation Keys:**
- `dashboard.title`
- `dashboard.welcome`
- `dashboard.wishlistCount`
- `dashboard.recentSearches`
- `dashboard.activeAlerts`
- `dashboard.recentNotifications`
- `dashboard.guestMessage`
- `dashboard.signInToUnlock`

**Files to Create:**
1. `src/app/[locale]/dashboard/page.tsx`
2. `messages/en/dashboard.json`
3. `messages/ar/dashboard.json`

---

### 1.3 Profile/Settings Page (`/[locale]/profile`)

**File:** `src/app/[locale]/profile/page.tsx`

**Implementation:**
- Create profile settings page
- Show user avatar (editable)
- Show full name (editable)
- Show email (read-only, with verified badge)
- Show phone (editable)
- Add "Change Password" section
- Add "Delete Account" section (with confirmation dialog)
- Add language preference selector
- Add notification preferences
- Add "Save Changes" button
- Use form layout (similar to auth pages)
- Add validation
- Add success/error toasts
- Support RTL/LTR
- Support dark mode

**Backend Functions to Use:**
- `updateProfile` from `src/lib/auth/profile.ts`
- `updatePassword` from `src/lib/auth/auth-context.tsx`
- `deleteAccount` from `src/lib/auth/profile.ts`

**Database Queries:**
```typescript
// Fetch user profile
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

**Translation Keys:**
- `profile.title`
- `profile.editProfile`
- `profile.personalInfo`
- `profile.fullName`
- `profile.email`
- `profile.phone`
- `profile.verified`
- `profile.changePassword`
- `profile.deleteAccount`
- `profile.deleteAccountConfirm`
- `profile.saveChanges`
- `profile.changesSaved`

**Files to Create:**
1. `src/app/[locale]/profile/page.tsx`
2. `messages/en/profile.json`
3. `messages/ar/profile.json`

---

### 1.4 Stores Page (`/[locale]/stores`)

**File:** `src/app/[locale]/stores/page.tsx`

**Implementation:**
- Create stores listing page
- Display all stores in grid
- Use StoreCard component (to be created in Phase 2)
- Show store logo, name, rating, total products
- Add search/filter for stores
- Add sorting (by name, rating, products count)
- Link to individual store pages (to be created in Phase 5)
- Add breadcrumbs: Home > Stores
- Support RTL/LTR
- Support dark mode
- Add loading/empty/error states

**Database Query:**
```typescript
// Fetch all active stores
const { data, error } = await supabase
  .from('stores')
  .select('*')
  .eq('status', 'active')
  .order('is_featured', { ascending: false })
  .order('average_rating', { ascending: false });
```

**Translation Keys:**
- `stores.title`
- `stores.allStores`
- `stores.noStores`
- `stores.loading`
- `stores.error`
- `stores.rating`
- `stores.productsCount`

**Files to Create:**
1. `src/app/[locale]/stores/page.tsx`
2. `messages/en/stores.json`
3. `messages/ar/stores.json`

---

### 1.5 Deals Page (`/[locale]/deals`)

**File:** `src/app/[locale]/deals/page.tsx`

**Implementation:**
- Create daily deals page
- Display products with deals (is_deal = true)
- Show deal badges
- Show deal expiration time
- Show savings amount/percentage
- Use ProductCard component with deal highlighting
- Add filters (category, store, deal type)
- Add sorting (best deals, ending soon)
- Add breadcrumbs: Home > Deals
- Support RTL/LTR
- Support dark mode
- Add loading/empty/error states

**Database Query:**
```typescript
// Fetch products with active deals
const { data, error } = await supabase
  .from('product_stores')
  .select(`
    *,
    products(*),
    stores(*)
  `)
  .eq('is_deal', true)
  .gt('deal_expires_at', new Date().toISOString())
  .order('deal_expires_at', { ascending: true });
```

**Translation Keys:**
- `deals.title`
- `deals.dailyDeals`
- `deals.endingSoon`
- `deals.bestDeals`
- `deals.noDeals`
- `deals.loading`
- `deals.error`
- `deals.expiresIn`

**Files to Create:**
1. `src/app/[locale]/deals/page.tsx`
2. `messages/en/deals.json`
3. `messages/ar/deals.json`

---

## PHASE 2: REUSABLE COMPONENTS (Foundation)

### 2.1 ProductCard Component

**File:** `src/components/products/product-card.tsx`

**Props:**
```typescript
interface ProductCardProps {
  product: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    category: ProductCategory;
    brand: string;
    model: string;
    image_urls: string[] | null;
    product_stores: Array<{
      current_price: number;
      original_price: number | null;
      availability: AvailabilityStatus;
      stores: {
        id: string;
        name_ar: string;
        name_en: string;
        logo_url: string | null;
      };
    }>;
  };
  locale: string;
  onCompare?: (productId: string) => void;
  onSave?: (productId: string) => void;
  showActions?: boolean;
}
```

**Features:**
- Display product image (first image from array, with fallback)
- Display product name (localized)
- Display brand and model
- Display best price from all stores
- Display store count
- Show "Best Price" badge if applicable
- Show "Hot Deal" badge if deal exists
- Show "Out of Stock" badge if unavailable
- Add "Add to Compare" button
- Add "Save to Wishlist" button (heart icon)
- Link to product detail page
- Hover effects (lift, shadow)
- Responsive grid layout
- Support RTL/LTR
- Support dark mode

**Styling:**
- Use Card component as base
- Use Price component for prices
- Use Badge component for badges
- Follow ComparisonCard styling patterns
- Add hover:shadow-xl, hover:-translate-y-1
- Use consistent spacing (p-6, gap-4)

**Files to Create:**
1. `src/components/products/product-card.tsx`

---

### 2.2 StoreCard Component

**File:** `src/components/stores/store-card.tsx`

**Props:**
```typescript
interface StoreCardProps {
  store: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    logo_url: string | null;
    average_rating: number;
    total_reviews: number;
    total_products: number;
    is_featured: boolean;
    is_premium: boolean;
  };
  locale: string;
  onViewStore?: (storeId: string) => void;
}
```

**Features:**
- Display store logo (with fallback)
- Display store name (localized)
- Display average rating with stars
- Display total reviews count
- Display total products count
- Show "Featured" badge if featured
- Show "Premium" badge if premium
- Link to store page
- Hover effects
- Responsive layout
- Support RTL/LTR
- Support dark mode

**Styling:**
- Use Card component as base
- Use Badge component for badges
- Use Star icon from lucide-react
- Follow existing card patterns
- Consistent spacing and shadows

**Files to Create:**
1. `src/components/stores/store-card.tsx`

---

### 2.3 SearchBar Component

**File:** `src/components/search/search-bar.tsx`

**Props:**
```typescript
interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  onSearch: (query: string, filters?: SearchFilters) => void;
  showSuggestions?: boolean;
  showFilters?: boolean;
  className?: string;
}
```

**Features:**
- Search input with icon
- Auto-suggestions dropdown (when typing)
- Category selector (dropdown)
- "Search" button
- Voice search button (optional, Phase 7)
- Barcode scanner button (optional, Phase 7)
- Search history dropdown
- Recent searches display
- Clear search button
- Loading state during search
- Debounce input (300ms)
- Support RTL/LTR
- Support dark mode

**Database Query for Suggestions:**
```typescript
// Fetch search suggestions
const { data } = await supabase
  .from('products')
  .select('name_ar, name_en, slug, category, brand')
  .textSearch('search_vector', query, { type: 'plain', config: locale === 'ar' ? 'arabic' : 'english' })
  .limit(10);
```

**Files to Create:**
1. `src/components/search/search-bar.tsx`
2. `src/components/search/search-suggestions.tsx` (if needed)

---

### 2.4 FilterSidebar Component

**File:** `src/components/search/filter-sidebar.tsx`

**Props:**
```typescript
interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
  category?: ProductCategory;
  locale: string;
}
```

**Features:**
- Brand filter (multi-select checkboxes)
- Price range filter (slider)
- Store filter (multi-select checkboxes)
- Category-specific filters (dynamic based on category):
  - TV: Screen size, resolution, smart features
  - Laptop: RAM, storage, processor, screen size
  - Smartphone: RAM, storage, screen size, camera
  - Tablet: Screen size, storage, connectivity
  - Audio: Type, connectivity, battery life
  - Gaming: Console type, accessories
- Availability filter (in stock, out of stock)
- Deal filter (show only deals)
- "Clear Filters" button
- "Apply Filters" button
- Collapsible sections (Accordion component)
- Support RTL/LTR
- Support dark mode

**Database Queries:**
```typescript
// Fetch available brands for category
const { data: brands } = await supabase
  .from('products')
  .select('brand')
  .eq('category', category)
  .eq('is_active', true);

// Fetch price range for category
const { data: prices } = await supabase
  .from('product_stores')
  .select('current_price')
  .eq('products.category', category)
  .order('current_price', { ascending: true })
  .limit(1);
```

**Files to Create:**
1. `src/components/search/filter-sidebar.tsx`

---

### 2.5 PriceHistoryChart Component

**File:** `src/components/products/price-history-chart.tsx`

**Props:**
```typescript
interface PriceHistoryChartProps {
  productStoreId: string;
  productName: string;
  storeName: string;
  locale: string;
  height?: number;
}
```

**Features:**
- Display price history line chart
- Show price over time (last 30/90/365 days)
- Show current price marker
- Show price drop indicators
- Interactive tooltip on hover
- Time range selector (30/90/365 days)
- Support RTL/LTR
- Support dark mode

**Libraries to Install:**
- `recharts` or `chart.js` for charts

**Database Query:**
```typescript
// Fetch price history
const { data } = await supabase
  .from('price_history')
  .select('price, recorded_at')
  .eq('product_store_id', productStoreId)
  .order('recorded_at', { ascending: true })
  .gte('recorded_at', startDate.toISOString());
```

**Files to Create:**
1. `src/components/products/price-history-chart.tsx`

---

## PHASE 3: CORE FEATURES

### 3.1 Product Search Functionality

**File:** `src/app/[locale]/search/page.tsx`

**Implementation:**
- Create search results page
- Use SearchBar component at top
- Use FilterSidebar on left (desktop) / bottom (mobile)
- Display search results using ProductCard grid
- Show results count
- Show sort options (dropdown)
- Show view toggle (grid/list)
- Add pagination
- Add loading states
- Add empty states (no results)
- Add error states
- Track search history (save to database)
- Support URL params for sharing search results
- Support RTL/LTR
- Support dark mode

**Database Query:**
```typescript
// Search products with filters
let query = supabase
  .from('products')
  .select(`
    *,
    product_stores(
      current_price,
      original_price,
      availability,
      stores(*)
    )
  `)
  .eq('is_active', true);

// Apply text search
if (searchQuery) {
  query = query.textSearch('search_vector', searchQuery, {
    type: 'plain',
    config: locale === 'ar' ? 'arabic' : 'english'
  });
}

// Apply category filter
if (category) {
  query = query.eq('category', category);
}

// Apply brand filter
if (brands.length > 0) {
  query = query.in('brand', brands);
}

// Apply price range
if (minPrice) {
  query = query.gte('product_stores.current_price', minPrice);
}
if (maxPrice) {
  query = query.lte('product_stores.current_price', maxPrice);
}

// Apply store filter
if (storeIds.length > 0) {
  query = query.in('product_stores.store_id', storeIds);
}

// Apply sorting
if (sortBy === 'price_low') {
  query = query.order('product_stores.current_price', { ascending: true });
} else if (sortBy === 'price_high') {
  query = query.order('product_stores.current_price', { ascending: false });
} else if (sortBy === 'popularity') {
  query = query.order('view_count', { ascending: false });
} else if (sortBy === 'rating') {
  query = query.order('save_count', { ascending: false }); // Using save_count as proxy for rating
}

// Apply pagination
const { data, error, count } = await query.range(offset, offset + limit - 1);
```

**Save Search History:**
```typescript
// Save search to history
if (user) {
  await supabase
    .from('search_history')
    .insert({
      user_id: user.id,
      search_query: searchQuery,
      category: category || null,
      filters: filters,
      results_count: count || 0
    });
}
```

**Translation Keys:**
- `search.title`
- `search.results`
- `search.resultsCount`
- `search.noResults`
- `search.loading`
- `search.error`
- `search.sortBy`
- `search.sortPriceLow`
- `search.sortPriceHigh`
- `search.sortPopularity`
- `search.sortRating`

**Files to Create:**
1. `src/app/[locale]/search/page.tsx`
2. `messages/en/search.json`
3. `messages/ar/search.json`

---

### 3.2 Product Detail Page

**File:** `src/app/[locale]/products/[slug]/page.tsx`

**Implementation:**
- Create product detail page with dynamic route
- Fetch product by slug
- Display product image gallery (carousel)
- Display product name, brand, model
- Display product specifications (accordion)
- Display product description
- Display product video (if available, embedded YouTube)
- Display available stores with prices (ComparisonCard components)
- Display price history chart (PriceHistoryChart component)
- Display product availability for each store
- Add "Add to Compare" button
- Add "Save to Wishlist" button
- Add "Set Price Alert" button
- Add "Share" button
- Add "View at Store" buttons (redirect with affiliate tracking)
- Track product view (increment view_count)
- Add breadcrumbs: Home > Products > Category > Product Name
- Add related products section
- Support RTL/LTR
- Support dark mode
- Add loading/error states

**Database Query:**
```typescript
// Fetch product with all details
const { data: product, error } = await supabase
  .from('products')
  .select(`
    *,
    product_stores(
      *,
      stores(*),
      price_history(
        price,
        recorded_at
      )
    )
  `)
  .eq('slug', slug)
  .eq('is_active', true)
  .single();

// Increment view count
await supabase
  .from('products')
  .update({ view_count: product.view_count + 1 })
  .eq('id', product.id);

// Fetch related products
const { data: related } = await supabase
  .from('products')
  .select(`
    *,
    product_stores(
      current_price,
      stores(*)
    )
  `)
  .eq('category', product.category)
  .neq('id', product.id)
  .eq('is_active', true)
  .limit(4);
```

**Affiliate Tracking:**
```typescript
// Create transaction record for tracking
const { data: transaction } = await supabase
  .from('transactions')
  .insert({
    user_id: user?.id || null,
    product_store_id: productStoreId,
    click_id: generateClickId(),
    clicked_at: new Date().toISOString(),
    user_agent: navigator.userAgent,
    referrer: document.referrer
  })
  .select()
  .single();

// Redirect to affiliate URL with tracking
const affiliateUrl = `${productStore.affiliate_url}?click_id=${transaction.click_id}`;
window.open(affiliateUrl, '_blank');
```

**Translation Keys:**
- `product.title`
- `product.specifications`
- `product.description`
- `product.availableStores`
- `product.priceHistory`
- `product.addToCompare`
- `product.saveToWishlist`
- `product.setPriceAlert`
- `product.share`
- `product.viewAtStore`
- `product.relatedProducts`
- `product.inStock`
- `product.outOfStock`
- `product.limitedStock`

**Files to Create:**
1. `src/app/[locale]/products/[slug]/page.tsx`
2. `messages/en/product.json`
3. `messages/ar/product.json`

---

### 3.3 Comparison Page

**File:** `src/app/[locale]/compare/page.tsx`

**Implementation:**
- Create comparison page
- Display comparison table (side-by-side)
- Show product images, names, prices
- Show specifications comparison
- Show store comparison (prices, availability, delivery)
- Add "Remove from Comparison" buttons
- Add "Clear Comparison" button
- Add "Add More Products" button (opens search)
- Support comparing 2-4 products
- Show "Add more products" message if less than 2
- Export comparison (PDF/CSV) - optional
- Support RTL/LTR (table flips direction)
- Support dark mode
- Add loading/empty states

**Database Query:**
```typescript
// Fetch products to compare
const { data: products } = await supabase
  .from('products')
  .select(`
    *,
    product_stores(
      *,
      stores(*)
    )
  `)
  .in('id', productIds)
  .eq('is_active', true);
```

**Comparison Storage:**
- Use localStorage or context to store comparison list
- Or create comparison table in database (if needed)

**Translation Keys:**
- `compare.title`
- `compare.comparingProducts`
- `compare.addMore`
- `compare.remove`
- `compare.clear`
- `compare.export`
- `compare.specifications`
- `compare.prices`
- `compare.stores`
- `compare.noProducts`

**Files to Create:**
1. `src/app/[locale]/compare/page.tsx`
2. `src/components/compare/comparison-table.tsx`
3. `messages/en/compare.json`
4. `messages/ar/compare.json`

---

### 3.4 Wishlist Page

**File:** `src/app/[locale]/wishlist/page.tsx`

**Implementation:**
- Create wishlist page
- Display saved products in grid (ProductCard components)
- Show empty state if no items
- Show "Sign in to save products" message for guests
- Add "Remove from Wishlist" buttons
- Add "Add to Comparison" buttons
- Add "Clear Wishlist" button
- Add filters/sorting
- Support RTL/LTR
- Support dark mode
- Add loading/error states

**Database Query:**
```typescript
// Fetch user's wishlist
const { data: wishlist } = await supabase
  .from('user_wishlists')
  .select(`
    *,
    products(
      *,
      product_stores(
        current_price,
        original_price,
        stores(*)
      )
    )
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Add to Wishlist Function:**
```typescript
// Add product to wishlist
const addToWishlist = async (productId: string) => {
  if (!user) {
    // Redirect to login
    router.push(`/${locale}/auth/login?redirect=/wishlist`);
    return;
  }

  const { error } = await supabase
    .from('user_wishlists')
    .insert({
      user_id: user.id,
      product_id: productId
    });

  if (!error) {
    toast({ title: t('wishlist.added'), variant: 'default' });
  }
};
```

**Translation Keys:**
- `wishlist.title`
- `wishlist.myWishlist`
- `wishlist.empty`
- `wishlist.signInMessage`
- `wishlist.remove`
- `wishlist.clear`
- `wishlist.added`
- `wishlist.removed`

**Files to Create:**
1. `src/app/[locale]/wishlist/page.tsx`
2. `src/lib/wishlist/wishlist.ts` (utility functions)
3. `messages/en/wishlist.json`
4. `messages/ar/wishlist.json`

---

## PHASE 4: USER ACCOUNT FEATURES

### 4.1 Profile Editing (Enhancement)

**Enhance:** `src/app/[locale]/profile/page.tsx` (already created in Phase 1.3)

**Additional Features:**
- Avatar upload functionality
- Phone verification
- Email verification resend

**Files to Update:**
1. `src/app/[locale]/profile/page.tsx`

---

### 4.2 Account Settings Page

**File:** `src/app/[locale]/settings/page.tsx`

**Implementation:**
- Create account settings page
- Notification preferences:
  - Email notifications (toggle)
  - SMS notifications (toggle)
  - Push notifications (toggle)
  - Price drop alerts (toggle)
  - Back in stock alerts (toggle)
  - Deal alerts (toggle)
- Privacy settings:
  - Profile visibility
  - Search history visibility
- Language preference
- Theme preference (already in header, but can add here)
- Data export (download user data)
- Delete account (with confirmation)
- Support RTL/LTR
- Support dark mode

**Database Queries:**
```typescript
// Save notification preferences (create user_preferences table if needed)
// Or use existing users table with JSONB column
```

**Translation Keys:**
- `settings.title`
- `settings.notifications`
- `settings.privacy`
- `settings.preferences`
- `settings.emailNotifications`
- `settings.smsNotifications`
- `settings.pushNotifications`
- `settings.priceAlerts`
- `settings.stockAlerts`
- `settings.dealAlerts`
- `settings.savePreferences`

**Files to Create:**
1. `src/app/[locale]/settings/page.tsx`
2. `messages/en/settings.json`
3. `messages/ar/settings.json`

---

### 4.3 Dashboard Enhancements

**Enhance:** `src/app/[locale]/dashboard/page.tsx` (already created in Phase 1.2)

**Additional Features:**
- Recently viewed products
- Personalized recommendations (based on past searches and saved items)
- AI-powered smart recommendations (similar products or better deals)
- Favorites section (user's favorite products)
- Price alert status
- Saved searches
- Comparison history
- Statistics charts
- Quick actions widgets

**Files to Update:**
1. `src/app/[locale]/dashboard/page.tsx`

---

## PHASE 5: STORE FEATURES

### 5.1 Store Detail Page

**File:** `src/app/[locale]/stores/[slug]/page.tsx`

**Implementation:**
- Create store detail page with dynamic route
- Display store logo, name, description
- Display store rating and reviews
- Display store policies (delivery, return, warranty)
- Display store contact info
- Display products from this store (grid)
- Add "Write Review" button
- Display store reviews
- Support RTL/LTR
- Support dark mode
- Add loading/error states

**Database Query:**
```typescript
// Fetch store details
const { data: store } = await supabase
  .from('stores')
  .select(`
    *,
    store_reviews(
      *,
      users(
        full_name,
        avatar_url
      )
    )
  `)
  .eq('slug', slug)
  .eq('status', 'active')
  .single();

// Fetch products from store
const { data: products } = await supabase
  .from('product_stores')
  .select(`
    *,
    products(*)
  `)
  .eq('store_id', store.id)
  .eq('products.is_active', true)
  .limit(20);
```

**Translation Keys:**
- `store.title`
- `store.rating`
- `store.reviews`
- `store.writeReview`
- `store.deliveryInfo`
- `store.returnPolicy`
- `store.warrantyInfo`
- `store.contactInfo`
- `store.products`

**Files to Create:**
1. `src/app/[locale]/stores/[slug]/page.tsx`
2. `messages/en/store.json`
3. `messages/ar/store.json`

---

### 5.2 Store Review System

**File:** `src/components/stores/store-review-form.tsx`

**Implementation:**
- Create review submission form
- Rating input (1-5 stars)
- Review text (textarea)
- Category ratings (delivery, product quality, customer service)
- "Verified Purchase" badge (if applicable)
- Submit button
- Validation
- Success/error handling

**Database Query:**
```typescript
// Submit review
const { error } = await supabase
  .from('store_reviews')
  .insert({
    store_id: storeId,
    user_id: userId,
    rating: rating,
    review_text: reviewText,
    delivery_rating: deliveryRating,
    product_quality_rating: productQualityRating,
    customer_service_rating: customerServiceRating,
    is_verified_purchase: isVerifiedPurchase
  });

// Update store average rating
// (This should be done via database trigger or function)
```

**Files to Create:**
1. `src/components/stores/store-review-form.tsx`
2. `src/components/stores/store-review-card.tsx` (for displaying reviews)

---

## PHASE 6: NOTIFICATIONS & ALERTS

### 6.1 Notification Center

**File:** `src/app/[locale]/notifications/page.tsx`

**Implementation:**
- Create notification center page
- Display all notifications (list)
- Mark as read/unread
- Filter by type (price drop, back in stock, deals)
- Delete notifications
- Mark all as read
- Click notification to go to product
- Support pagination
- Support RTL/LTR
- Support dark mode
- Add loading/empty states

**Database Query:**
```typescript
// Fetch notifications
const { data: notifications } = await supabase
  .from('notifications')
  .select(`
    *,
    products(*),
    product_stores(*)
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

**Backend Functions:**
- Use `getUserNotifications` from `src/lib/auth/notifications.ts`
- Use `markNotificationAsRead` (to be created)

**Translation Keys:**
- `notifications.title`
- `notifications.all`
- `notifications.unread`
- `notifications.priceDrop`
- `notifications.backInStock`
- `notifications.deals`
- `notifications.markAllRead`
- `notifications.delete`
- `notifications.empty`

**Files to Create:**
1. `src/app/[locale]/notifications/page.tsx`
2. `messages/en/notifications.json`
3. `messages/ar/notifications.json`

---

### 6.2 Price Alert Setup

**File:** `src/components/products/price-alert-dialog.tsx`

**Implementation:**
- Create price alert dialog
- Show current price
- Input for target price
- Toggle for active/inactive
- Save button
- Display existing alerts on product page
- Delete alert functionality

**Database Query:**
```typescript
// Create price alert
const { error } = await supabase
  .from('price_alerts')
  .insert({
    user_id: userId,
    product_id: productId,
    target_price: targetPrice,
    is_active: true
  });
```

**Files to Create:**
1. `src/components/products/price-alert-dialog.tsx`

---

### 6.3 Notification Settings

**Already implemented in Phase 4.2 (Account Settings Page)**

---

## PHASE 7: ADDITIONAL FEATURES

### 7.1 Search History UI

**File:** `src/components/search/search-history.tsx`

**Implementation:**
- Display recent searches
- Clear search history
- Click to re-search
- Show in search bar dropdown
- Show on dashboard

**Database Query:**
```typescript
// Fetch search history
const { data: history } = await supabase
  .from('search_history')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);
```

**Files to Create:**
1. `src/components/search/search-history.tsx`

---

### 7.2 Voice Search

**File:** `src/components/search/voice-search-button.tsx`

**Implementation:**
- Voice search button
- Use Web Speech API
- Support Arabic and English
- Display transcript
- Auto-submit search

**Libraries:**
- Web Speech API (browser native)

**Files to Create:**
1. `src/components/search/voice-search-button.tsx`

---

### 7.3 Barcode/QR Scanner

**File:** `src/components/search/barcode-scanner.tsx`

**Implementation:**
- Barcode scanner button
- Open camera modal
- Scan barcode/QR code
- Search for product by barcode/SKU
- Display product if found

**Libraries:**
- `html5-qrcode` or `react-qr-reader`

**Files to Create:**
1. `src/components/search/barcode-scanner.tsx`

---

### 7.4 Multi-Store Cart (Phase 2+)

**Note:** This is a Phase 2+ feature as specified in requirements. Implementation details will be added in Phase 2 planning.

**Requirements:**
- Add to cart functionality
- Cart page with products from different stores
- Cart management (remove items, update quantities)
- Checkout flow (redirect to appropriate stores)

---

### 7.5 Gift Option

**File:** `src/components/products/gift-option.tsx`

**Implementation:**
- Gift option button on product page
- Gift option integration with store links
- Gift wrapping options (when available)
- Share gift link functionality

**Files to Create:**
1. `src/components/products/gift-option.tsx`

---

### 7.6 Single Sign-On (Optional)

**Note:** This is an optional feature as specified in requirements.

**Requirements:**
- OAuth support for corporate or academic accounts
- SSO integration for enterprise users

**Implementation:**
- Add SSO configuration in settings
- Support enterprise OAuth providers
- SSO login option on login page

---

## PHASE 8: POLISH & OPTIMIZATION

### 8.1 Guest Limitations UI

**Implementation:**
- Add "Sign in to unlock" messages throughout app
- Show feature comparison (guest vs. registered)
- Add sign-in prompts on wishlist, alerts, etc.

**Files to Update:**
- All pages that require authentication

---

### 8.2 Phone OTP Integration

**Enhance:** `src/app/[locale]/auth/login/page.tsx` and `signup/page.tsx`

**Implementation:**
- Integrate OTP sending (Supabase Auth)
- Integrate OTP verification
- Add OTP input component
- Add resend OTP functionality

**Files to Update:**
1. `src/app/[locale]/auth/login/page.tsx`
2. `src/app/[locale]/auth/signup/page.tsx`

---

### 8.3 Performance Optimization

**Implementation:**
- Image optimization (Next.js Image component)
- Lazy loading for product cards
- Pagination optimization
- Search debouncing
- Caching strategies
- Code splitting

**Files to Update:**
- All pages and components

---

### 8.4 Accessibility Enhancements

**Implementation:**
- ARIA labels on all interactive elements
- Keyboard navigation testing
- Screen reader testing
- High contrast mode support
- Focus indicators

**Files to Update:**
- All components

---

## TRANSLATION FILES TO CREATE

### English Translations:
1. `messages/en/products.json`
2. `messages/en/dashboard.json`
3. `messages/en/profile.json`
4. `messages/en/stores.json`
5. `messages/en/deals.json`
6. `messages/en/search.json`
7. `messages/en/product.json`
8. `messages/en/compare.json`
9. `messages/en/wishlist.json`
10. `messages/en/settings.json`
11. `messages/en/store.json`
12. `messages/en/notifications.json`

### Arabic Translations:
1. `messages/ar/products.json`
2. `messages/ar/dashboard.json`
3. `messages/ar/profile.json`
4. `messages/ar/stores.json`
5. `messages/ar/deals.json`
6. `messages/ar/search.json`
7. `messages/ar/product.json`
8. `messages/ar/compare.json`
9. `messages/ar/wishlist.json`
10. `messages/ar/settings.json`
11. `messages/ar/store.json`
12. `messages/ar/notifications.json`

---

## UTILITY FUNCTIONS TO CREATE

### 1. Product Utilities
**File:** `src/lib/products/products.ts`
- `searchProducts(query, filters)`
- `getProductBySlug(slug)`
- `getRelatedProducts(productId, category)`
- `incrementProductView(productId)`

### 2. Wishlist Utilities
**File:** `src/lib/wishlist/wishlist.ts`
- `addToWishlist(userId, productId)`
- `removeFromWishlist(userId, productId)`
- `getUserWishlist(userId)`
- `isInWishlist(userId, productId)`

### 3. Comparison Utilities
**File:** `src/lib/compare/compare.ts`
- `addToComparison(productId)`
- `removeFromComparison(productId)`
- `getComparison()`
- `clearComparison()`

### 4. Search Utilities
**File:** `src/lib/search/search.ts`
- `saveSearchHistory(userId, query, filters)`
- `getSearchHistory(userId)`
- `clearSearchHistory(userId)`
- `getSearchSuggestions(query, locale)`

### 5. Price Alert Utilities
**File:** `src/lib/alerts/alerts.ts`
- `createPriceAlert(userId, productId, targetPrice)`
- `getUserPriceAlerts(userId)`
- `deletePriceAlert(alertId)`
- `updatePriceAlert(alertId, updates)`

---

## API ROUTES TO CREATE (If Needed)

### 1. Affiliate Tracking
**File:** `src/app/api/track-click/route.ts`
- Track affiliate clicks
- Generate click IDs
- Store transaction records

### 2. Search API
**File:** `src/app/api/search/route.ts`
- Server-side search endpoint
- Caching for search results

### 3. Product Images
**File:** `src/app/api/products/[id]/images/route.ts`
- Serve optimized product images
- Image transformation

---

## DATABASE FUNCTIONS/TRIGGERS TO CREATE

### 1. Update Store Average Rating
**Function:** Update store average rating when review is added/updated/deleted

### 2. Price Change Notification
**Trigger:** Create notification when price drops below alert threshold

### 3. Stock Change Notification
**Trigger:** Create notification when product comes back in stock

---

## TESTING CHECKLIST

### Unit Tests:
- [ ] ProductCard component
- [ ] StoreCard component
- [ ] SearchBar component
- [ ] FilterSidebar component
- [ ] PriceHistoryChart component
- [ ] All utility functions

### Integration Tests:
- [ ] Product search flow
- [ ] Product detail page
- [ ] Comparison flow
- [ ] Wishlist flow
- [ ] Notification flow

### E2E Tests:
- [ ] Complete user journey (search → view → compare → wishlist)
- [ ] Authentication flows
- [ ] Guest vs. registered user flows

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment:
- [ ] All translation files created
- [ ] All pages tested in both languages (AR/EN)
- [ ] All pages tested in dark/light mode
- [ ] All pages tested in RTL/LTR
- [ ] All broken links fixed
- [ ] All database queries optimized
- [ ] All images optimized
- [ ] Performance testing completed
- [ ] Accessibility testing completed
- [ ] Mobile responsiveness tested

### Post-Deployment:
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Monitor user feedback
- [ ] Fix any issues immediately

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Critical Broken Links
- [ ] 1.1 Products page (`/[locale]/products`)
- [ ] 1.2 Dashboard page (`/[locale]/dashboard`)
- [ ] 1.3 Profile page (`/[locale]/profile`)
- [ ] 1.4 Stores page (`/[locale]/stores`)
- [ ] 1.5 Deals page (`/[locale]/deals`)

### Phase 2: Reusable Components
- [ ] 2.1 ProductCard component
- [ ] 2.2 StoreCard component
- [ ] 2.3 SearchBar component
- [ ] 2.4 FilterSidebar component
- [ ] 2.5 PriceHistoryChart component

### Phase 3: Core Features
- [ ] 3.1 Product search functionality
- [ ] 3.2 Product detail page
- [ ] 3.3 Comparison page
- [ ] 3.4 Wishlist page

### Phase 4: User Account Features
- [ ] 4.1 Profile editing (enhancement)
- [ ] 4.2 Account settings page
- [ ] 4.3 Dashboard enhancements

### Phase 5: Store Features
- [ ] 5.1 Store detail page
- [ ] 5.2 Store review system

### Phase 6: Notifications & Alerts
- [ ] 6.1 Notification center
- [ ] 6.2 Price alert setup
- [ ] 6.3 Notification settings

### Phase 7: Additional Features
- [ ] 7.1 Search history UI
- [ ] 7.2 Voice search
- [ ] 7.3 Barcode/QR scanner
- [ ] 7.4 Multi-Store Cart (Phase 2+ - note only)
- [ ] 7.5 Gift Option
- [ ] 7.6 Single Sign-On (Optional - note only)

### Phase 8: Polish & Optimization
- [ ] 8.1 Guest limitations UI
- [ ] 8.2 Phone OTP integration
- [ ] 8.3 Performance optimization
- [ ] 8.4 Accessibility enhancements

---

## NOTES

1. **Design Consistency:** All new pages must follow existing design patterns from auth pages and landing page
2. **RTL/LTR:** All components must support both directions
3. **Dark Mode:** All components must support dark mode
4. **Responsive:** All pages must be mobile-responsive
5. **Accessibility:** All interactive elements must have proper ARIA labels
6. **Performance:** All database queries must be optimized with proper indexes
7. **Error Handling:** All pages must have proper error states
8. **Loading States:** All async operations must show loading states
9. **Translation:** All text must be translatable (no hardcoded strings)
10. **Testing:** All features must be tested before deployment

---

**END OF PLAN**

This plan covers ALL features from the requirements document (except Apple ID login which has been removed) and ensures complete implementation of the customer UI/UX for Tawveeri. Multi-Store Cart is noted for Phase 2+ and SSO is noted as Optional as per requirements.


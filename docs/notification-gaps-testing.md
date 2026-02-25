# Notification Gaps Testing Guide

All tests check 3 things: **notifications** table, **admin_logs** table, and **email delivery** (SendGrid activity log or inbox).

> **Prerequisites**: App running on `localhost:3000`, Supabase dashboard open, SendGrid configured.

---

## Gap 1: User Role Changed by Admin ✅

1. Login as admin → go to `/admin/users`
2. Pick a test user, change their role (e.g. customer → store)
3. **Check**:
   - `notifications` table → row for target user with type `account`, title "Your Role Has Been Changed"
   - `admin_logs` table → row with action `user_role_updated`
   - Target user's email inbox → "Your Tawveeri Role Has Changed" email

---

## Gap 2: Email Signup → Welcome Email ✅

1. Sign up with a new email + password at `/auth/signup`
2. **Check**:
   - `notifications` table → welcome notification (already existed)
   - Target email inbox → "Welcome to Tawveeri" email
   - `admin_logs` table → `user_signup` entry

---

## Gap 3: Account Deletion ✅

1. Login as a test user (not admin)
2. Go to profile/settings → delete account
3. **Check**:
   - Email inbox → "Your Account Has Been Deleted" confirmation email
   - `admin_logs` table → `account_deleted` entry (persists after user deletion)
   - `notifications` row will be cascade-deleted with the user, but email persists

---

## Gap 4: Price Alert Created

1. Login → go to any product detail page
2. Click "Set Price Alert", enter a target price, save
3. **Check**:
   - `notifications` table → "Price Alert Created" with product name + target price
   - `admin_logs` table → `price_alert_created` entry

---

## Gap 5: Price Alert Deleted

1. Go to `/price-alerts` dashboard
2. Delete an existing price alert
3. **Check**:
   - `notifications` table → "Price Alert Deleted"
   - `admin_logs` table → `price_alert_deleted` entry

---

## Gap 6: Price Alert Toggled

1. Go to `/price-alerts` dashboard
2. Toggle an alert active/inactive
3. **Check**:
   - `notifications` table → "Price Alert Activated" or "Price Alert Deactivated"
   - `admin_logs` table → `price_alert_toggled` entry with `{ is_active: true/false }`

---

## Gap 7: New Coupon for Wishlisted Product

1. **Setup**: Ensure a user has a product in their wishlist
2. As admin, create a coupon targeting that product's `product_id`
3. Call the cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-coupon-wishlists
   ```
4. **Check**:
   - `notifications` table → type `deal`, "New Coupon" for each wishlisting user
   - User's email → "New Coupon for Your Wishlisted Product" email

---

## Gap 8: Coupon Expiry Warning

1. **Setup**: Create a coupon with `expires_at` = 2 days from now, `is_active = true`, on a store that has a `created_by` user
2. Call the cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-coupon-expiry
   ```
3. **Check**:
   - `notifications` table → store owner gets "Coupon Expiring Soon"
   - Store owner's email → "Coupon Expiring Soon" email

---

## Gap 9: Store Sync Completed

1. POST to the store sync endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/store/sync/STORE_UUID \
     -H "Content-Type: application/json" \
     -d '{"products": [{"product_id": "PRODUCT_UUID", "current_price": 999, "product_url": "https://example.com"}]}'
   ```
2. **Check**:
   - `notifications` table → store owner gets "Store Sync Completed" with counts
   - `admin_logs` table → `store_sync_completed` with details

---

## Gap 10: Coupon Updated by Admin

1. Login as admin → go to `/admin/coupons`
2. Edit any coupon (change discount value, etc.)
3. **Check**:
   - `notifications` table → store owner gets "Coupon Updated by Admin"
   - `admin_logs` table → `coupon_updated` entry (already existed)

---

## Gap 11: Coupon Deleted by Admin

1. Login as admin → go to `/admin/coupons`
2. Delete a coupon that belongs to a store with a `created_by` owner
3. **Check**:
   - `notifications` table → store owner gets "Coupon Deleted by Admin"
   - `admin_logs` table → `coupon_deleted` entry (already existed)

---

## Gap 12: Price Drop / Back-in-Stock Audit Logs

### Price Drop:
1. **Setup**: Create a price alert for a product, then manually lower the product's price in `product_stores`
2. Call the cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-price-alerts
   ```
3. **Check**:
   - `admin_logs` table → `price_drop_alert_sent` with target_price + current_price

### Back-in-Stock:
- Triggered automatically by the scraping orchestrator when a product transitions from `out_of_stock` → `in_stock`
- **Check** `admin_logs` → `back_in_stock_alert_sent` with users_notified count

---

## Gap 14: Login from New Device ✅

### Email login:
1. Login with email/password from a browser you haven't used before (or incognito)
2. **Check**:
   - `login_sessions` table → new row with device fingerprint
   - `notifications` table → "Login from New Device"
   - Email inbox → "Login from New Device" email
   - `admin_logs` → `new_device_login`

### Phone OTP login:
1. Login via phone OTP from a new browser/device
2. Same checks as above

### OAuth login:
1. Login via Google/Facebook from a new browser
2. Same checks as above

### Known device (no notification):
1. Login again from the same browser
2. **Check**: `login_sessions.last_seen_at` updated, NO new notification

> **Note**: The `login_sessions` table must exist first. Run:
> ```bash
> psql $SUPABASE_DB_URL -f scripts/database/12-login-sessions.sql
> ```

---

## Gap 15: Saved Search New Results

1. **Setup**:
   - Run migration: `psql $SUPABASE_DB_URL -f scripts/database/13-saved-searches-notify.sql`
   - Create a saved search in `saved_searches` table with `notify_on_new_results = true` and `last_result_count = 5`
2. Call the cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-saved-searches
   ```
3. **Check**:
   - `saved_searches` table → `last_result_count` and `last_checked_at` updated
   - If result count increased: `notifications` table → "New Results" notification
   - Email → "New Results for Your Saved Search"
   - `admin_logs` → `saved_search_results`

---

## Quick SQL Queries for Verification

```sql
-- Recent notifications
SELECT id, user_id, type, title_en, created_at
FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Recent audit logs
SELECT id, user_id, action, entity_type, details, created_at
FROM admin_logs ORDER BY created_at DESC LIMIT 10;

-- Login sessions
SELECT * FROM login_sessions ORDER BY created_at DESC LIMIT 10;
```

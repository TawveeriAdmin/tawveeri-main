# Tawveeri Notification Audit

> Comprehensive audit of all events that trigger notifications (in-app, email, audit log).
> Reference: **Required Action Pattern** in `CLAUDE.md` — every user-facing action must include in-app notification, email notification, and audit log.

## Unified Event Table

| Event | In-App | Email | Audit Log | Status |
|---|---|---|---|---|
| **Authentication** | | | | |
| Phone signup (new user) | system | welcome | user_signup | Complete |
| Email signup | system | **missing welcome** | user_signup | **Gap** |
| OAuth signup (Google/FB/Apple) | system | welcome | user_signup | Complete |
| Phone login (existing) | -- | -- | user_login | OK |
| OAuth login (existing) | -- | -- | user_login | OK |
| Email login | -- | -- | user_login | OK |
| Logout | -- | -- | user_logout | OK |
| **Password** | | | | |
| Password reset (phone OTP) | system | password_changed | PASSWORD_CHANGED | Complete |
| Password change (profile) | system | password_changed | password_changed | Complete |
| **Verification** | | | | |
| Email verified (OTP) | system | -- | email_verified | OK |
| Phone verified (profile OTP) | system | -- | phone_verified | OK |
| Email verified (link) | account | -- | email_verified | OK |
| Send email OTP | -- | email_verification | -- | OK |
| **Profile** | | | | |
| Email address change | account | -- | profile_updated | OK |
| Phone number change | account | -- | profile_updated | OK |
| Profile update (name etc.) | -- | -- | profile_updated | OK |
| Avatar upload | -- | -- | avatar_updated | OK |
| Avatar delete | -- | -- | avatar_updated | OK |
| Account deletion | **missing** | **missing** | user_deleted | **Gap** |
| **Alerts & Deals** | | | | |
| Price drop alert triggered | price_drop | price_drop_alert | **missing** | **Gap** |
| Back-in-stock alert | back_in_stock | back_in_stock | **missing** | **Gap** |
| Price alert created | **missing** | -- | **missing** | **Gap** |
| Price alert deleted | **missing** | -- | **missing** | **Gap** |
| Price alert toggled | **missing** | -- | **missing** | **Gap** |
| **Coupons** | | | | |
| Admin creates coupon | system | -- | COUPON_CREATED | OK |
| Store owner creates coupon | system | -- | COUPON_CREATED | OK |
| Coupon updated by admin | **missing** | -- | audit only | **Gap** |
| Coupon deleted by admin | **missing** | -- | audit only | **Gap** |
| Coupon expiry warning | **missing** | **missing** | -- | **Gap** (needs cron) |
| New coupon for wishlisted product | **missing** | **missing** | -- | **Gap** (needs cron) |
| **Admin** | | | | |
| Bulk price update | -- | -- | bulk_price_update | OK |
| Unauthorized admin access | -- | -- | security_alert | OK |
| User role change | **missing to user** | **missing to user** | user_role_updated | **Gap** |
| **Store Operations** | | | | |
| Store sync completed/failed | **missing** | -- | **missing** | **Gap** |
| **Security** | | | | |
| Login from new device | **missing** | **missing** | -- | **Gap** (needs fingerprinting) |

**Legend:** `--` = not needed/not applicable | **missing** = should be implemented | **Gap** = incomplete coverage

## Identified Gaps (15 total)

### High Priority

| # | Event | Missing | Rationale |
|---|---|---|---|
| 1 | User role changed by admin | In-App + Email | User's permissions changed -- they must know |
| 2 | Email signup (welcome) | Email | Phone & OAuth send welcome emails, email signup doesn't |
| 3 | Account deletion | In-App + Email | GDPR compliance, accidental deletion protection |
| 4 | Price alert created | In-App + Audit | Confirm alert is active and target price |

### Medium Priority

| # | Event | Missing | Rationale |
|---|---|---|---|
| 5 | Price alert deleted | In-App + Audit | Confirm alert was removed |
| 6 | Price alert toggled | In-App + Audit | Confirm activation/deactivation |
| 7 | New coupon for wishlisted product | In-App + Email | High conversion -- user watching product gets a discount |
| 8 | Coupon expiry warning (store owner) | In-App + Email | Store owners should know coupons are expiring |
| 9 | Store sync completed/failed | In-App + Audit | Store owner triggered sync, needs result |
| 10 | Coupon updated by admin | In-App | Store owner's coupon was modified by admin |
| 11 | Coupon deleted by admin | In-App + Email | Store owner's coupon was removed by admin |
| 12 | Price drop / back-in-stock | Audit Log | Events exist but missing audit trail |

### Low Priority

| # | Event | Missing | Rationale |
|---|---|---|---|
| 13 | Wishlist add/remove | -- | Toast is enough -- notifications would be noisy |
| 14 | Login from new device | In-App + Email | Security feature -- needs device fingerprinting |
| 15 | Saved search new results | In-App + Email | Needs a cron job -- significant new feature |

## Key Observations

1. **Audit logging is comprehensive** -- Most actions are logged, but users are rarely notified
2. **Email notifications are limited** -- Only price drops, password changes, and welcome emails
3. **User expectations not met** -- Actions like role changes and account deletion should notify
4. **Store owner perspective** -- No notifications when admins modify their coupons
5. **Security gap** -- No unusual login detection or device notifications
6. **Proactive features missing** -- No coupon expiry warnings, no saved search alerts

## Source Files Reference

| File | Events Handled |
|---|---|
| `src/app/api/auth/verify-phone-otp/route.ts` | Phone signup, phone login |
| `src/lib/auth/auth-context.tsx` | Email signup, email login, logout, profile update |
| `src/app/auth/callback/route.ts` | OAuth signup, OAuth login |
| `src/app/api/auth/reset-password-phone/route.ts` | Password reset (phone OTP) |
| `src/app/api/auth/password-changed-notify/route.ts` | Password change (profile) |
| `src/app/api/auth/verify-email-otp/route.ts` | Email OTP verification |
| `src/app/api/auth/verify-profile-phone-otp/route.ts` | Phone OTP verification |
| `src/app/auth/verify-email/route.ts` | Email link verification |
| `src/app/api/auth/send-email-otp/route.ts` | Send email OTP |
| `src/lib/auth/profile.ts` | Email/phone change, profile update, avatar, account deletion |
| `src/app/api/cron/check-price-alerts/route.ts` | Price drop alerts |
| `src/lib/scraping/services/scraping-orchestrator.ts` | Back-in-stock alerts |
| `src/app/api/admin/coupons/route.ts` | Admin coupon creation |
| `src/app/api/store/coupons/route.ts` | Store owner coupon creation |
| `src/app/api/store/products/bulk-update/route.ts` | Bulk price update |
| `src/middleware.ts` | Unauthorized admin access |
| `src/app/api/admin/users/[id]/role/route.ts` | User role change |

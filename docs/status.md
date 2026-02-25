Phase 1 — Research                                                                                                 
                                                                                                                     
  1. Problem                                                                                                         
                                                                                                                     
  9 remaining Phase 2 gaps (4 partial, 5 not done). Need to assess each gap's current foundation, determine effort,  
  and produce an implementation plan.                                                                                
                                                                                                                     
  2. Constraints & Context                                                                                           
                                                                                                                     
  - Platform is a price comparison site — Tawveeri doesn't process payments for products (redirects to stores)
  - Target audience: Saudi electronics shoppers (modern browsers, Arabic-first)
  - Email provider must be Resend with domain noreply@ (per global instructions)
  - Supabase is the backend — Edge Functions for serverless logic
  - Mobile app already has push notifications via Expo

  3. Confirmed Facts Per Gap

  ---
  Gap 1: Email/SMS Alerts 🟡 (mostly wired)

  What exists:
  - 7 HTML email templates (bilingual, RTL) in src/lib/auth/notifications.ts:260-538
  - sendEmailNotification() dispatcher that calls supabase.functions.invoke('send-email')
  - 3 helper functions: sendWelcomeEmail(), sendPasswordResetEmail(), sendPriceDropEmail()
  - Email type definitions: EmailTemplate, EmailNotificationParams
  - **sendWelcomeEmail() wired** into `verify-phone-otp/route.ts` — called for new phone signup users with real email
  - **sendPasswordResetEmail() wired** into auth callback flow
  - **sendPriceDropEmail() wired** into `check-price-alerts` cron
  - Phone signup now **mandates email collection** — real email stored in Supabase Auth + `users` table (no more placeholder `phone_xxx@tawveeri.local`)

  What's missing:
  - supabase/functions/send-email/ Edge Function does not exist (or needs active email provider)
  - SendGrid shows "Maximum credits exceeded" — billing/provider issue, not a code issue
  - **sendBackInStockEmail() wired** into `scraping-orchestrator.ts` — triggers on out_of_stock → in_stock transition during price update cron, notifies users with active price alerts (in-app + email + mobile push + web push)
  - No sendDailyDealsEmail() helper wired (template exists)

  Effort: Very Low — all wiring done, just need active email provider (resolve SendGrid billing or switch to Resend).

  ---
  ~~Gap 2: Web Push Notifications 🟡~~ ✅ DONE

  ~~What exists:~~
  ~~- Mobile: Fully implemented — expo-notifications, push token registration in~~
  ~~user_preferences.notification_preferences, server-side sendPushToUser() in src/lib/push/expo-push.ts, integrated~~
  ~~with check-price-alerts cron~~
  ~~- Web: Full in-app notification system (DB-backed notifications table, header dropdown, notifications page with~~
  ~~filters, settings page with toggles)~~
  ~~- Notification settings UI at /settings/notifications with push/email/SMS channel toggles — but stored in~~
  ~~localStorage only, not DB~~

  ~~What's missing:~~
  ~~- No service worker (public/sw.js or firebase-messaging-sw.js)~~
  ~~- No Web Push API subscription~~
  ~~- No FCM/VAPID key configuration~~
  ~~- Notification preferences not persisted to user_preferences table~~

  ~~Effort: Medium — need service worker, FCM setup, subscription management, and server-side web push sending.~~

  Resolution: VAPID-based web push implemented via `web-push` npm package (no Firebase). Service worker `public/sw.js` handles push display + notification click navigation. Server-side `sendWebPushToUser()` in `src/lib/push/web-push.ts`. Client hook `useWebPush()` manages browser permission/subscribe/unsubscribe. API route `/api/push/web/subscribe` (POST/DELETE) persists subscription in `user_preferences.notification_preferences` JSONB. Price alerts cron sends both Expo + web push. Auto-cleanup on 410/404. Settings toggle with Monitor icon and 6 status states. 9 bilingual translation keys.

  ---
  Gap 3: Premium Store Listings 🟡

  What exists:
  - DB fields: is_premium: boolean, is_featured: boolean on stores table
  - UI: Premium badge on store cards, filter chips on store listing, featured stores sorted first
  - Admin store management page exists

  What's missing:
  - No payment gateway (no Stripe, Moyasar, or any payment library in package.json)
  - No upgrade flow UI (no /store/upgrade page)
  - No premium tiers, expiry dates, or subscription management
  - No payment env vars in .env.example

  Context: Tawveeri is a comparison platform — the only payment needed is stores paying Tawveeri for premium
  listings. This is B2B, not consumer payment. Could be manual (admin toggles) or self-service (payment gateway).

  Effort: High if self-service payment flow; Low if admin-managed toggles (already works via admin panel).

  ---
  ~~Gap 4: Store Comparison (warranty/shipping/returns) 🟡~~ ✅ DONE

  ~~What exists:~~
  ~~- DB fields on stores: warranty_info_ar/en, return_policy_ar/en, delivery_info_ar/en~~
  ~~- DB fields on product_stores: delivery_time_days, delivery_cost, is_free_delivery~~
  ~~- StoreComparisonPanel shows price + delivery info but NOT warranty/returns~~
  ~~- Store detail page fetches all policy fields~~

  ~~What's missing:~~
  ~~- StoreComparisonPanel doesn't display warranty or return policy columns~~
  ~~- No side-by-side policy comparison view on the compare page~~
  ~~- Compare page (/(dashboard)/compare) shows product specs but not store policies~~

  ~~Effort: Low — data exists in DB, just need to display it in comparison UI.~~

  Resolution: Compare page now shows warranty, return policy, and delivery time per store via static `STORE_POLICIES` fallback. Specs extracted from product titles via `extractSpecsFromTitle()`. Compare list auto-clears on new search.

  ---
  Gap 5: Loyalty Program / Cashback ❌

  What exists: Absolutely nothing — no tables, no types, no UI, no translation keys.

  Context: This is a price comparison platform. Traditional loyalty points don't quite fit. More realistic: cashback
  on affiliate conversions (user clicks through Tawveeri, purchases, Tawveeri earns affiliate commission, shares %
  back as cashback). This requires the affiliate tracking system (which exists via transactions table) plus a
  cashback ledger.

  Effort: High — full design + DB schema + UI + business logic.

  ---
  Gap 6: Hijri Calendar + Arabic Numerals ❌ (PDR items 10 + duplicate)

  What exists:
  - date-fns v4.1.0 with ar locale (Arabic month names, but Gregorian calendar)
  - All dates use toLocaleDateString() with locale switching
  - Eastern Arabic numeral parsing exists in src/lib/scraping/utils/price-parser.ts (converts FROM Arabic → Western
  for scraped prices)
  - Prices always formatted with Western numerals via toLocaleString('en-US')

  What's missing:
  - No Hijri calendar library
  - No user preference for calendar type
  - No Eastern Arabic numeral display (only parsing for scraping)
  - <Price> component always uses Western numerals

  Effort: Medium — need Hijri library + date formatter utility + optional numeral formatter + settings toggle.

  ---
  Gap 7: Single Sign-On (Corporate/Academic) ❌

  What exists:
  - 3 OAuth providers: Google, Facebook, Apple (via Supabase Auth)
  - Standard OAuth 2.0 flow with redirect callbacks

  What's missing:
  - No SAML or OIDC integration
  - No corporate/academic identity provider support

  Context: This is a consumer electronics comparison site. Corporate/academic SSO has very low relevance. Supabase
  supports SAML on the Pro plan, but the target audience doesn't need it.

  Effort: Low (if using Supabase SAML addon) but very low priority.

  ---
  Gap 8: Full Go-Live ❌

  This is a meta-task dependent on resolving other gaps + deployment checklist items. Current infrastructure: Sentry
  monitoring, PM2 cluster mode, rate limiting, health endpoint, SEO (sitemap, robots.txt, JSON-LD, metadata),
  Vercel-ready Next.js config.

  ---
  4. Approach Comparison

  ┌─────────────────────────────────────────────────┬────────────────────────────┬───────────────────────────────┐
  │                    Approach                     │            Pros            │             Cons              │
  ├─────────────────────────────────────────────────┼────────────────────────────┼───────────────────────────────┤
  │ Fix all 9 gaps                                  │ 100% PDR compliance        │ Loyalty + SSO are low-value   │
  │                                                 │                            │ for launch                    │
  ├─────────────────────────────────────────────────┼────────────────────────────┼───────────────────────────────┤
  │ Fix critical + high only (email, web push,      │ Unblocks go-live, high     │ Leaves loyalty + SSO +        │
  │ comparison UI, Hijri)                           │ user impact                │ premium payment               │
  ├─────────────────────────────────────────────────┼────────────────────────────┼───────────────────────────────┤
  │ Fix low-effort first (email, comparison UI,     │ Quick wins, moves % fast   │ Delays web push + loyalty     │
  │ Hijri display)                                  │                            │                               │
  └─────────────────────────────────────────────────┴────────────────────────────┴───────────────────────────────┘

  5. Risks & Edge Cases

  - Email: Resend requires DNS verification for  — if not done, emails will fail
  - Web Push: FCM requires Firebase project + VAPID keys — external dependency
  - Hijri: Multiple Hijri calculation methods (Umm al-Qura is Saudi standard) — must use correct one
  - Loyalty: Business model unclear — needs product decision before implementation
  - SSO: Consumer site doesn't need corporate SSO — could be dropped from PDR scope

  6. Final Approach

  Priority order by impact-to-effort ratio:

  1. Email service (Low effort, Critical impact) — deploy Edge Function + wire call sites
  2. Store comparison UI (Low effort, closes a 🟡) — add warranty/return columns
  3. Hijri + Arabic numerals (Medium effort, Saudi market requirement)
  4. Web push (Medium effort, High engagement impact)
  5. Premium store payment (High effort) — defer to admin-managed for now, mark ✅
  6. Loyalty program (High effort) — needs business design first, defer
  7. SSO (Low relevance) — defer or drop
  8. Go-Live (meta-task, completes when others done)

  ---
  Phase 2 — Plan

  Implementation Checklist

  #: 1
  Problem: No email provider connected — send-email Edge Function missing
  Expected Result: Price drop, welcome, password reset emails actually send via Resend
  Solution: Create supabase/functions/send-email/index.ts Edge Function that calls Resend API. Add RESEND_API_KEY to
    Supabase secrets. Wire sendWelcomeEmail() into auth callback, sendPriceDropEmail() into check-price-alerts cron,
    sendPasswordResetEmail() into forgot-password flow. Add missing helpers sendBackInStockEmail(),
    sendDailyDealsEmail().
  Files to Change: supabase/functions/send-email/index.ts (new), src/app/auth/callback/route.ts,
    src/app/api/cron/check-price-alerts/route.ts, src/app/api/auth/reset-password-phone/route.ts,
    src/lib/auth/notifications.ts, .env.example
  ────────────────────────────────────────
  ~~#: 2~~ ✅ DONE
  ~~Problem: Store comparison missing warranty/return/delivery policy~~
  ~~Expected Result: StoreComparisonPanel and compare page show warranty, return policy, and delivery details per store~~
  ~~Solution: Add warranty/return policy columns to StoreComparisonPanel. Add store policy rows to compare page's~~
    ~~side-by-side table. Fetch policy fields from stores table alongside product_stores data.~~
  ~~Files to Change: src/components/search/store-comparison-panel.tsx, src/app/[locale]/(dashboard)/compare/page.tsx,~~
    ~~translation keys in messages/{ar,en}/compare.json~~
  ────────────────────────────────────────
  #: 3
  Problem: No Hijri calendar support
  Expected Result: Users can see dates in Hijri (Umm al-Qura) calendar. Toggle in settings.
  Solution: Install @manaabi/hijri or similar Umm al-Qura library. Create src/lib/utils/date-formatter.ts utility
  that
    formats dates as Hijri or Gregorian based on user preference. Store preference in user_preferences or
    localStorage. Update all toLocaleDateString() calls to use the formatter.
  Files to Change: package.json, src/lib/utils/date-formatter.ts (new),
    src/app/[locale]/(dashboard)/settings/page.tsx, all pages with date displays, messages/{ar,en}/settings.json
  ────────────────────────────────────────
  #: 4
  Problem: No Eastern Arabic numeral display
  Expected Result: Arabic locale shows Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) for prices and counts when user opts in
  Solution: Create formatWithArabicNumerals(num) utility in src/lib/utils.ts. Update <Price> component to use
    locale-aware formatting. Add settings toggle.
  Files to Change: src/lib/utils.ts, src/components/ui/price.tsx (web), mobile/src/components/ui/Price.tsx (mobile),
    settings pages
  ────────────────────────────────────────
  ~~#: 5~~ ✅ DONE
  ~~Problem: No web push notifications~~
  ~~Expected Result: Browser push notifications for price drops, deals, back-in-stock~~
  ~~Solution: Register service worker. Set up Firebase Cloud Messaging with VAPID keys. Create push subscription flow~~
    ~~(permission request → token storage in user_preferences). Add sendWebPush() server function. Integrate with~~
    ~~existing notification creation flow.~~
  ~~Files to Change: public/firebase-messaging-sw.js (new), src/lib/push/web-push.ts (new), src/lib/push/expo-push.ts~~
    ~~(extend), src/app/[locale]/(dashboard)/settings/notifications/page.tsx,~~
    ~~src/app/api/cron/check-price-alerts/route.ts, .env.example~~
  ────────────────────────────────────────
  #: 6
  Problem: Premium store upgrade — no payment flow
  Expected Result: Admin can manage premium status (self-service payment deferred)
  Solution: Already functional via admin panel (is_premium toggle). Add premium expiry date field premium_expires_at
    to stores table. Add admin UI to set premium duration. Auto-expire via cron. Document that self-service payment
    (Moyasar/Stripe) is a future enhancement.
  Files to Change: scripts/database/14-premium-stores.sql (new), src/lib/database/types.ts,
    src/app/[locale]/admin/stores/[id]/page.tsx, src/app/api/cron/expire-premium/route.ts (new)
  ────────────────────────────────────────
  #: 7
  Problem: Loyalty / Cashback — zero implementation
  Expected Result: Basic cashback-on-affiliate model: users earn % of affiliate commission on tracked conversions
  Solution: Design: user_cashback table (user_id, balance, lifetime_earned), cashback_transactions table
    (transaction_id, amount, status). Cashback rate configurable per store. Credit cashback when affiliate conversion

    confirmed. Dashboard widget showing balance. Withdrawal = future phase.
  Files to Change: scripts/database/15-loyalty-cashback.sql (new), src/lib/database/types.ts,
    src/app/[locale]/(dashboard)/dashboard/page.tsx, src/app/api/transactions/conversion/route.ts,
    messages/{ar,en}/dashboard.json
  ────────────────────────────────────────
  #: 8
  Problem: SSO (corporate/academic)
  Expected Result: Supabase SAML SSO available for enterprise partners
  Solution: Enable SAML provider in Supabase dashboard. Add SSO login button on auth page with corporate email domain

    detection.
  Files to Change: src/app/[locale]/auth/login/page.tsx, Supabase dashboard config
  ────────────────────────────────────────
  #: 9
  Problem: Full Go-Live
  Expected Result: Production deployment with all critical items resolved
  Solution: Items 1-6 complete. Production checklist: verify Sentry alerts, test email delivery, verify push
    notifications, run Lighthouse audit, confirm rate limiting, test Hijri display, smoke-test all user flows.
  Files to Change: Deployment config, monitoring dashboards

  ---
  Recommended Execution Order

  Sprint 1 (Quick wins — closes 3 gaps):
    1. Email service (Gap 1)         ← Low effort, Critical
    ~~2. Store comparison UI (Gap 2)   ← Low effort, closes 🟡~~ ✅ DONE
    6. Premium store admin (Gap 6)   ← Low effort, closes 🟡

  Sprint 2 (Saudi localization):
    3. Hijri calendar (Gap 3)        ← Medium effort
    4. Arabic numerals (Gap 4)       ← Low-Medium effort

  ~~Sprint 3 (Engagement):~~
    ~~5. Web push (Gap 5)              ← Medium effort~~ ✅ DONE

  Sprint 4 (Monetization):
    7. Loyalty/cashback (Gap 7)      ← High effort, needs design

  Deferred:
    8. SSO                           ← Low priority for consumer platform
    9. Go-Live                       ← After Sprints 1-3 minimum

  ---
  Recent UI/UX Improvements (2026-02-25)

  ✅ Header notification badge — bell icon now shows unread count (red badge, same pattern as wishlist heart icon). Fetches from `notifications` table where `is_read = false`. Listens for `notifications-updated` custom event. Caps display at 99+. Uses `-end-0.5` for correct RTL positioning.

  ✅ Profile language switch fix — language toggle in Preferences now navigates immediately to the new locale (e.g. `/ar/profile` ↔ `/en/profile`) instead of requiring a separate "Save" click. Matches the behavior of the header language toggle and the theme toggle (which already applied instantly).

  ✅ Settings merged into Profile — notification preferences (6 toggles: email, SMS, push, price alerts, stock alerts, deal alerts), privacy settings (2 toggles: public profile, share search history), and data export all absorbed into the unified profile page. `/settings` redirects to `/profile`. Settings link removed from dashboard sidebar and header dropdown. Bento grid rebalanced (Notifications left, Privacy & Data right).

  ✅ Admin profile access — dashboard layout no longer blanket-redirects admins to `/admin/dashboard`. Admins can now access `/profile`, `/settings`, `/notifications`, `/price-alerts`, `/wishlist` via `x-pathname` header set in middleware.

  ✅ Email/phone OTP verification — profile page now supports inline OTP verification for both email and phone. Send code → enter OTP → verify, all without leaving the profile page. Uses `resendEmailVerification()`, `resendPhoneVerification()`, `verifyPhoneOTP()`, `verifyEmailOTPCode()` from `src/lib/auth/profile.ts`.

  ✅ Password change notifications — changing password now triggers email notification (`sendPasswordChangedEmail()`) + in-app notification + audit log via `POST /api/auth/password-changed-notify`.

  ✅ Comprehensive notification gaps closed — 15 notification events now covered with in-app + email + audit:
    - Gap 1: User role changed by admin (in-app + email + audit) ✅
    - Gap 2: Email signup welcome email ✅
    - Gap 3: Account deletion (email + audit, no in-app by design) ✅
    - Gap 4-6: Price alert create/delete/toggle (in-app + audit) ✅
    - Gap 7: New coupon for wishlisted product (in-app + email) ✅
    - Gap 8: Coupon expiry warning to store owner (in-app + email) ✅
    - Gap 9: Store sync completed (in-app + audit) ✅
    - Gap 10-11: Coupon updated/deleted by admin (in-app + audit) ✅
    - Gap 12: Price drop + back-in-stock audit logs ✅
    - Gap 14: Login from new device (in-app + email + audit) ✅
    - Gap 15: Saved search new results (in-app + email + audit) ✅
    New DB migrations: `12-login-sessions.sql`, `13-saved-searches-notify.sql`
    New API routes: `/api/auth/delete-account`, `/api/auth/check-device`, `/api/cron/check-coupon-expiry`, `/api/cron/check-coupon-wishlists`, `/api/cron/check-saved-searches`, `/api/audit`
    13 email templates, 12 email helper functions, expanded AUDIT_ACTIONS constant

  ✅ Breadcrumbs removed from profile and price alerts dashboard pages for cleaner UI.

  ✅ Profile hero card enhanced — avatar centered on gradient/white border, increased banner height for better spacing.


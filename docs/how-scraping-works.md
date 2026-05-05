# How Tawveeri Keeps Prices Fresh

A guide to what happens behind the scenes after a product is in the system — how we keep prices up to date, and how customers get notified of deals.

---

## The Big Picture

Tawveeri has two automatic jobs that run on a schedule:

1. **Daily Product Discovery** — Runs once a day at 3 AM. Finds new products that stores have added to their websites.
2. **Price Refresh** — Runs every 4 hours. Checks the prices and stock status of every product we already know about.

Together, these keep our catalog current without any manual work. Customers always see accurate prices, and new products appear on the site automatically.

---

## What Happens to a Product Over Time

Let's follow a real example: **"Ahmed saves an iPhone 15 Pro to his wishlist when it's listed at 4,299 SAR on Jarir."**

### Day 0 — Ahmed saves the product

- The iPhone 15 Pro appears in Ahmed's wishlist.
- No automatic notifications yet — a wishlist is simply a list of products he cares about.
- If Ahmed wants to be notified when the price drops, he can set a **Price Alert** — for example, "tell me if this drops below 3,999 SAR."

### Every 4 Hours — Price Refresh Runs

The system checks Jarir's website for this iPhone's latest price and stock status.

**If the price changed:**
- The new price is saved.
- A record is added to the product's price history (so customers can see the price trend over time).

**If stock status changed:**
- "Out of stock" → "In stock" triggers a **Back in Stock notification** to any customer who asked for one.

**If nothing changed:**
- The system just records a timestamp ("still the same as last time") and moves on.

### Shortly After — Price Alert Check Runs

Separately, the system reviews every active price alert:

- "Does anyone want this product below a certain price?"
- "Is the current price lower than their target?"
- "Have we already notified them?"

If the answer to all three is yes, Ahmed gets notified **three ways**:

1. **In-app notification** — a badge appears on his Tawveeri account
2. **Email** — formatted message with the product, old price, new price, and a link
3. **Push notification** — on his phone (if the mobile app is installed) and/or browser (if web notifications are enabled)

All notifications are bilingual — Arabic and English — based on Ahmed's language preference.

### Ahmed Opens the App

- Header shows a notification badge.
- The iPhone 15 Pro product page now displays the new price.
- The price history chart shows a downward data point — visual proof the price really dropped.
- His wishlist displays the current price, not the price he originally saved.

---

## What the System Does Automatically

### Price Changes
Every price change is recorded. Customers can see how a product's price has moved over days, weeks, or months. This is one of Tawveeri's key value propositions — customers trust us to know whether a "deal" is actually a deal.

### Availability Changes
- **In stock → Out of stock**: badge updates across the site.
- **Out of stock → In stock**: customers who asked for back-in-stock alerts are notified immediately.

### New Product Discovery
When a store adds a new product (say, the iPhone 16 launches):
- The daily discovery job finds it automatically.
- It's added to our catalog with the right category, brand, and images.
- Customers who saved a **Saved Search** matching it (e.g., "iPhone" or "smartphone") get a notification.

### Self-Correction
If a product got classified into the wrong category (say, a MacBook accidentally tagged as "tablet"), the system re-examines it on every scrape and corrects itself. Over a few days, the catalog gets progressively cleaner without anyone lifting a finger.

### Automatic Recovery
If a store's website is temporarily unreachable or slow, the system:
- Retries each failed request up to 3 times
- Respects polite delays between requests so we don't get blocked
- Skips products that have failed 5+ times in a row (they're likely removed from the store's catalog)

Admins can review these auto-skipped products and reset them if needed.

---

## What the System Does NOT Do

To set expectations clearly:

- **It does not notify customers on price *increases***. Only price drops and back-in-stock events trigger alerts.
- **It does not delete products**. Removed products stay in the database but are flagged as unavailable. Customers who wishlisted them still see the last-known price.
- **It does not automatically check every wishlist**. Wishlists are passive saves — customers must explicitly create a **Price Alert** if they want to be notified.
- **It does not alert on every price change**. Only if the new price meets the customer's target threshold.

---

## The Three Notification Channels

Every user-facing event uses all three channels (where the customer has opted in):

| Channel | Medium | Example |
|---|---|---|
| **In-App** | Notifications tab inside Tawveeri | "Price drop! iPhone 15 Pro is now 3,849 SAR at Jarir" |
| **Email** | Sent via verified domain | Same message, formatted email with a link |
| **Push** | Mobile + browser notifications | Same headline, opens straight to the product |

The customer controls which channels they want in their settings.

---

## What Admins See

Through the admin dashboard, you can:

- **Monitor scraping runs** — see how many products were found, updated, and any errors per run.
- **See scraping health** per store — are we successfully scraping Jarir, Amazon, Noon, etc.?
- **Review failing products** — products that have failed 5+ times get flagged for manual review.
- **Trigger a manual scrape** — force a refresh for a specific store without waiting for the cron.
- **Adjust scraping schedules** — change how often each store is refreshed.

---

## The Scale

After everything is in place, a typical day looks like:

- **Once daily**: Discovery runs across all 8 stores (Amazon, Jarir, Noon, Extra, Almanea, Samsung KSA, Shaker, SWSG) — finds any products added in the last 24 hours.
- **6 times daily**: Price refresh cycles through the entire catalog, ensuring no product's price is more than 4 hours out of date.
- **Continuously**: Price alerts and wishlist triggers evaluate against the fresh data and notify customers within minutes of a matching event.

Customers never have to refresh manually. The system always serves them the current truth.

---

## Summary

1. Customers add products to their **wishlist** or set **price alerts**.
2. Every **4 hours**, we re-check prices and stock across all stores.
3. When something changes in a customer's favor (price drop, back-in-stock), they're **automatically notified** via in-app, email, and push.
4. Every **day**, we scan stores for newly-added products and add them to the catalog.
5. The system **self-heals** — fixing categories, recovering from transient errors, and flagging problem products for admin review.

The result: customers trust the data, check Tawveeri first when shopping, and come back when we surface a better deal they didn't have to hunt for.

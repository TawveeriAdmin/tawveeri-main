# AI-Powered Smart Recommendations — Implementation Report

**Date:** 2026-02-19
**Branch:** `phase2_v2_Alhussain`
**Status:** Complete (switched to Google Gemini, GOOGLE_AI_API_KEY deployed)

---

## 1. Objective

Implement an AI-powered smart recommendation system for the Tawveeri price comparison platform. The system should:

- Recommend similar products on product detail pages
- Provide personalized recommendations on the user dashboard
- Work as a unified API for both the Next.js web app and a future mobile app
- Use PostgreSQL `.rpc()` as the single cross-platform API contract

---

## 2. Architecture Decision

### Options Evaluated

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Next.js API routes with JS logic | Recommendation logic in TypeScript | Rejected — not callable from mobile without duplication |
| B. Supabase Edge Functions | Recommendation logic in Deno Edge Functions | Rejected — adds another layer when PG can do it natively |
| C. Hybrid (Next.js + Edge Functions) | Split logic between both | Rejected — complexity with no benefit |
| **D. Pure PostgreSQL `.rpc()`** | All recommendation logic in PG functions | **Chosen** — single code path for web + mobile via `.rpc()` |

### Why PostgreSQL `.rpc()`

- **One source of truth**: Both Next.js and mobile call the same PG functions
- **No duplication**: Recommendation logic lives in one place (database)
- **Performance**: pgvector similarity search runs natively in PostgreSQL
- **Supabase SDK support**: `.rpc()` works from every Supabase client (JS, Swift, Dart, Kotlin)

---

## 3. System Architecture

### Embedding Pipeline (Background, Async)

```
Product Insert/Update
        |
        v
  DB Trigger fires automatically
        |
        v
  Job added to pgmq queue (embedding_jobs)
        |
  pg_cron (every 10s) --- queue empty? --- yes --- (sleep, no cost)
        |
        no, has jobs
        |
        v
  pg_net calls Edge Function (embed)
        |
        v
  Edge Function calls Google Gemini gemini-embedding-001
        |
        v
  768-dim embedding vector saved to products.embedding column
```

### Recommendation Serving (Per User Request)

```
User visits page
        |
        v
  supabase.rpc('get_recommendations', { p_product_id, p_user_id, p_type })
        |
        v
  PostgreSQL executes recommendation function:
    1. Personalized (user profile embedding avg) --- has results? return
    2. Collaborative (wishlist co-occurrence)     --- has results? return
    3. Content-based (pgvector cosine similarity) --- has results? return
    4. Popularity fallback (view_count ORDER BY)  --- always returns
        |
        v
  Results returned to client (no OpenAI call, pure DB math)
```

---

## 4. What Was Implemented

### Database (7 Migrations via Supabase MCP)

| Migration | Purpose |
|-----------|---------|
| `enable_ai_extensions` | Enabled pgvector 0.8.0, pgmq 1.5.1, pg_net 0.19.5, pg_cron 1.6.4, hstore |
| `create_product_views_table` | Per-user product view tracking with RLS policies |
| `add_product_embeddings` | `embedding halfvec(768)` column + HNSW index on products (migrated from 1536 to 768 dims) |
| `embedding_infrastructure` | `util` schema, pgmq queue, `process_embeddings()` function, pg_cron job (10s) |
| `product_embedding_triggers` | `product_embedding_input()` function + INSERT/UPDATE triggers on products |
| `recommendation_functions` | 4 PG functions (see below) |
| `create_coupons_table` | Coupons table (separate feature) |

### PostgreSQL Functions

| Function | Purpose | Params |
|----------|---------|--------|
| `get_recommendations` | **Orchestrator** — tries each strategy in priority order with CTE-based fallback chain | `p_user_id`, `p_product_id`, `p_type`, `p_limit` |
| `match_similar_products` | Content-based similarity using pgvector cosine distance | `target_product_id`, `match_threshold`, `match_count` |
| `get_collaborative_recommendations` | Wishlist co-occurrence (users who saved X also saved Y) | `target_product_id`, `match_count` |
| `get_personalized_recommendations` | User profile embedding (average of viewed/wishlisted product embeddings) | `target_user_id`, `match_threshold`, `match_count` |
| `product_embedding_input` | Generates text input for embedding from product fields | `p` (product row) |

### Edge Function

| Name | Runtime | Model | Purpose |
|------|---------|-------|---------|
| `embed` | Deno (Supabase Edge) | Google Gemini `gemini-embedding-001` | Processes embedding jobs from pgmq queue, generates 768-dim vectors |

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/recommendations/types.ts` | `RecommendedProduct` and `RecommendationOptions` TypeScript interfaces |
| `src/lib/recommendations/use-recommendations.ts` | React hook wrapping `.rpc('get_recommendations')` with loading/error state |

### Files Modified

| File | Change |
|------|--------|
| `src/lib/database/types.ts` | Added `product_views` table, `saved_searches` table, `embedding` column on products, `Functions` section (all 4 recommendation functions + utilities), `Views` section (3 materialized views) |
| `src/app/api/products/[id]/view/route.ts` | Added per-user view tracking with hourly dedup (application-level) |
| `src/app/[locale]/(dashboard)/dashboard/page.tsx` | Replaced view_count recommendations with AI `.rpc('get_recommendations')` + popularity fallback |
| `src/app/[locale]/(public)/products/[slug]/page.tsx` | Replaced category-based related products with AI similarity + category fallback |
| `.env.example` | Added `OPENAI_API_KEY` documentation |
| `CLAUDE.md` | Added AI Recommendations System section |

---

## 5. Cost Analysis

### Google Gemini Embedding Cost

| Scale | One-time Cost | Monthly Updates (est. 10%) |
|-------|---------------|---------------------------|
| 100 products | Free tier | Free tier |
| 1,000 products | Free tier | Free tier |
| 10,000 products | Free tier | Free tier |
| 100,000 products | ~$0.01 | ~$0.001 |

- Model: `gemini-embedding-001` — free tier covers 1,500 RPM / 1M tokens per minute
- ~50-100 tokens per product (name_ar + name_en + brand + model + category)
- Gemini is called **once per product change**, not per user request
- Recommendations are served via pure PostgreSQL math (zero API cost)
- pg_cron polling costs nothing when queue is empty

---

## 6. How Recommendations Help a Price Comparison Platform

Recommendations don't replace price comparison — they **increase product discovery**:

- **Product page**: "Similar Products" surfaces alternatives the user didn't search for (cheaper models, competing brands, previous generations on sale)
- **Dashboard**: "Personalized For You" matches browsing patterns to relevant products
- **Cross-selling**: Accessories and complementary products appear alongside main items

**Business impact:**
- More products explored per visit → more affiliate link clicks → more revenue
- Higher price alert signups → better retention
- Longer session duration → more engagement

---

## 7. Errors Encountered & Resolved

| Error | Cause | Resolution |
|-------|-------|------------|
| `date_trunc(text, timestamptz)` not IMMUTABLE | Cannot use STABLE functions in expression indexes | Removed DB-level dedup index, implemented application-level hourly dedup in API route |
| `GET DIAGNOSTICS result_count = ROW_COUNT` syntax error | Invalid PL/pgSQL after `RETURN QUERY` | Rewrote `get_recommendations` with CTE-based `UNION ALL` approach |
| TS2345 on `.rpc('get_recommendations')` | Generated Supabase types didn't include new functions | Regenerated types via MCP and updated `src/lib/database/types.ts` |
| TS2322 `null` not assignable to `undefined` | RPC optional params expect `undefined`, not `null` | Changed `?? null` to `?? undefined` in 3 files |

---

## 8. Security Review

- **product_views**: RLS enabled with 3 policies (insert own, read own, admin read all)
- **embed Edge Function**: `verify_jwt: true` (requires authentication)
- **No new security issues** introduced (confirmed via Supabase security advisor)
- Pre-existing `function_search_path_mutable` warnings affect all project functions (not specific to this feature)

---

## 9. Remaining Action

**Secrets deployed:**

```bash
supabase secrets set GOOGLE_AI_API_KEY=AIza...
```

The pg_cron job automatically processes queued embedding jobs. Verify with:

```sql
SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL;
```

---

## 10. Files Changed Summary

- **17 files modified**
- **7 database migrations** applied
- **1 Edge Function** deployed
- **595 lines added, 50 removed**
- **0 new TypeScript errors** introduced (40 pre-existing remain)

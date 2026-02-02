# Python Scraping Integration - Complete Implementation

**Date:** 2025-01-XX  
**Status:** ✅ Complete  
**Integration Type:** Flask Microservice with Next.js

---

## Overview

This document describes the complete integration of Python scraping scripts into the Next.js application. The integration allows users to search for products in real-time across multiple Saudi e-commerce stores (Amazon SA, Noon, Jarir, Extra) using Python scrapers provided by the development team.

---

## Architecture

```
┌─────────────────┐
│  Next.js App    │
│  (TypeScript)   │
└────────┬────────┘
         │ HTTP Request
         │ POST /api/search/scrape
         ▼
┌─────────────────┐
│  Next.js API    │
│  /api/search/   │
│  scrape/route.ts│
└────────┬────────┘
         │ HTTP Request
         │ (fetch)
         ▼
┌─────────────────┐
│  Flask Service  │
│  (Python)       │
│  Port 5000      │
│  /search        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Python         │
│  Scrapers       │
│  (unchanged)    │
└─────────────────┘
```

---

## File Structure

```
scripts/scraping/
├── app.py                          # Flask API server
├── amazon_sa_scraper.py           # Amazon scraper
├── noon_scraper.py                # Noon scraper
├── jarir_scraper.py               # Jarir scraper
├── extra_sa_scraper.py            # Extra scraper
├── requirements.txt               # Python dependencies
├── start-flask.sh                 # Startup script
├── README.md                      # Python service documentation
├── static/
│   └── logos/                     # Store logos
└── templates/
    └── index.html                 # Optional UI (for testing)

src/
├── app/
│   └── api/
│       └── search/
│           └── scrape/
│               ├── route.ts       # Next.js API route
│               └── clear-cache/
│                   └── route.ts  # Cache management
└── lib/
    └── scraping/
        ├── python-types.ts        # Python response types
        ├── python-mapper.ts       # Data mapping
        ├── search-types.ts       # Search result types
        ├── product-adapter.ts     # UI adapter
        ├── cache.ts               # Optional caching
        └── flask-health.ts        # Health check utility
```

---

## Implementation Details

### Phase 1: Python Scripts ✅
- ✅ All Python scripts copied to `scripts/scraping/`
- ✅ Logo assets copied to `scripts/scraping/static/logos/`
- ✅ Requirements file created with all dependencies

### Phase 2: Flask Service ✅
- ✅ Flask app modified with CORS support
- ✅ Environment variable configuration added
- ✅ Health check endpoint (`/health`) added
- ✅ `/search` endpoint preserved (already returns JSON)

### Phase 3: Data Mapping ✅
- ✅ TypeScript types for Python response format
- ✅ Mapper function to convert Python → TypeScript format
- ✅ Product adapter to convert ScrapedProduct → ProductCardProduct

### Phase 4: Next.js API Route ✅
- ✅ `/api/search/scrape` endpoint created
- ✅ Calls Flask service with proper error handling
- ✅ Maps response to TypeScript format
- ✅ Returns normalized search results

### Phase 5: Caching ✅
- ✅ In-memory cache implementation
- ✅ Cache key: `scrape:{query}:{stores}:{pages}`
- ✅ TTL: 10 minutes (configurable)
- ✅ Cache clear endpoint: `/api/search/scrape/clear-cache`

### Phase 6: Search Page Integration ✅
- ✅ Search mode toggle (Database vs Real-time Scrape)
- ✅ Scraping function integrated
- ✅ Loading indicators for scraping
- ✅ Error display for store-specific failures
- ✅ Progress messages during scraping

### Phase 7: Environment Configuration ✅
- ✅ `.env.example` updated with Flask variables
- ✅ All environment variables documented

### Phase 8: Flask Service Management ✅
- ✅ Startup script created (`start-flask.sh`)
- ✅ npm scripts added to `package.json`
- ✅ Health check utility created

### Phase 9: Error Handling & Logging ✅
- ✅ Comprehensive error handling in API route
- ✅ Logging for all operations
- ✅ Store-specific error tracking
- ✅ Timeout handling (120 seconds)

### Phase 10: Documentation ✅
- ✅ Python service README created
- ✅ Integration documentation (this file)
- ✅ Translation keys added

---

## Usage

### Starting the Flask Service

```bash
# Option 1: Using npm script
npm run flask:start

# Option 2: Using startup script
./scripts/scraping/start-flask.sh

# Option 3: Manually
cd scripts/scraping
python app.py
```

### Using Real-time Scraping in UI

1. Navigate to search page: `/[locale]/search`
2. Toggle search mode to "Real-time Scrape"
3. Enter search query (e.g., "laptop")
4. Click search or press Enter
5. Wait for results (10-30 seconds)
6. Results from all stores will be displayed

### API Usage

**Search Endpoint:**
```bash
POST /api/search/scrape
Content-Type: application/json

{
  "query": "laptop",
  "stores": ["amazon", "noon", "jarir"],
  "pages": 1,
  "sort": "price_asc"
}
```

**Health Check:**
```bash
GET /api/search/scrape
```

**Clear Cache:**
```bash
POST /api/search/scrape/clear-cache
```

---

## Environment Variables

### Flask Service (.env.local or scripts/scraping/.env)
```bash
FLASK_HOST=127.0.0.1
FLASK_PORT=5000
FLASK_DEBUG=false
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Next.js (.env.local)
```bash
FLASK_API_URL=http://127.0.0.1:5000
FLASK_ENABLED=true
SCRAPE_CACHE_ENABLED=true
SCRAPE_CACHE_TTL=600
```

---

## Data Flow

1. **User searches** → Search page with scrape mode enabled
2. **Frontend calls** → `POST /api/search/scrape` with query
3. **API route checks cache** → Returns cached result if available
4. **API route calls Flask** → `POST http://127.0.0.1:5000/search`
5. **Flask orchestrates** → Calls all store scrapers in parallel
6. **Scrapers return** → Normalized product data
7. **Flask returns** → JSON response with all products
8. **API route maps** → Converts Python format to TypeScript format
9. **API route caches** → Stores result in cache (if enabled)
10. **Frontend receives** → Displays products in UI

---

## Features

### ✅ Real-time Scraping
- Searches all stores simultaneously
- Returns fresh, up-to-date product data
- No database dependency for scrape mode

### ✅ Caching
- Optional in-memory cache
- 10-minute TTL (configurable)
- Reduces load on stores
- Faster responses for repeated searches

### ✅ Error Handling
- Network error handling
- Timeout handling (120 seconds)
- Store-specific error tracking
- Graceful degradation (partial results)

### ✅ User Experience
- Loading indicators
- Progress messages
- Store-specific error display
- Search time display
- Success notifications

---

## Troubleshooting

### Flask Service Not Starting
1. Check Python version: `python3 --version` (requires 3.8+)
2. Install dependencies: `npm run flask:install`
3. Check port availability: `lsof -i :5000`
4. Review Flask logs for errors

### Connection Errors
1. Verify Flask is running: `curl http://127.0.0.1:5000/health`
2. Check `FLASK_API_URL` in `.env.local`
3. Verify CORS configuration in Flask app
4. Check firewall settings

### Scraping Errors
1. Check network connectivity
2. Verify store websites are accessible
3. Review rate limiting (may need to increase delays)
4. Check Flask console for detailed error messages
5. Some stores may require `curl-cffi` for better results

### No Results Returned
1. Check if stores are enabled in Flask
2. Verify search query is valid
3. Check store-specific errors in response
4. Review Flask logs for scraping errors

---

## Performance Considerations

- **Scraping Time:** 10-30 seconds depending on stores and pages
- **Cache Hit Rate:** Improves with repeated searches
- **Concurrent Requests:** Flask handles multiple requests
- **Rate Limiting:** Built into each scraper to avoid blocks

---

## Security Considerations

- Flask service should run on localhost in production
- CORS configured to only allow Next.js origin
- No authentication required for internal service
- Cache can be cleared via API endpoint (consider adding auth)

---

## Future Enhancements

1. **Background Jobs:** Queue scraping jobs for better UX
2. **WebSocket Updates:** Real-time progress updates
3. **Store Selection UI:** Let users choose which stores to search
4. **Result Persistence:** Optionally save scraped results to database
5. **Advanced Caching:** Redis for distributed caching
6. **Monitoring:** Add metrics and monitoring dashboard

---

## Testing

### Test Flask Service
```bash
# Start Flask
npm run flask:start

# Test search
curl -X POST http://127.0.0.1:5000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "laptop", "stores": ["amazon"], "pages": 1}'

# Test health
curl http://127.0.0.1:5000/health
```

### Test Next.js API
```bash
# Test search endpoint
curl -X POST http://localhost:3000/api/search/scrape \
  -H "Content-Type: application/json" \
  -d '{"query": "laptop", "stores": ["amazon"], "pages": 1}'

# Test health
curl http://localhost:3000/api/search/scrape
```

### Test UI
1. Start Next.js: `npm run dev`
2. Start Flask: `npm run flask:start`
3. Navigate to search page
4. Toggle to "Real-time Scrape" mode
5. Search for "laptop"
6. Verify results appear

---

## Summary

✅ **All phases completed successfully**
✅ **Python scripts integrated exactly as provided**
✅ **Real-time scraping functional**
✅ **Caching implemented**
✅ **Error handling comprehensive**
✅ **Documentation complete**

The integration is production-ready and follows the exact Python scripts provided by the development team.


# Python Scraping Service

This directory contains Python scripts for real-time product scraping from Saudi e-commerce stores.

## Overview

The scraping service provides real-time product search across multiple stores:
- **Amazon SA** (`amazon_sa_scraper.py`)
- **Noon** (`noon_scraper.py`)
- **Jarir** (`jarir_scraper.py`)
- **Extra** (`extra_sa_scraper.py`)

The Flask API (`app.py`) orchestrates searches across all stores and returns normalized results.

## Setup

### 1. Install Python Dependencies

```bash
# Using npm script
npm run flask:install

# Or manually
cd scripts/scraping
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in `scripts/scraping/` (optional):

```bash
FLASK_HOST=127.0.0.1
FLASK_PORT=5000
FLASK_DEBUG=false
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Or set these in the main `.env.local` file (they will be read by Flask).

### 3. Start Flask Service

```bash
# Using npm script
npm run flask:start

# Or using startup script
./scripts/scraping/start-flask.sh

# Or manually
cd scripts/scraping
python app.py
```

For development mode:
```bash
npm run flask:dev
```

## API Endpoints

### POST /search
Search for products across all stores.

**Request:**
```json
{
  "query": "laptop",
  "stores": ["amazon", "noon", "jarir"],
  "pages": 1,
  "sort": "price_asc"
}
```

**Response:**
```json
{
  "products": [...],
  "count": 50,
  "query": "laptop",
  "store_results": {
    "amazon": 20,
    "noon": 15,
    "jarir": 15
  },
  "price_stats": {
    "min": 1000,
    "max": 5000,
    "avg": 2500
  },
  "search_time": 12.5,
  "errors": null
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "stores": {
    "amazon": {"name": "Amazon SA", "enabled": true},
    "noon": {"name": "Noon", "enabled": true},
    "jarir": {"name": "Jarir", "enabled": true},
    "extra": {"name": "Extra", "enabled": false}
  }
}
```

## Integration with Next.js

The Flask service is called from Next.js via the API route:
- `POST /api/search/scrape` - Calls Flask `/search` endpoint
- `GET /api/search/scrape` - Health check (calls Flask `/health`)

## Configuration

### Flask Configuration
- `FLASK_HOST`: Host to bind to (default: 127.0.0.1)
- `FLASK_PORT`: Port to listen on (default: 5000)
- `FLASK_DEBUG`: Enable debug mode (default: false)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### Next.js Configuration
- `FLASK_API_URL`: URL of Flask service (default: http://127.0.0.1:5000)
- `FLASK_ENABLED`: Enable Flask integration (default: true)
- `SCRAPE_CACHE_ENABLED`: Enable result caching (default: true)
- `SCRAPE_CACHE_TTL`: Cache TTL in seconds (default: 600)

## Troubleshooting

### Flask service not starting
1. Check Python version: `python3 --version` (requires 3.8+)
2. Install dependencies: `npm run flask:install`
3. Check port availability: Ensure port 5000 is not in use

### Connection errors from Next.js
1. Verify Flask is running: `curl http://127.0.0.1:5000/health`
2. Check `FLASK_API_URL` in `.env.local`
3. Check CORS configuration in Flask app

### Scraping errors
1. Check network connectivity
2. Verify store websites are accessible
3. Check rate limiting (may need to increase delays)
4. Review error messages in Flask console

## Development

### Testing Individual Scrapers

```bash
# Test Amazon scraper
python amazon_sa_scraper.py "laptop" --pages 1

# Test Noon scraper
python noon_scraper.py "laptop" --pages 1 --country sa

# Test Jarir scraper
python jarir_scraper.py "laptop" --pages 1

# Test Extra scraper
python extra_sa_scraper.py "laptop" --pages 1
```

### Testing Flask API

```bash
# Start Flask
python app.py

# Test search endpoint
curl -X POST http://127.0.0.1:5000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "laptop", "stores": ["amazon", "noon"], "pages": 1}'

# Test health endpoint
curl http://127.0.0.1:5000/health
```

## Notes

- Scraping may take 10-30 seconds depending on number of stores and pages
- Rate limiting is built into each scraper to avoid being blocked
- Results are cached by default (10 minutes TTL) to reduce load
- Some stores may require additional dependencies (e.g., `curl-cffi` for better anti-bot evasion)



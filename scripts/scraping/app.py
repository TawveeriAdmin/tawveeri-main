#!/usr/bin/env python3
"""
Saudi Price Compare - Multi-Store Price Comparison Platform

Search and compare prices across multiple Saudi e-commerce stores:
- Amazon SA
- Noon.com
- Jarir Bookstore
- Extra.com (coming soon)

Usage:
    python app.py
    Open http://localhost:5000
"""

import os
import json
import csv
import io
import time
from dataclasses import asdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, request, jsonify, Response, session
from functools import wraps

from amazon_sa_scraper import AmazonSAScraper, Product as AmazonDirectProduct
from noon_scraper import NoonScraper, Product as NoonProduct
from jarir_scraper import JarirScraper, Product as JarirProduct

# Try to import Extra scraper
try:
    from extra_sa_scraper import ExtraSAScraper, Product as ExtraProduct
    EXTRA_AVAILABLE = True
except ImportError:
    EXTRA_AVAILABLE = False

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Configuration from environment variables
FLASK_HOST = os.getenv('FLASK_HOST', '127.0.0.1')
FLASK_PORT = int(os.getenv('FLASK_PORT', '5000'))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')

# Store configurations
STORES = {
    'amazon': {
        'name': 'Amazon SA',
        'url': 'https://www.amazon.sa',
        'logo': '🛒',
        'color': '#FF9900',
        'enabled': True,
    },
    'noon': {
        'name': 'Noon',
        'url': 'https://www.noon.com',
        'logo': '🌙',
        'color': '#FEEE00',
        'enabled': True,
    },
    'jarir': {
        'name': 'Jarir',
        'url': 'https://www.jarir.com',
        'logo': '📚',
        'color': '#00529B',
        'enabled': True,
    },
    'extra': {
        'name': 'Extra',
        'url': 'https://www.extra.com',
        'logo': '🔌',
        'color': '#E31837',
        'enabled': EXTRA_AVAILABLE,
    },
}


def add_cors_headers(response):
    """Add CORS headers to response"""
    origin = request.headers.get('Origin')
    # Always allow all origins in development, or if explicitly configured
    # This prevents CORS issues during development
    if FLASK_DEBUG or not ALLOWED_ORIGINS or len(ALLOWED_ORIGINS) == 0:
        response.headers['Access-Control-Allow-Origin'] = '*'
    elif origin and origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        # Default to allowing all if no specific config
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    return add_cors_headers(response)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'stores': {
            store: {
                'name': info['name'],
                'enabled': info['enabled'],
            }
            for store, info in STORES.items()
        }
    })


def normalize_product(product, store: str) -> dict:
    """Convert product dataclass to dictionary with normalized fields."""
    d = asdict(product)
    
    # Normalize field names across different scrapers
    normalized = {
        'store': store,
        'store_name': STORES.get(store, {}).get('name', store),
        'store_logo': STORES.get(store, {}).get('logo', '🏪'),
        'store_color': STORES.get(store, {}).get('color', '#666'),
        'title': d.get('title', 'No title'),
        'price': None,
        'price_display': 'N/A',
        'original_price': None,
        'discount': None,
        'currency': 'SAR',
        'rating': None,
        'reviews_count': None,
        'url': d.get('url', ''),
        'image_url': d.get('image_url'),
        'sku': None,
        'brand': d.get('brand'),
        'in_stock': d.get('in_stock', True),
        'badges': [],
    }
    
    # Extract price (handle different field names)
    price_val = d.get('price') or d.get('sale_price')
    if price_val:
        try:
            # Clean and convert price to float
            if isinstance(price_val, str):
                price_val = price_val.replace(',', '').replace('SAR', '').strip()
            normalized['price'] = float(price_val)
            normalized['price_display'] = f"{normalized['price']:,.2f}"
        except (ValueError, TypeError):
            normalized['price_display'] = str(price_val)
    
    # Original price
    orig_price = d.get('original_price') or d.get('old_price')
    if orig_price:
        try:
            if isinstance(orig_price, str):
                orig_price = orig_price.replace(',', '').replace('SAR', '').strip()
            normalized['original_price'] = float(orig_price)
        except (ValueError, TypeError):
            pass
    
    # Discount
    discount = d.get('discount_percentage') or d.get('discount')
    if discount:
        normalized['discount'] = str(discount)
    elif normalized['price'] and normalized['original_price'] and normalized['original_price'] > normalized['price']:
        discount_pct = ((normalized['original_price'] - normalized['price']) / normalized['original_price']) * 100
        normalized['discount'] = f"{discount_pct:.0f}%"
    
    # Currency
    normalized['currency'] = d.get('price_currency') or d.get('currency') or 'SAR'
    
    # Rating
    rating = d.get('rating')
    if rating:
        try:
            normalized['rating'] = float(rating)
        except (ValueError, TypeError):
            pass
    
    # Reviews
    reviews = d.get('review_count') or d.get('reviews_count')
    if reviews:
        try:
            normalized['reviews_count'] = int(str(reviews).replace(',', ''))
        except (ValueError, TypeError):
            pass
    
    # SKU/ASIN
    normalized['sku'] = d.get('asin') or d.get('sku') or d.get('id')
    
    # Badges
    if d.get('is_prime'):
        normalized['badges'].append('Prime')
    if d.get('is_express'):
        normalized['badges'].append('Express')
    if d.get('is_sponsored'):
        normalized['badges'].append('Sponsored')
    
    return normalized


def search_store(store: str, query: str, pages: int = 1) -> list:
    """Search a single store and return normalized products."""
    products = []
    
    try:
        if store == 'amazon':
            scraper = AmazonSAScraper(delay_range=(0.5, 1.5))
            raw_products = scraper.search_all_pages(query, pages)
            products = [normalize_product(p, 'amazon') for p in raw_products]
            
        elif store == 'noon':
            scraper = NoonScraper(country='sa', delay_range=(1, 2))
            raw_products = scraper.search_all_pages(query, pages)
            products = [normalize_product(p, 'noon') for p in raw_products]

        elif store == 'jarir':
            scraper = JarirScraper(delay_range=(1, 2))
            raw_products = scraper.search_all_pages(query, pages)
            products = [normalize_product(p, 'jarir') for p in raw_products]

        elif store == 'extra' and EXTRA_AVAILABLE:
            scraper = ExtraSAScraper(delay_range=(1, 2))
            raw_products = scraper.search_all_pages(query, pages)
            products = [normalize_product(p, 'extra') for p in raw_products]
            
    except Exception as e:
        print(f"Error searching {store}: {e}")
    
    return products


@app.route('/')
def index():
    """Render the main search UI."""
    enabled_stores = {k: v for k, v in STORES.items() if v.get('enabled', True)}
    return render_template('index.html', stores=enabled_stores)


@app.route('/search', methods=['POST', 'OPTIONS'])
def search():
    """Search for products across all selected stores."""
    if request.method == 'OPTIONS':
        response = jsonify({})
        return add_cors_headers(response)
    
    data = request.get_json()
    query = data.get('query', '').strip()
    pages = int(data.get('pages', 1))
    selected_stores = data.get('stores', ['amazon', 'noon', 'jarir'])  # Default to all
    sort_by = data.get('sort', 'price_asc')  # price_asc, price_desc, rating, name
    
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    # Filter to only enabled stores
    stores_to_search = [s for s in selected_stores if s in STORES and STORES[s].get('enabled', True)]
    
    if not stores_to_search:
        return jsonify({'error': 'No valid stores selected'}), 400
    
    all_products = []
    store_results = {}
    errors = {}
    
    start_time = time.time()
    
    # Search stores in parallel
    with ThreadPoolExecutor(max_workers=len(stores_to_search)) as executor:
        future_to_store = {
            executor.submit(search_store, store, query, pages): store 
            for store in stores_to_search
        }
        
        for future in as_completed(future_to_store):
            store = future_to_store[future]
            try:
                products = future.result()
                store_results[store] = len(products)
                all_products.extend(products)
            except Exception as e:
                errors[store] = str(e)
                store_results[store] = 0
    
    search_time = time.time() - start_time
    
    # Sort products
    if sort_by == 'price_asc':
        all_products.sort(key=lambda x: (x['price'] is None, x['price'] or float('inf')))
    elif sort_by == 'price_desc':
        all_products.sort(key=lambda x: (x['price'] is None, -(x['price'] or 0)))
    elif sort_by == 'rating':
        all_products.sort(key=lambda x: (x['rating'] is None, -(x['rating'] or 0)))
    elif sort_by == 'name':
        all_products.sort(key=lambda x: x['title'].lower())
    
    # Don't store in session for API usage (session cookies get too large)
    # Only store if we're using the web UI
    # session['last_results'] = all_products
    # session['last_query'] = query
    
    # Calculate price stats
    prices = [p['price'] for p in all_products if p['price'] is not None]
    price_stats = {
        'min': min(prices) if prices else None,
        'max': max(prices) if prices else None,
        'avg': sum(prices) / len(prices) if prices else None,
    }
    
    return jsonify({
        'products': all_products,
        'count': len(all_products),
        'query': query,
        'store_results': store_results,
        'price_stats': price_stats,
        'search_time': round(search_time, 2),
        'errors': errors if errors else None,
    })


@app.route('/export/<format>')
def export(format):
    """Export last search results as JSON or CSV."""
    products = session.get('last_results', [])
    query = session.get('last_query', 'products')
    
    if not products:
        return jsonify({'error': 'No results to export'}), 400
    
    filename = f"price_compare_{query.replace(' ', '_')}"
    
    if format == 'json':
        return Response(
            json.dumps(products, indent=2, ensure_ascii=False),
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename={filename}.json'}
        )
    elif format == 'csv':
        output = io.StringIO()
        if products:
            # Select fields for CSV
            csv_fields = ['store_name', 'title', 'price', 'original_price', 'discount', 
                         'currency', 'rating', 'reviews_count', 'brand', 'sku', 'url', 'image_url']
            writer = csv.DictWriter(output, fieldnames=csv_fields, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(products)
        
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={filename}.csv'}
        )
    else:
        return jsonify({'error': 'Invalid format. Use json or csv'}), 400


@app.route('/stores')
def get_stores():
    """Get list of available stores."""
    return jsonify({
        store: {
            'name': info['name'],
            'logo': info['logo'],
            'color': info['color'],
            'enabled': info['enabled'],
        }
        for store, info in STORES.items()
    })


if __name__ == '__main__':
    print("\n🛍️  Saudi Price Compare - Multi-Store Price Comparison")
    print("=" * 55)
    print("   Supported stores:")
    for store, info in STORES.items():
        status = "✅" if info['enabled'] else "❌"
        print(f"   {status} {info['logo']} {info['name']}")
    print("=" * 55)
    print(f"   Flask running on http://{FLASK_HOST}:{FLASK_PORT}")
    print(f"   Debug mode: {FLASK_DEBUG}")
    print(f"   Allowed origins: {', '.join(ALLOWED_ORIGINS)}\n")
    app.run(debug=FLASK_DEBUG, host=FLASK_HOST, port=FLASK_PORT)


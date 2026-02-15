#!/usr/bin/env python3
"""
Noon.com Product Scraper (Saudi Arabia & UAE)

This script scrapes product information from Noon.com including:
- Product titles (English & Arabic)
- Prices (original and discounted)
- Ratings and reviews
- Product URLs
- Images
- Express delivery status
- Seller information

Usage:
    python noon_scraper.py "laptop"
    python noon_scraper.py "iphone" --pages 3 --country sa
    python noon_scraper.py "tv" --output products.json --country ae

Note: Web scraping may violate Noon's Terms of Service.

Requirements:
    pip install requests beautifulsoup4 curl_cffi
"""

import json
import time
import random
import argparse
import csv
import re
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import urlencode, quote

# Try to import curl_cffi for better bot evasion, fallback to requests
try:
    from curl_cffi import requests as curl_requests
    USING_CURL_CFFI = True
except ImportError:
    import requests
    USING_CURL_CFFI = False
    print("⚠️  For better results, install curl_cffi: pip install curl_cffi")

if not USING_CURL_CFFI:
    import requests

from bs4 import BeautifulSoup


@dataclass
class Product:
    """Data class representing a Noon product"""
    title: str
    title_ar: Optional[str]
    price: Optional[str]
    original_price: Optional[str]
    discount_percentage: Optional[str]
    currency: str
    rating: Optional[float]
    review_count: Optional[int]
    url: str
    image_url: Optional[str]
    sku: Optional[str]
    brand: Optional[str]
    seller: Optional[str]
    in_stock: bool = True
    is_express: bool = False
    is_fulfilled_by_noon: bool = False


class NoonScraper:
    """Scraper for Noon.com with enhanced anti-bot evasion"""
    
    COUNTRY_CONFIGS = {
        "sa": {
            "base_url": "https://www.noon.com/saudi-en",
            "api_url": "https://www.noon.com/_svc/catalog/api/v3/u/",
            "currency": "SAR",
            "locale": "en-sa",
        },
        "ae": {
            "base_url": "https://www.noon.com/uae-en",
            "api_url": "https://www.noon.com/_svc/catalog/api/v3/u/",
            "currency": "AED",
            "locale": "en-ae",
        },
        "eg": {
            "base_url": "https://www.noon.com/egypt-en",
            "api_url": "https://www.noon.com/_svc/catalog/api/v3/u/",
            "currency": "EGP",
            "locale": "en-eg",
        },
    }
    
    # More realistic and recent user agents
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    ]
    
    # Browser fingerprints for curl_cffi
    BROWSER_IMPERSONATES = ["chrome120", "chrome119", "safari17_0", "edge120"]
    
    def __init__(self, country: str = "sa", delay_range: tuple = (2, 5)):
        """
        Initialize the scraper.
        
        Args:
            country: Country code ('sa' for Saudi Arabia, 'ae' for UAE, 'eg' for Egypt)
            delay_range: Tuple of (min, max) seconds to wait between requests
        """
        if country not in self.COUNTRY_CONFIGS:
            raise ValueError(f"Country must be one of: {list(self.COUNTRY_CONFIGS.keys())}")
        
        self.country = country
        self.config = self.COUNTRY_CONFIGS[country]
        self.delay_range = delay_range
        self.using_curl_cffi = USING_CURL_CFFI
        
        # Initialize session
        if USING_CURL_CFFI:
            self.session = curl_requests.Session()
        else:
            self.session = requests.Session()
            # Set up retry strategy for regular requests
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry
            retry_strategy = Retry(
                total=3,
                backoff_factor=1,
                status_forcelist=[429, 500, 502, 503, 504],
            )
            adapter = HTTPAdapter(max_retries=retry_strategy)
            self.session.mount("https://", adapter)
            self.session.mount("http://", adapter)
        
    def _get_headers(self) -> dict:
        """Generate realistic browser request headers"""
        ua = random.choice(self.USER_AGENTS)
        return {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"' if "Windows" in ua else '"macOS"',
            "Dnt": "1",
        }
    
    def _get_api_headers(self) -> dict:
        """Generate API request headers"""
        ua = random.choice(self.USER_AGENTS)
        return {
            "User-Agent": ua,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Content-Type": "application/json",
            "Origin": "https://www.noon.com",
            "Referer": f"{self.config['base_url']}/",
            "x-locale": self.config["locale"],
            "x-platform": "web",
            "x-content": "desktop",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
    
    def _make_request(self, url: str, headers: dict, timeout: int = 30) -> Optional[object]:
        """Make a request with proper error handling and retries"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                self._random_delay()
                
                if self.using_curl_cffi:
                    # Use curl_cffi with browser impersonation
                    impersonate = random.choice(self.BROWSER_IMPERSONATES)
                    response = self.session.get(
                        url,
                        headers=headers,
                        timeout=timeout,
                        impersonate=impersonate,
                    )
                else:
                    response = self.session.get(
                        url,
                        headers=headers,
                        timeout=timeout,
                    )
                
                response.raise_for_status()
                return response
                
            except Exception as e:
                print(f"  Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 5
                    print(f"  Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    return None
        
        return None
    
    def _random_delay(self):
        """Add random delay between requests"""
        delay = random.uniform(*self.delay_range)
        time.sleep(delay)
    
    def _extract_price(self, price_data) -> tuple:
        """Extract price information"""
        if isinstance(price_data, dict):
            current = price_data.get("now") or price_data.get("current") or price_data.get("price")
            original = price_data.get("was") or price_data.get("original")
            discount = price_data.get("discount_percent") or price_data.get("off")
            return str(current) if current else None, str(original) if original else None, str(discount) if discount else None
        elif price_data:
            return str(price_data), None, None
        return None, None, None
    
    def _parse_product_api(self, item: dict) -> Optional[Product]:
        """Parse a single product from API response"""
        try:
            # Basic info
            title = item.get("name", item.get("title", "No title"))
            title_ar = item.get("name_ar", item.get("title_ar"))
            
            # Price info
            price_data = item.get("price", item.get("sale_price", {}))
            price, original_price, discount = self._extract_price(price_data)
            
            # If price is nested differently
            if not price and item.get("sale_price"):
                price = str(item.get("sale_price"))
            if not original_price and item.get("price") and isinstance(item.get("price"), (int, float)):
                if item.get("sale_price") and item.get("price") != item.get("sale_price"):
                    original_price = str(item.get("price"))
            
            # URL construction
            sku = item.get("sku", item.get("id", item.get("product_id")))
            slug = item.get("slug", item.get("url_key", ""))
            if slug:
                url = f"{self.config['base_url']}/{slug}/p/{sku}/" if sku else f"{self.config['base_url']}/{slug}/"
            else:
                url = f"{self.config['base_url']}/search?q={sku}" if sku else ""
            
            # Image - Noon uses 'image_key' which needs CDN prefix
            image_url = None
            
            # Try different image keys in order of preference
            image_key = item.get("image_key")  # Most common for Noon
            if image_key:
                # Noon CDN format
                image_url = f"https://f.nooncdn.com/p/{image_key}.jpg"
            else:
                # Fallback to other possible keys
                for key in ["image_url", "image", "thumbnail", "img"]:
                    img_val = item.get(key)
                    if img_val:
                        if isinstance(img_val, str):
                            image_url = img_val
                        elif isinstance(img_val, dict):
                            image_url = img_val.get("url", img_val.get("src", ""))
                        elif isinstance(img_val, list) and len(img_val) > 0:
                            image_url = img_val[0] if isinstance(img_val[0], str) else img_val[0].get("url", "")
                        if image_url:
                            break
            
            # Ensure full URL
            if image_url:
                if image_url.startswith("//"):
                    image_url = f"https:{image_url}"
                elif not image_url.startswith("http"):
                    image_url = f"https://f.nooncdn.com/p/{image_url}"
            
            # Rating
            rating_data = item.get("rating", item.get("ratings", {}))
            if isinstance(rating_data, dict):
                rating = rating_data.get("average", rating_data.get("value"))
                review_count = rating_data.get("count", rating_data.get("total"))
            else:
                rating = rating_data if rating_data else None
                review_count = item.get("review_count", item.get("reviews_count"))
            
            return Product(
                title=title,
                title_ar=title_ar,
                price=price,
                original_price=original_price,
                discount_percentage=f"{discount}%" if discount and not str(discount).endswith("%") else discount,
                currency=self.config["currency"],
                rating=float(rating) if rating else None,
                review_count=int(review_count) if review_count else None,
                url=url,
                image_url=image_url,
                sku=str(sku) if sku else None,
                brand=item.get("brand", item.get("brand_name")),
                seller=item.get("seller_name", item.get("seller", {}).get("name") if isinstance(item.get("seller"), dict) else item.get("seller")),
                in_stock=item.get("in_stock", item.get("is_available", True)),
                is_express=item.get("is_express", item.get("express_delivery", False)),
                is_fulfilled_by_noon=item.get("is_fbn", item.get("fulfilled_by_noon", False)),
            )
        except Exception as e:
            print(f"Error parsing product: {e}")
            return None
    
    def _parse_product_html(self, product_element) -> Optional[Product]:
        """Parse a single product from HTML element"""
        try:
            # Title
            title_elem = product_element.select_one("[data-qa='product-name'], .productTitle, h2")
            title = title_elem.get_text(strip=True) if title_elem else "No title"
            
            # URL
            link_elem = product_element.select_one("a[href*='/p/'], a.productLink")
            url = ""
            if link_elem and link_elem.get("href"):
                href = link_elem["href"]
                url = href if href.startswith("http") else "https://www.noon.com" + href
            
            # SKU from URL
            sku = None
            if url:
                sku_match = re.search(r'/p/(\w+)', url)
                if sku_match:
                    sku = sku_match.group(1)
            
            # Price
            price = None
            price_elem = product_element.select_one("[data-qa='product-price'], .priceNow, .currentPrice")
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                price = re.sub(r'[^\d.,]', '', price_text)
            
            # Original price
            original_price = None
            original_elem = product_element.select_one("[data-qa='product-price-was'], .priceWas, .originalPrice")
            if original_elem:
                original_text = original_elem.get_text(strip=True)
                original_price = re.sub(r'[^\d.,]', '', original_text)
            
            # Discount
            discount = None
            discount_elem = product_element.select_one("[data-qa='product-discount'], .discount, .saveBadge")
            if discount_elem:
                discount = discount_elem.get_text(strip=True)
            
            # Image - try multiple selectors
            image_url = None
            img_selectors = [
                "img.productImage",
                "img[data-qa='product-image']",
                "img[class*='product']",
                "img[class*='lazyload']",
                "picture img",
                "img",
            ]
            for selector in img_selectors:
                img_elem = product_element.select_one(selector)
                if img_elem:
                    # Try different attributes
                    image_url = (
                        img_elem.get("src") or 
                        img_elem.get("data-src") or 
                        img_elem.get("data-lazy-src") or
                        img_elem.get("srcset", "").split()[0] if img_elem.get("srcset") else None
                    )
                    if image_url and not image_url.startswith("data:"):
                        # Ensure full URL
                        if image_url.startswith("//"):
                            image_url = f"https:{image_url}"
                        break
                    image_url = None
            
            # Rating
            rating = None
            rating_elem = product_element.select_one("[data-qa='product-rating'], .ratingValue")
            if rating_elem:
                rating_text = rating_elem.get_text(strip=True)
                rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                if rating_match:
                    rating = float(rating_match.group(1))
            
            # Express badge
            is_express = bool(product_element.select_one("[data-qa='express-badge'], .expressTag"))
            
            # Brand
            brand_elem = product_element.select_one("[data-qa='product-brand'], .brandName")
            brand = brand_elem.get_text(strip=True) if brand_elem else None
            
            return Product(
                title=title,
                title_ar=None,
                price=price,
                original_price=original_price,
                discount_percentage=discount,
                currency=self.config["currency"],
                rating=rating,
                review_count=None,
                url=url,
                image_url=image_url,
                sku=sku,
                brand=brand,
                seller=None,
                in_stock=True,
                is_express=is_express,
                is_fulfilled_by_noon=False,
            )
        except Exception as e:
            print(f"Error parsing HTML product: {e}")
            return None
    
    def search_api(self, query: str, page: int = 1, page_size: int = 50) -> list[Product]:
        """
        Search using Noon's internal API.
        
        Args:
            query: Search term
            page: Page number (1-indexed)
            page_size: Number of results per page
            
        Returns:
            List of Product objects
        """
        # Noon API endpoint
        api_url = f"https://www.noon.com/_svc/catalog/api/v3/u/{self.config['locale']}/search"
        params = f"?q={quote(query)}&page={page}&limit={page_size}&sort%5Bby%5D=relevance&sort%5Bdir%5D=desc"
        full_url = api_url + params
        
        response = self._make_request(full_url, self._get_api_headers(), timeout=30)
        
        if response:
            try:
                data = response.json()
                products = []
                
                # Handle different response structures
                hits = (
                    data.get("hits", []) or 
                    data.get("results", []) or 
                    data.get("products", []) or
                    data.get("data", {}).get("hits", []) or
                    data.get("data", {}).get("products", [])
                )
                
                for item in hits:
                    product = self._parse_product_api(item)
                    if product:
                        products.append(product)
                
                if products:
                    return products
                    
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                print(f"  Error parsing API response: {e}")
        
        # Fallback to HTML scraping
        return self.search_html(query, page)
    
    def search_html(self, query: str, page: int = 1) -> list[Product]:
        """
        Search using HTML scraping.
        
        Args:
            query: Search term
            page: Page number
            
        Returns:
            List of Product objects
        """
        url = f"{self.config['base_url']}/search/?q={quote(query)}&page={page}"
        
        response = self._make_request(url, self._get_headers(), timeout=30)
        
        if not response:
            return []
        
        try:
            soup = BeautifulSoup(response.text, "html.parser")
            products = []
            
            # Try to find Next.js data first (more reliable)
            next_data = soup.select_one("script#__NEXT_DATA__")
            if next_data:
                try:
                    data = json.loads(next_data.string)
                    # Navigate to product data in Next.js structure
                    page_props = data.get("props", {}).get("pageProps", {})
                    catalog = page_props.get("catalog", {}) or page_props.get("initialState", {}).get("catalog", {})
                    hits = catalog.get("hits", []) or catalog.get("products", [])
                    
                    for item in hits:
                        product = self._parse_product_api(item)
                        if product:
                            products.append(product)
                    
                    if products:
                        return products
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
            
            # Fallback: Look for product containers in HTML
            selectors = [
                "[data-qa='product-block']",
                ".productContainer",
                ".product-card",
                "[class*='productCard']",
                "div[class*='Product']",
                "a[href*='/p/']",
            ]
            
            for selector in selectors:
                product_elements = soup.select(selector)
                if product_elements:
                    for elem in product_elements:
                        product = self._parse_product_html(elem)
                        if product and product.title != "No title":
                            products.append(product)
                    break
            
            return products
            
        except Exception as e:
            print(f"  Error parsing HTML: {e}")
            return []
    
    def search(self, query: str, page: int = 1) -> list[Product]:
        """
        Search for products (tries API first, falls back to HTML).
        
        Args:
            query: Search term
            page: Page number
            
        Returns:
            List of Product objects
        """
        products = self.search_api(query, page)
        if not products:
            products = self.search_html(query, page)
        return products
    
    def search_all_pages(self, query: str, max_pages: int = 5) -> list[Product]:
        """
        Search across multiple pages.
        
        Args:
            query: Search term
            max_pages: Maximum pages to scrape
            
        Returns:
            List of all products found
        """
        all_products = []
        
        for page in range(1, max_pages + 1):
            print(f"Scraping page {page}...")
            products = self.search(query, page)
            
            if not products:
                print(f"No products on page {page}, stopping.")
                break
            
            all_products.extend(products)
            print(f"Found {len(products)} products on page {page}")
        
        # Remove duplicates by SKU
        seen_skus = set()
        unique_products = []
        for p in all_products:
            if p.sku and p.sku not in seen_skus:
                seen_skus.add(p.sku)
                unique_products.append(p)
            elif not p.sku:
                unique_products.append(p)
        
        return unique_products


def save_to_json(products: list[Product], filename: str):
    """Save products to JSON file"""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump([asdict(p) for p in products], f, indent=2, ensure_ascii=False)
    print(f"Saved {len(products)} products to {filename}")


def save_to_csv(products: list[Product], filename: str):
    """Save products to CSV file"""
    if not products:
        print("No products to save")
        return
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=asdict(products[0]).keys())
        writer.writeheader()
        for product in products:
            writer.writerow(asdict(product))
    print(f"Saved {len(products)} products to {filename}")


def main():
    parser = argparse.ArgumentParser(
        description="Scrape products from Noon.com"
    )
    parser.add_argument(
        "query",
        help="Search query (e.g., 'laptop', 'iphone', 'tv')"
    )
    parser.add_argument(
        "--country",
        "-c",
        choices=["sa", "ae", "eg"],
        default="sa",
        help="Country (sa=Saudi Arabia, ae=UAE, eg=Egypt; default: sa)"
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=1,
        help="Number of pages to scrape (default: 1)"
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output filename (.json or .csv)"
    )
    parser.add_argument(
        "--delay-min",
        type=float,
        default=1,
        help="Minimum delay between requests (default: 1)"
    )
    parser.add_argument(
        "--delay-max",
        type=float,
        default=3,
        help="Maximum delay between requests (default: 3)"
    )
    
    args = parser.parse_args()
    
    country_names = {"sa": "Saudi Arabia", "ae": "UAE", "eg": "Egypt"}
    
    print(f"\n🔍 Searching Noon.com ({country_names[args.country]}) for: '{args.query}'")
    print(f"📄 Pages to scrape: {args.pages}")
    print("-" * 50)
    
    scraper = NoonScraper(
        country=args.country,
        delay_range=(args.delay_min, args.delay_max)
    )
    products = scraper.search_all_pages(args.query, args.pages)
    
    print("-" * 50)
    print(f"\n✅ Total products found: {len(products)}")
    
    if products:
        print("\n📦 Sample Results:")
        for i, product in enumerate(products[:5], 1):
            title_display = product.title[:55] + "..." if len(product.title) > 55 else product.title
            print(f"\n{i}. {title_display}")
            print(f"   Price: {product.price} {product.currency}")
            if product.original_price:
                print(f"   Original: {product.original_price} {product.currency} ({product.discount_percentage} off)")
            print(f"   Rating: {product.rating} ({product.review_count} reviews)" if product.rating else "   Rating: N/A")
            print(f"   Brand: {product.brand or 'N/A'}")
            print(f"   Express: {'Yes ⚡' if product.is_express else 'No'}")
            print(f"   SKU: {product.sku}")
    
    if args.output:
        if args.output.endswith(".csv"):
            save_to_csv(products, args.output)
        else:
            if not args.output.endswith(".json"):
                args.output += ".json"
            save_to_json(products, args.output)
    
    return products


if __name__ == "__main__":
    main()
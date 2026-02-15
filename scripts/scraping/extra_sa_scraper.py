#!/usr/bin/env python3
"""
Extra Saudi Arabia (extra.com.sa) Product Scraper

This script scrapes product information from Extra.com.sa including:
- Product titles
- Prices (original and discounted)
- Ratings
- Product URLs
- Images
- Stock availability

Usage:
    python extra_sa_scraper.py "laptop"
    python extra_sa_scraper.py "iphone" --pages 3
    python extra_sa_scraper.py "tv" --output products.json

Note: Web scraping may violate Extra's Terms of Service.

Requirements:
    pip install requests beautifulsoup4
    pip install curl_cffi  # Optional, for better anti-bot evasion
"""

import json
import time
import random
import argparse
import csv
import re
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import quote

# Try to import curl_cffi for better bot evasion, fallback to requests
try:
    from curl_cffi import requests as curl_requests
    USING_CURL_CFFI = True
    # Valid impersonate options for curl_cffi
    BROWSER_IMPERSONATES = ["chrome110", "chrome107", "chrome104", "chrome101", "chrome100", "safari15_5", "safari15_3"]
except ImportError:
    import requests
    USING_CURL_CFFI = False
    BROWSER_IMPERSONATES = []
    print("⚠️  For better results, install curl_cffi: pip install curl_cffi")

if not USING_CURL_CFFI:
    import requests

from bs4 import BeautifulSoup


@dataclass
class Product:
    """Data class representing an Extra product"""
    title: str
    title_ar: Optional[str]
    price: Optional[str]
    original_price: Optional[str]
    discount_percentage: Optional[str]
    currency: str
    rating: Optional[str]
    review_count: Optional[str]
    url: str
    image_url: Optional[str]
    sku: Optional[str]
    brand: Optional[str]
    in_stock: bool = True
    is_express_delivery: bool = False


class ExtraSAScraper:
    """Scraper for Extra Saudi Arabia (extra.com.sa) with enhanced anti-bot evasion"""
    
    BASE_URL = "https://www.extra.com"
    
    # Modern user agents
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    ]
    
    # Browser fingerprints for curl_cffi - use module-level variable
    # BROWSER_IMPERSONATES defined at module level
    
    def __init__(self, delay_range: tuple = (2, 5), language: str = "en"):
        """
        Initialize the scraper.
        
        Args:
            delay_range: Tuple of (min, max) seconds to wait between requests
            language: Language code ('en' for English, 'ar' for Arabic)
        """
        self.delay_range = delay_range
        self.language = language
        # URL format is /en-sa/ for English, /ar-sa/ for Arabic
        self.base_search_url = f"{self.BASE_URL}/{language}-sa/search"
        self.base_url_lang = f"{self.BASE_URL}/{language}-sa"
        self.using_curl_cffi = USING_CURL_CFFI
        
        # Initialize session
        if USING_CURL_CFFI:
            self.session = curl_requests.Session()
        else:
            self.session = requests.Session()
            # Set up retry strategy
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
            "Origin": self.BASE_URL,
            "Referer": f"{self.base_url_lang}/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
    
    def _make_request(self, url: str, headers: dict, timeout: int = 30) -> Optional[object]:
        """Make a request with proper error handling and retries"""
        max_retries = 3
        
        # Try with regular requests first (more reliable for Extra)
        for attempt in range(max_retries):
            try:
                self._random_delay()
                
                # Use regular requests library (more stable)
                import requests as req
                response = req.get(
                    url,
                    headers=headers,
                    timeout=timeout,
                    allow_redirects=True,
                )
                response.raise_for_status()
                return response
                
            except Exception as e:
                print(f"  Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    print(f"  Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    # Last attempt: try curl_cffi if available
                    if self.using_curl_cffi:
                        try:
                            print("  Trying curl_cffi as fallback...")
                            impersonate = random.choice(BROWSER_IMPERSONATES) if BROWSER_IMPERSONATES else None
                            if impersonate:
                                response = self.session.get(
                                    url,
                                    headers=headers,
                                    timeout=timeout,
                                    impersonate=impersonate,
                                )
                                response.raise_for_status()
                                return response
                        except Exception as curl_err:
                            print(f"  curl_cffi also failed: {curl_err}")
                    return None
        
        return None
    
    def _random_delay(self):
        """Add random delay between requests"""
        delay = random.uniform(*self.delay_range)
        time.sleep(delay)
    
    def _parse_product_html(self, product_element) -> Optional[Product]:
        """Parse a single product from HTML element"""
        try:
            # Title
            title_elem = product_element.select_one(".product-name a, .product-title a, h2.product-name")
            title = title_elem.get_text(strip=True) if title_elem else "No title"
            
            # URL
            link_elem = product_element.select_one("a.product-link, .product-name a, a[href*='/p/']")
            url = ""
            if link_elem and link_elem.get("href"):
                href = link_elem["href"]
                url = href if href.startswith("http") else self.BASE_URL + href
            
            # Price
            price = None
            price_elem = product_element.select_one(".special-price .price, .product-price, .price-box .price")
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                price = re.sub(r'[^\d.,]', '', price_text)
            
            # Original price
            original_price = None
            original_elem = product_element.select_one(".old-price .price, .was-price")
            if original_elem:
                original_text = original_elem.get_text(strip=True)
                original_price = re.sub(r'[^\d.,]', '', original_text)
            
            # Discount
            discount = None
            discount_elem = product_element.select_one(".discount-percent, .sale-badge")
            if discount_elem:
                discount = discount_elem.get_text(strip=True)
            
            # Image
            img_elem = product_element.select_one("img.product-image, .product-image img")
            image_url = None
            if img_elem:
                image_url = img_elem.get("src") or img_elem.get("data-src")
            
            # SKU
            sku = product_element.get("data-sku") or product_element.get("data-product-id")
            
            # Brand
            brand_elem = product_element.select_one(".product-brand, .brand-name")
            brand = brand_elem.get_text(strip=True) if brand_elem else None
            
            # Rating
            rating = None
            rating_elem = product_element.select_one(".rating-value, .star-rating")
            if rating_elem:
                rating = rating_elem.get_text(strip=True)
            
            # Stock status
            in_stock = not bool(product_element.select_one(".out-of-stock"))
            
            return Product(
                title=title,
                title_ar=None,
                price=price,
                original_price=original_price,
                discount_percentage=discount,
                currency="SAR",
                rating=rating,
                review_count=None,
                url=url,
                image_url=image_url,
                sku=sku,
                brand=brand,
                in_stock=in_stock,
                is_express_delivery=False,
            )
        except Exception as e:
            print(f"Error parsing product: {e}")
            return None
    
    def _parse_product_api(self, item: dict) -> Optional[Product]:
        """Parse a single product from API response"""
        try:
            # Extract price info
            price_info = item.get("price", {})
            price = str(price_info.get("final_price") or price_info.get("current") or item.get("price"))
            original_price = str(price_info.get("regular_price") or price_info.get("was")) if price_info.get("regular_price") or price_info.get("was") else None
            
            # Calculate discount
            discount = None
            if price_info.get("discount_percent"):
                discount = f"{price_info.get('discount_percent')}%"
            
            return Product(
                title=item.get("name", item.get("title", "No title")),
                title_ar=item.get("name_ar"),
                price=price,
                original_price=original_price,
                discount_percentage=discount,
                currency=item.get("currency", "SAR"),
                rating=str(item.get("rating")) if item.get("rating") else None,
                review_count=str(item.get("review_count")) if item.get("review_count") else None,
                url=item.get("url", item.get("product_url", "")),
                image_url=item.get("image", item.get("thumbnail", item.get("image_url"))),
                sku=item.get("sku", item.get("id")),
                brand=item.get("brand"),
                in_stock=item.get("in_stock", item.get("is_saleable", True)),
                is_express_delivery=item.get("express_delivery", False),
            )
        except Exception as e:
            print(f"Error parsing API product: {e}")
            return None
    
    def search_html(self, query: str, page: int = 1) -> list[Product]:
        """
        Search for products using HTML scraping.
        
        Args:
            query: Search term
            page: Page number
            
        Returns:
            List of Product objects
        """
        # Extra.com search URL format
        url = f"{self.base_search_url}?q={quote(query)}&page={page}"
        
        response = self._make_request(url, self._get_headers(), timeout=30)
        
        if not response:
            return []
        
        try:
            soup = BeautifulSoup(response.text, "html.parser")
            products = []
            
            # Try to find Next.js or embedded JSON data first (more reliable)
            next_data = soup.select_one("script#__NEXT_DATA__")
            if next_data:
                try:
                    data = json.loads(next_data.string)
                    page_props = data.get("props", {}).get("pageProps", {})
                    
                    # Look for products in various locations
                    product_list = (
                        page_props.get("products", []) or
                        page_props.get("searchResults", {}).get("products", []) or
                        page_props.get("initialData", {}).get("products", [])
                    )
                    
                    for item in product_list:
                        product = self._parse_product_api(item)
                        if product:
                            products.append(product)
                    
                    if products:
                        return products
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
            
            # Look for inline JSON data
            for script in soup.select("script"):
                if script.string and ("products" in script.string or "searchResults" in script.string):
                    try:
                        # Try to find JSON object in script
                        match = re.search(r'(\{.*"products".*\})', script.string, re.DOTALL)
                        if match:
                            data = json.loads(match.group(1))
                            product_list = data.get("products", [])
                            for item in product_list:
                                product = self._parse_product_api(item)
                                if product:
                                    products.append(product)
                            if products:
                                return products
                    except (json.JSONDecodeError, AttributeError):
                        pass
            
            # Fallback: Find product containers in HTML (Extra uses various class names)
            selectors = [
                ".product-item",
                ".product-card",
                "[data-product-id]",
                ".products-grid .item",
                "[class*='ProductCard']",
                "[class*='product-card']",
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
        # Try HTML scraping as primary method
        return self.search_html(query, page)
    
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
        description="Scrape products from Extra Saudi Arabia (extra.com.sa)"
    )
    parser.add_argument(
        "query",
        help="Search query (e.g., 'laptop', 'iphone', 'tv')"
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
        "--language",
        "-l",
        choices=["en", "ar"],
        default="en",
        help="Language (default: en)"
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
    
    print(f"\n🔍 Searching Extra.com.sa for: '{args.query}'")
    print(f"📄 Pages to scrape: {args.pages}")
    print(f"🌐 Language: {args.language}")
    print("-" * 50)
    
    scraper = ExtraSAScraper(
        delay_range=(args.delay_min, args.delay_max),
        language=args.language
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
            print(f"   Brand: {product.brand or 'N/A'}")
            print(f"   SKU: {product.sku}")
            print(f"   In Stock: {'Yes' if product.in_stock else 'No'}")
    
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
#!/usr/bin/env python3
"""
Jarir Bookstore Saudi Arabia (jarir.com) Product Scraper

Scrapes product information from Jarir.com including:
- Product titles (English & Arabic)
- Prices (original and discounted)
- Ratings and reviews
- Product URLs and images
- Stock availability
- Categories

Usage:
    python jarir_scraper.py "laptop"
    python jarir_scraper.py "iphone" --pages 3
    python jarir_scraper.py --category smart-home --pages 2
    python jarir_scraper.py --url "https://www.jarir.com/sa-en/smart-home.html"

Requirements:
    pip install requests beautifulsoup4
"""

import json
import time
import random
import argparse
import csv
import re
from dataclasses import dataclass, asdict
from typing import Optional, List
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup


@dataclass
class Product:
    """Data class representing a Jarir product"""
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
    category: Optional[str]
    in_stock: bool = True
    is_new: bool = False
    is_bestseller: bool = False


class JarirScraper:
    """Scraper for Jarir Bookstore (jarir.com)"""
    
    BASE_URL = "https://www.jarir.com"
    
    # Category URLs for direct browsing
    CATEGORIES = {
        "laptops": "/sa-en/computers-tablets/laptops.html",
        "desktops": "/sa-en/computers-tablets/desktops.html",
        "tablets": "/sa-en/computers-tablets/tablets.html",
        "smartphones": "/sa-en/smartphones.html",
        "iphone": "/sa-en/smartphones/apple.html",
        "iphone-17-pro-max": "/sa-en/smartphones.html?model=iPhone+17+Pro+Max",
        "iphone-17-pro": "/sa-en/smartphones.html?model=iPhone+17+Pro",
        "iphone-17": "/sa-en/smartphones.html?model=iPhone+17",
        "iphone-16-pro-max": "/sa-en/smartphones.html?model=iPhone+16+Pro+Max",
        "iphone-16-pro": "/sa-en/smartphones.html?model=iPhone+16+Pro",
        "samsung-phones": "/sa-en/smartphones/samsung.html",
        "galaxy-s25": "/sa-en/smartphones.html?model=Galaxy+S25",
        "galaxy-s25-ultra": "/sa-en/smartphones.html?model=Galaxy+S25+Ultra",
        "smartwatches": "/sa-en/smartwatches-wearables.html",
        "apple-watch": "/sa-en/smartwatches-wearables/apple.html",
        "gaming": "/sa-en/video-pc-gaming.html",
        "playstation": "/sa-en/video-pc-gaming/playstation.html",
        "ps5": "/sa-en/video-pc-gaming.html?brand=Sony",
        "xbox": "/sa-en/video-pc-gaming/xbox.html",
        "nintendo": "/sa-en/video-pc-gaming/nintendo.html",
        "smart-home": "/sa-en/smart-home.html",
        "security-cameras": "/sa-en/security-cameras.html",
        "tvs": "/sa-en/smart-tv-accessories.html",
        "audio": "/sa-en/speakers-headsets-gadgets.html",
        "headphones": "/sa-en/speakers-headsets-gadgets/headphones-earphones.html",
        "airpods": "/sa-en/speakers-headsets-gadgets.html?brand=Apple",
        "printers": "/sa-en/printers-scanners.html",
        "monitors": "/sa-en/monitors-projectors.html",
        "macbook": "/sa-en/computers-tablets/laptops.html?brand=Apple",
        "office": "/sa-en/office-supplies.html",
        "arabic-books": "/sa-en/arabic-books.html",
        "english-books": "/sa-en/english-books.html",
        "new-arrivals": "/sa-en/new-arrivals.html",
        "offers": "/sa-en/offers.html",
    }
    
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    ]
    
    def __init__(self, language: str = "en", delay_range: tuple = (2, 4)):
        self.language = language
        self.delay_range = delay_range
        self.session = requests.Session()
        
        # Setup retry
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
    
    def _get_headers(self) -> dict:
        ua = random.choice(self.USER_AGENTS)
        return {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Ch-Ua": '"Chromium";v="122", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }
    
    def _random_delay(self):
        time.sleep(random.uniform(*self.delay_range))
    
    def _make_request(self, url: str, timeout: int = 30):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                self._random_delay()
                response = self.session.get(url, headers=self._get_headers(), timeout=timeout)
                response.raise_for_status()
                # Ensure proper encoding
                response.encoding = 'utf-8'
                return response
            except Exception as e:
                print(f"  Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep((attempt + 1) * 3)
        return None
    
    def _parse_price(self, price_str: str) -> Optional[str]:
        if not price_str:
            return None
        cleaned = re.sub(r'[^\d.,]', '', price_str).replace(',', '')
        return cleaned if cleaned else None
    
    def _parse_product(self, elem, category: str = None) -> Optional[Product]:
        try:
            # elem should be an anchor tag with data-product-id
            if elem.name != 'a':
                return None

            # SKU from data-product-id attribute
            sku = elem.get("data-product-id")

            # URL from href
            href = elem.get("href", "")
            url = href if href.startswith("http") else urljoin(self.BASE_URL, href)

            # Title from .product-title__title
            title = "No title"
            title_elem = elem.select_one(".product-title__title")
            if title_elem:
                title = title_elem.get_text(strip=True)

            # Specs from .product-title__info
            specs = ""
            specs_elem = elem.select_one(".product-title__info")
            if specs_elem:
                spec_boxes = specs_elem.select(".product-title__info--box")
                specs = " | ".join([s.get_text(strip=True) for s in spec_boxes])

            # Combine title with specs if available
            if specs:
                title = f"{title} - {specs}"

            # Brand - extract from title or brand logo
            brand = None
            known_brands = ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Sony', 'LG', 'HP', 'Dell',
                          'Lenovo', 'Asus', 'Microsoft', 'Google', 'OnePlus', 'OPPO', 'Vivo',
                          'Honor', 'Motorola', 'Nokia', 'Realme', 'Acer', 'MSI', 'Razer',
                          'Canon', 'Nikon', 'JBL', 'Bose', 'Anker', 'Logitech']
            for b in known_brands:
                if b.lower() in title.lower():
                    brand = b
                    break

            # Image - find img in product tile
            img_elem = elem.select_one("img[src]")
            image_url = None
            if img_elem:
                image_url = img_elem.get("src") or img_elem.get("data-src")
                if image_url:
                    # Handle Cloudflare CDN URLs - extract the actual image URL
                    # Pattern: https://www.jarir.com/cdn-cgi/image/.../https://ak-asset.jarir.com/akeneo-prod/asset/...
                    if "cdn-cgi/image" in image_url:
                        # Extract the embedded image URL from the CDN URL
                        asset_match = re.search(r'https://ak-asset\.jarir\.com/akeneo-prod/asset/([^\s?]+)', image_url)
                        if asset_match:
                            # Use the actual asset URL directly
                            image_url = f"https://ak-asset.jarir.com/akeneo-prod/asset/{asset_match.group(1)}"
                            # Remove any query params
                            if "?" in image_url:
                                image_url = image_url.split("?")[0]
                    
                    # Make sure it's a full URL
                    if image_url and not image_url.startswith("http"):
                        image_url = urljoin(self.BASE_URL, image_url)

            # Get full text for various checks
            full_text = elem.get_text()

            # Price - find in .price element
            price = None
            original_price = None

            # Current price - look for price spans
            price_box = elem.select_one(".price-box")
            if price_box:
                price_text = price_box.get_text()
                price_matches = re.findall(r'SR\s*([\d,]+)', price_text)
            else:
                price_matches = re.findall(r'SR\s*([\d,]+)', full_text)

            if price_matches:
                # Clean and sort prices
                clean_prices = [p.replace(',', '') for p in price_matches]
                numeric_prices = [int(p) for p in clean_prices if p.isdigit()]

                if numeric_prices:
                    # Lowest is current price, highest is original
                    numeric_prices.sort()
                    price = str(numeric_prices[0])
                    if len(numeric_prices) > 1 and numeric_prices[-1] > numeric_prices[0]:
                        original_price = str(numeric_prices[-1])

            # Discount calculation
            discount = None
            if price and original_price:
                try:
                    p, op = float(price), float(original_price)
                    if op > p:
                        discount = f"{int((1 - p/op) * 100)}%"
                except:
                    pass

            # Rating - look for rating value
            rating = None
            rating_elem = elem.select_one(".rating-result")
            if rating_elem:
                rating_text = rating_elem.get_text(strip=True)
                rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                if rating_match:
                    try:
                        r = float(rating_match.group(1))
                        if 0 < r <= 5:
                            rating = r
                    except:
                        pass

            # Stock status
            in_stock = "out of stock" not in full_text.lower()
            
            if title == "No title":
                return None
            
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
                category=category,
                in_stock=in_stock,
                is_new=False,
                is_bestseller=False,
            )
        except Exception as e:
            print(f"  Error parsing product: {e}")
            return None
    
    def _fetch_product_image_from_page(self, product_url: str) -> Optional[str]:
        """Fetch image from product page - search results don't have images, only product pages do"""
        try:
            # Use shorter timeout and no delay for image fetching (already delayed in main search loop)
            # Make request directly without delay to speed up image fetching
            response = self.session.get(
                product_url, 
                headers=self._get_headers(), 
                timeout=10  # Shorter timeout for image fetching
            )
            if not response or response.status_code != 200:
                return None
            
            response.encoding = 'utf-8'
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Find images with cdn-cgi URLs (product images)
            # Pattern discovered: img[src*="cdn-cgi"] finds images with Cloudflare CDN URLs
            imgs = soup.select('img[src*="cdn-cgi"]')
            if not imgs:
                # Fallback: try img[src*="ak-asset"]
                imgs = soup.select('img[src*="ak-asset"]')
            
            for img in imgs:
                img_url = img.get("src") or img.get("data-src")
                if not img_url:
                    continue
                
                # Skip non-product images (brand logos, icons, etc.)
                if (img_url.startswith("data:") or 
                    "placeholder" in img_url.lower() or
                    img_url.lower().endswith(".svg") or
                    "icon" in img_url.lower() or
                    ("catalog" in img_url.lower() and "asset" not in img_url.lower())):
                    continue
                
                # Handle Cloudflare CDN URLs - extract the actual image URL
                # Pattern: https://www.jarir.com/cdn-cgi/image/.../https://ak-asset.jarir.com/akeneo-prod/asset/...
                if "cdn-cgi/image" in img_url:
                    # Extract: https://ak-asset.jarir.com/akeneo-prod/asset/...
                    asset_match = re.search(r'https://ak-asset\.jarir\.com/akeneo-prod/asset/([^\s?]+)', img_url)
                    if asset_match:
                        img_url = f"https://ak-asset.jarir.com/akeneo-prod/asset/{asset_match.group(1)}"
                        if "?" in img_url:
                            img_url = img_url.split("?")[0]
                        return img_url
                
                # If it's already an ak-asset URL, use it directly
                if "ak-asset.jarir.com/akeneo-prod/asset" in img_url:
                    if "?" in img_url:
                        img_url = img_url.split("?")[0]
                    return img_url
            
            return None
        except Exception as e:
            # Silently fail - don't log every failure to avoid spam
            return None
    
    def _parse_page(self, html: str, category: str = None) -> List[Product]:
        soup = BeautifulSoup(html, "html.parser")
        products = []

        # Jarir product cards are anchor tags with data-product-id attribute
        # Selector: a[data-product-id]
        product_cards = soup.select("a[data-product-id]")

        seen_skus = set()
        for card in product_cards:
            # Skip duplicates by SKU
            sku = card.get("data-product-id")
            if sku in seen_skus:
                continue
            seen_skus.add(sku)

            # Parse this product card
            product = self._parse_product(card, category)
            if product and product.title != "No title" and product.price:
                # Search results don't have images - always fetch from product page
                # Even if image_url is set, it's likely a placeholder or invalid
                product.image_url = self._fetch_product_image_from_page(product.url)
                
                products.append(product)

        return products
    
    def search(self, query: str, page: int = 1) -> List[Product]:
        url = f"{self.BASE_URL}/sa-en/catalogsearch/result/?q={quote(query)}&p={page}"
        print(f"  Fetching: {url}")
        response = self._make_request(url)
        return self._parse_page(response.text) if response else []
    
    def browse_category(self, category: str, page: int = 1) -> List[Product]:
        if category not in self.CATEGORIES:
            print(f"  Unknown category. Available: {list(self.CATEGORIES.keys())}")
            return []
        url = f"{self.BASE_URL}{self.CATEGORIES[category]}?p={page}"
        print(f"  Fetching: {url}")
        response = self._make_request(url)
        return self._parse_page(response.text, category) if response else []
    
    def browse_url(self, url: str, page: int = 1) -> List[Product]:
        full_url = f"{url}{'&' if '?' in url else '?'}p={page}"
        print(f"  Fetching: {full_url}")
        response = self._make_request(full_url)
        return self._parse_page(response.text) if response else []
    
    def search_all_pages(self, query: str, max_pages: int = 3) -> List[Product]:
        all_products = []
        for page in range(1, max_pages + 1):
            print(f"Scraping page {page}...")
            products = self.search(query, page)
            if not products:
                break
            all_products.extend(products)
            print(f"Found {len(products)} products")
        return all_products
    
    def browse_category_all_pages(self, category: str, max_pages: int = 3) -> List[Product]:
        all_products = []
        for page in range(1, max_pages + 1):
            print(f"Scraping {category} page {page}...")
            products = self.browse_category(category, page)
            if not products:
                break
            all_products.extend(products)
            print(f"Found {len(products)} products")
        return all_products
    
    def browse_url_all_pages(self, url: str, max_pages: int = 3) -> List[Product]:
        all_products = []
        for page in range(1, max_pages + 1):
            print(f"Scraping page {page}...")
            products = self.browse_url(url, page)
            if not products:
                break
            all_products.extend(products)
            print(f"Found {len(products)} products")
        return all_products


def save_to_json(products: List[Product], filename: str):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump([asdict(p) for p in products], f, indent=2, ensure_ascii=False)
    print(f"💾 Saved {len(products)} products to {filename}")


def save_to_csv(products: List[Product], filename: str):
    if not products:
        return
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=asdict(products[0]).keys())
        writer.writeheader()
        for p in products:
            writer.writerow(asdict(p))
    print(f"💾 Saved {len(products)} products to {filename}")


def main():
    parser = argparse.ArgumentParser(description="Scrape products from Jarir.com")
    parser.add_argument("query", nargs="?", help="Search query")
    parser.add_argument("--category", "-c", choices=list(JarirScraper.CATEGORIES.keys()))
    parser.add_argument("--url", "-u", help="Direct URL to scrape")
    parser.add_argument("--pages", type=int, default=1)
    parser.add_argument("--output", "-o", help="Output file (.json or .csv)")
    
    args = parser.parse_args()
    
    if not args.query and not args.category and not args.url:
        parser.error("Provide a search query, --category, or --url")
    
    print("\n🏪 Jarir Bookstore Scraper")
    print("=" * 50)
    
    scraper = JarirScraper()
    
    if args.url:
        print(f"📂 URL: {args.url}")
        products = scraper.browse_url_all_pages(args.url, args.pages)
    elif args.category:
        print(f"📂 Category: {args.category}")
        products = scraper.browse_category_all_pages(args.category, args.pages)
    else:
        print(f"🔍 Search: '{args.query}'")
        products = scraper.search_all_pages(args.query, args.pages)
    
    print("=" * 50)
    print(f"\n✅ Total: {len(products)} products")
    
    if products:
        print("\n📦 Sample Results:")
        for i, p in enumerate(products[:5], 1):
            print(f"\n{i}. {p.title[:55]}{'...' if len(p.title) > 55 else ''}")
            print(f"   Price: {p.price} SAR" + (f" (was {p.original_price}, {p.discount_percentage} off)" if p.original_price else ""))
            print(f"   Rating: {p.rating or 'N/A'} | SKU: {p.sku or 'N/A'}")
    
    if args.output:
        if args.output.endswith(".csv"):
            save_to_csv(products, args.output)
        else:
            save_to_json(products, args.output if args.output.endswith(".json") else args.output + ".json")
    
    return products


if __name__ == "__main__":
    main()

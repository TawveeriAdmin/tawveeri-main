#!/usr/bin/env python3
"""
Amazon Saudi Arabia (amazon.sa) Product Scraper

This script scrapes product information from Amazon.sa including:
- Product titles
- Prices
- Ratings
- Product URLs
- Images

Usage:
    python amazon_sa_scraper.py "search term"
    python amazon_sa_scraper.py "laptop" --pages 3
    python amazon_sa_scraper.py "iphone" --output products.json

Note: Web scraping may violate Amazon's Terms of Service.
For production use, consider using Amazon's official Product Advertising API.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import random
import argparse
import csv
from dataclasses import dataclass, asdict
from typing import Optional
import re


@dataclass
class Product:
    """Data class representing an Amazon product"""
    title: str
    price: Optional[str]
    price_currency: str
    rating: Optional[str]
    review_count: Optional[str]
    url: str
    image_url: Optional[str]
    asin: Optional[str]
    is_prime: bool = False
    is_sponsored: bool = False


class AmazonSAScraper:
    """Scraper for Amazon Saudi Arabia (amazon.sa)"""
    
    BASE_URL = "https://www.amazon.sa"
    SEARCH_URL = f"{BASE_URL}/s"
    
    # Rotate through different user agents to avoid detection
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    ]
    
    def __init__(self, delay_range: tuple = (1, 3)):
        """
        Initialize the scraper.
        
        Args:
            delay_range: Tuple of (min, max) seconds to wait between requests
        """
        self.session = requests.Session()
        self.delay_range = delay_range
        
    def _get_headers(self) -> dict:
        """Generate request headers with random user agent"""
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
        }
    
    def _random_delay(self):
        """Add random delay between requests to avoid rate limiting"""
        delay = random.uniform(*self.delay_range)
        time.sleep(delay)
    
    def _extract_asin(self, product_element) -> Optional[str]:
        """Extract ASIN (Amazon Standard Identification Number) from product element"""
        asin = product_element.get("data-asin")
        if asin:
            return asin
        return None
    
    def _extract_price(self, product_element) -> tuple:
        """Extract price and currency from product element"""
        price = None
        currency = "SAR"
        
        # Try different price selectors
        price_selectors = [
            "span.a-price span.a-offscreen",
            "span.a-price-whole",
            "span[data-a-color='price'] span.a-offscreen",
        ]
        
        for selector in price_selectors:
            price_elem = product_element.select_one(selector)
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                # Clean up price text
                price = re.sub(r'[^\d.,]', '', price_text)
                if price:
                    break
        
        return price, currency
    
    def _extract_rating(self, product_element) -> tuple:
        """Extract rating and review count from product element"""
        rating = None
        review_count = None
        
        # Rating
        rating_elem = product_element.select_one("span.a-icon-alt")
        if rating_elem:
            rating_text = rating_elem.get_text(strip=True)
            # Extract numeric rating (e.g., "4.5 out of 5 stars" -> "4.5")
            rating_match = re.search(r'(\d+\.?\d*)', rating_text)
            if rating_match:
                rating = rating_match.group(1)
        
        # Review count
        review_elem = product_element.select_one("span.a-size-base.s-underline-text")
        if review_elem:
            review_text = review_elem.get_text(strip=True)
            review_count = re.sub(r'[^\d,]', '', review_text)
        
        return rating, review_count
    
    def _parse_product(self, product_element) -> Optional[Product]:
        """Parse a single product element into a Product object"""
        try:
            asin = self._extract_asin(product_element)
            if not asin:
                return None
            
            # Title
            title_elem = product_element.select_one("h2 a span, h2 span")
            title = title_elem.get_text(strip=True) if title_elem else "No title"
            
            # URL
            link_elem = product_element.select_one("h2 a, a.a-link-normal.s-no-outline")
            url = self.BASE_URL + link_elem["href"] if link_elem and link_elem.get("href") else ""
            
            # Price
            price, currency = self._extract_price(product_element)
            
            # Rating and reviews
            rating, review_count = self._extract_rating(product_element)
            
            # Image
            img_elem = product_element.select_one("img.s-image")
            image_url = img_elem.get("src") if img_elem else None
            
            # Prime badge
            is_prime = bool(product_element.select_one("i.a-icon-prime"))
            
            # Sponsored
            is_sponsored = bool(product_element.select_one("span.s-label-popover-default"))
            
            return Product(
                title=title,
                price=price,
                price_currency=currency,
                rating=rating,
                review_count=review_count,
                url=url,
                image_url=image_url,
                asin=asin,
                is_prime=is_prime,
                is_sponsored=is_sponsored,
            )
        except Exception as e:
            print(f"Error parsing product: {e}")
            return None
    
    def search(self, query: str, page: int = 1) -> list[Product]:
        """
        Search for products on Amazon.sa
        
        Args:
            query: Search term
            page: Page number (1-indexed)
            
        Returns:
            List of Product objects
        """
        params = {
            "k": query,
            "page": page,
            "ref": f"sr_pg_{page}",
        }
        
        try:
            self._random_delay()
            response = self.session.get(
                self.SEARCH_URL,
                params=params,
                headers=self._get_headers(),
                timeout=15
            )
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Find all product containers
            product_elements = soup.select("div[data-component-type='s-search-result']")
            
            products = []
            for elem in product_elements:
                product = self._parse_product(elem)
                if product:
                    products.append(product)
            
            return products
            
        except requests.RequestException as e:
            print(f"Request error: {e}")
            return []
    
    def search_all_pages(self, query: str, max_pages: int = 5) -> list[Product]:
        """
        Search across multiple pages
        
        Args:
            query: Search term
            max_pages: Maximum number of pages to scrape
            
        Returns:
            List of all Product objects found
        """
        all_products = []
        
        for page in range(1, max_pages + 1):
            print(f"Scraping page {page}...")
            products = self.search(query, page)
            
            if not products:
                print(f"No products found on page {page}, stopping.")
                break
                
            all_products.extend(products)
            print(f"Found {len(products)} products on page {page}")
        
        return all_products
    
    def get_product_details(self, url: str) -> Optional[dict]:
        """
        Get detailed information for a specific product
        
        Args:
            url: Product URL
            
        Returns:
            Dictionary with product details or None
        """
        try:
            self._random_delay()
            response = self.session.get(
                url,
                headers=self._get_headers(),
                timeout=15
            )
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            details = {}
            
            # Title
            title_elem = soup.select_one("#productTitle")
            details["title"] = title_elem.get_text(strip=True) if title_elem else None
            
            # Price
            price_elem = soup.select_one("span.a-price span.a-offscreen")
            details["price"] = price_elem.get_text(strip=True) if price_elem else None
            
            # Description
            desc_elem = soup.select_one("#productDescription")
            details["description"] = desc_elem.get_text(strip=True) if desc_elem else None
            
            # Features/Bullet points
            features = []
            feature_elems = soup.select("#feature-bullets li span.a-list-item")
            for feat in feature_elems:
                text = feat.get_text(strip=True)
                if text:
                    features.append(text)
            details["features"] = features
            
            # Technical details
            tech_details = {}
            tech_rows = soup.select("#productDetails_techSpec_section_1 tr, #prodDetails tr")
            for row in tech_rows:
                th = row.select_one("th")
                td = row.select_one("td")
                if th and td:
                    key = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    tech_details[key] = value
            details["technical_details"] = tech_details
            
            return details
            
        except requests.RequestException as e:
            print(f"Request error: {e}")
            return None


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
        description="Scrape products from Amazon Saudi Arabia (amazon.sa)"
    )
    parser.add_argument(
        "query",
        help="Search query (e.g., 'laptop', 'iphone', 'gaming headset')"
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
        help="Output filename (supports .json and .csv)"
    )
    parser.add_argument(
        "--delay-min",
        type=float,
        default=1,
        help="Minimum delay between requests in seconds (default: 1)"
    )
    parser.add_argument(
        "--delay-max",
        type=float,
        default=3,
        help="Maximum delay between requests in seconds (default: 3)"
    )
    
    args = parser.parse_args()
    
    print(f"\n🔍 Searching Amazon.sa for: '{args.query}'")
    print(f"📄 Pages to scrape: {args.pages}")
    print("-" * 50)
    
    scraper = AmazonSAScraper(delay_range=(args.delay_min, args.delay_max))
    products = scraper.search_all_pages(args.query, args.pages)
    
    print("-" * 50)
    print(f"\n✅ Total products found: {len(products)}")
    
    # Display sample results
    if products:
        print("\n📦 Sample Results:")
        for i, product in enumerate(products[:5], 1):
            print(f"\n{i}. {product.title[:60]}...")
            print(f"   Price: {product.price} {product.price_currency}")
            print(f"   Rating: {product.rating} ({product.review_count} reviews)")
            print(f"   ASIN: {product.asin}")
            print(f"   Prime: {'Yes' if product.is_prime else 'No'}")
    
    # Save to file if output specified
    if args.output:
        if args.output.endswith(".csv"):
            save_to_csv(products, args.output)
        else:
            # Default to JSON
            if not args.output.endswith(".json"):
                args.output += ".json"
            save_to_json(products, args.output)
    
    return products


if __name__ == "__main__":
    main()


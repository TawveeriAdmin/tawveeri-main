'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, AlertCircle, BarChart3, Plus, Trash2 } from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';

interface ProductStore {
  id: string;
  current_price: number;
  original_price: number | null;
  availability: AvailabilityStatus;
  stores: {
    id: string;
    name_ar: string;
    name_en: string;
    logo_url: string | null;
  };
}

interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model: string;
  image_urls: string[] | null;
  specifications: Record<string, unknown> | null;
  product_stores: ProductStore[];
}

const MAX_COMPARE_PRODUCTS = 4;

export default function ComparePage() {
  const supabase = getSupabaseBrowserClient();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();

  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load comparison from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('compare_products');
    if (stored) {
      try {
        const ids = JSON.parse(stored) as string[];
        setProductIds(ids.slice(0, MAX_COMPARE_PRODUCTS));
      } catch (err) {
        console.error('Error parsing stored comparison:', err);
      }
    }
    setLoading(false);
  }, []);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      if (productIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('products')
          .select(
            `
            id,
            name_ar,
            name_en,
            slug,
            category,
            brand,
            model,
            image_urls,
            specifications,
            product_stores(
              id,
              current_price,
              original_price,
              availability,
              stores(
                id,
                name_ar,
                name_en,
                logo_url
              )
            )
          `
          )
          .in('id', productIds)
          .eq('is_active', true);

        if (queryError) throw queryError;

        setProducts((data || []) as Product[]);
      } catch (err) {
        console.error('Error fetching comparison products:', err);
        const errorMessage = err instanceof Error ? err.message : locale === 'ar' ? 'خطأ في التحميل' : 'Error loading products';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [productIds, locale]);

  const handleRemove = (productId: string) => {
    const newIds = productIds.filter((id) => id !== productId);
    setProductIds(newIds);
    localStorage.setItem('compare_products', JSON.stringify(newIds));
  };

  const handleClearAll = () => {
    setProductIds([]);
    localStorage.removeItem('compare_products');
  };

  const handleAddMore = () => {
    router.push(`/${locale}/products`);
  };

  // Get all unique specification keys
  const getAllSpecKeys = (): string[] => {
    const keys = new Set<string>();
    products.forEach((product) => {
      if (product.specifications) {
        Object.keys(product.specifications).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  };

  // Get best price for a product
  const getBestPrice = (product: Product): ProductStore | null => {
    const storesWithPrices = product.product_stores
      .filter((ps) => ps.availability !== 'out_of_stock')
      .sort((a, b) => a.current_price - b.current_price);
    return storesWithPrices[0] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{locale === 'ar' ? 'الرئيسية' : 'Home'}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('compare.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('compare.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {products.length} {locale === 'ar' ? 'منتج' : products.length === 1 ? 'product' : 'products'}
            </p>
          </div>
          <div className="flex gap-2">
            {products.length > 0 && (
              <Button variant="outline" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('compare.clearAll')}
              </Button>
            )}
            {products.length < MAX_COMPARE_PRODUCTS && (
              <Button onClick={handleAddMore}>
                <Plus className="w-4 h-4 mr-2" />
                {t('compare.addMore')}
              </Button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <EmptyState
            icon={<BarChart3 className="h-12 w-12" />}
            title={t('compare.noProducts')}
            description={t('compare.emptyDescription')}
            action={{
              label: t('compare.addMore'),
              onClick: handleAddMore,
            }}
          />
        )}

        {/* Comparison Table */}
        {!loading && products.length > 0 && (
          <div className="space-y-6">
            {/* Products Header */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">{t('compare.specifications')}</TableHead>
                      {products.map((product) => {
                        const productName = locale === 'ar' ? product.name_ar : product.name_en;
                        const imageUrl = product.image_urls?.[0] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

                        return (
                          <TableHead key={product.id} className="text-center">
                            <div className="flex flex-col items-center gap-2">
                              <button
                                onClick={() => handleRemove(product.id)}
                                className="ml-auto text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <img
                                src={imageUrl}
                                alt={productName}
                                className="w-24 h-24 object-contain mx-auto"
                              />
                              <h3 className="font-semibold text-sm">{productName}</h3>
                              <p className="text-xs text-gray-500">
                                {product.brand} - {product.model}
                              </p>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Price Row */}
                    <TableRow>
                      <TableHead>{t('compare.price')}</TableHead>
                      {products.map((product) => {
                        const bestPrice = getBestPrice(product);
                        return (
                          <TableCell key={product.id} className="text-center">
                            {bestPrice ? (
                              <div className="flex flex-col items-center gap-1">
                                <Price
                                  amount={bestPrice.current_price}
                                  className="text-xl font-bold"
                                  symbolClassName="w-5 h-5"
                                />
                                {bestPrice.original_price &&
                                  bestPrice.original_price > bestPrice.current_price && (
                                    <>
                                      <Price
                                        amount={bestPrice.original_price}
                                        className="text-sm text-gray-400 line-through"
                                        symbolClassName="w-4 h-4"
                                      />
                                      <Badge variant="success-light" className="text-xs">
                                        💰{' '}
                                        <Price
                                          amount={calculateSavings(
                                            bestPrice.original_price,
                                            bestPrice.current_price
                                          )}
                                          className="text-xs"
                                          symbolClassName="w-3 h-3"
                                        />
                                      </Badge>
                                    </>
                                  )}
                              </div>
                            ) : (
                              <span className="text-gray-400">
                                {locale === 'ar' ? 'غير متوفر' : 'N/A'}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Availability Row */}
                    <TableRow>
                      <TableHead>{t('compare.availability')}</TableHead>
                      {products.map((product) => {
                        const bestPrice = getBestPrice(product);
                        const availability = bestPrice?.availability || 'out_of_stock';
                        return (
                          <TableCell key={product.id} className="text-center">
                            {availability === 'in_stock' && (
                              <Badge variant="success">{t('product.inStock')}</Badge>
                            )}
                            {availability === 'limited_stock' && (
                              <Badge variant="warning">{t('product.limitedStock')}</Badge>
                            )}
                            {availability === 'out_of_stock' && (
                              <Badge variant="secondary">{t('product.outOfStock')}</Badge>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Stores Count Row */}
                    <TableRow>
                      <TableHead>{t('compare.stores')}</TableHead>
                      {products.map((product) => (
                        <TableCell key={product.id} className="text-center">
                          {product.product_stores.length}{' '}
                          {locale === 'ar' ? 'متجر' : product.product_stores.length === 1 ? 'store' : 'stores'}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Specifications Rows */}
                    {getAllSpecKeys().map((specKey) => (
                      <TableRow key={specKey}>
                        <TableHead>{specKey}</TableHead>
                        {products.map((product) => {
                          const value = product.specifications?.[specKey];
                          return (
                            <TableCell key={product.id} className="text-center">
                              {value
                                ? typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)
                                : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              {products.map((product) => (
                <Button key={product.id} asChild variant="outline">
                  <Link href={`/${locale}/products/${product.slug}`}>
                    {t('compare.viewProduct')}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Max Products Warning */}
        {products.length >= MAX_COMPARE_PRODUCTS && (
          <Alert className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('compare.maxProducts')}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}


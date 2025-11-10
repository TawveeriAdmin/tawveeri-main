'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { Price } from '@/components/ui/price';
import { Filter, X } from 'lucide-react';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';

export interface SearchFilters {
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  stores: string[];
  availability: AvailabilityStatus[];
  dealsOnly: boolean;
  categorySpecific?: Record<string, unknown>;
}

interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
  category?: ProductCategory;
  locale?: string;
}

export function FilterSidebar({
  filters,
  onFilterChange,
  category,
  locale: propLocale,
}: FilterSidebarProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = propLocale || (params?.locale as string) || 'ar';
  const supabase = getSupabaseBrowserClient();

  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<Array<{ id: string; name_ar: string; name_en: string }>>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [loading, setLoading] = useState(false);

  // Fetch available brands
  useEffect(() => {
    async function fetchBrands() {
      if (!category) return;

      setLoading(true);
      try {
        const { data } = await supabase
          .from('products')
          .select('brand')
          .eq('category', category)
          .eq('is_active', true)
          .returns<Array<{ brand: string | null }>>();

        if (data) {
          const uniqueBrands = Array.from(
            new Set(data.map((p) => p.brand).filter((brand): brand is string => Boolean(brand)))
          ).sort();
          setAvailableBrands(uniqueBrands);
        }
      } catch (error) {
        console.error('Error fetching brands:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBrands();
  }, [category]);

  // Fetch available stores
  useEffect(() => {
    async function fetchStores() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('stores')
          .select('id, name_ar, name_en')
          .eq('status', 'active')
          .returns<Array<{ id: string; name_ar: string; name_en: string }>>();

        if (data) {
          setAvailableStores(data);
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStores();
  }, []);

  // Fetch price range
  useEffect(() => {
    async function fetchPriceRange() {
      try {
        const { data } = await supabase
          .from('product_stores')
          .select('current_price')
          .order('current_price', { ascending: true })
          .limit(1)
          .returns<Array<{ current_price: number | null }>>();

        const minPrice = data?.[0]?.current_price || 0;

        const { data: maxData } = await supabase
          .from('product_stores')
          .select('current_price')
          .order('current_price', { ascending: false })
          .limit(1)
          .returns<Array<{ current_price: number | null }>>();

        const maxPrice = maxData?.[0]?.current_price || 100000;

        setPriceRange([minPrice, maxPrice]);
      } catch (error) {
        console.error('Error fetching price range:', error);
      }
    }

    fetchPriceRange();
  }, []);

  const handleBrandToggle = (brand: string) => {
    const newBrands = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];
    onFilterChange({ ...filters, brands: newBrands });
  };

  const handleStoreToggle = (storeId: string) => {
    const newStores = filters.stores.includes(storeId)
      ? filters.stores.filter((s) => s !== storeId)
      : [...filters.stores, storeId];
    onFilterChange({ ...filters, stores: newStores });
  };

  const handleAvailabilityToggle = (availability: AvailabilityStatus) => {
    const newAvailability = filters.availability.includes(availability)
      ? filters.availability.filter((a) => a !== availability)
      : [...filters.availability, availability];
    onFilterChange({ ...filters, availability: newAvailability });
  };

  const handlePriceChange = (values: number[]) => {
    onFilterChange({
      ...filters,
      minPrice: values[0],
      maxPrice: values[1],
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      brands: [],
      stores: [],
      availability: [],
      dealsOnly: false,
      minPrice: undefined,
      maxPrice: undefined,
    });
  };

  const hasActiveFilters =
    filters.brands.length > 0 ||
    filters.stores.length > 0 ||
    filters.availability.length > 0 ||
    filters.dealsOnly ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined;

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {t('search.filters')}
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="w-4 h-4 mr-1" />
              {t('search.clearFilters')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Accordion type="multiple" className="w-full">
          {/* Brands Filter */}
          {availableBrands.length > 0 && (
            <AccordionItem value="brands">
              <AccordionTrigger>
                {locale === 'ar' ? 'العلامات التجارية' : 'Brands'}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableBrands.map((brand) => (
                    <div key={brand} className="flex items-center space-x-2">
                      <Checkbox
                        id={`brand-${brand}`}
                        checked={filters.brands.includes(brand)}
                        onCheckedChange={() => handleBrandToggle(brand)}
                      />
                      <Label
                        htmlFor={`brand-${brand}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {brand}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Price Range Filter */}
          <AccordionItem value="price">
            <AccordionTrigger>
              {locale === 'ar' ? 'نطاق السعر' : 'Price Range'}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <Slider
                  value={[filters.minPrice || priceRange[0], filters.maxPrice || priceRange[1]]}
                  onValueChange={handlePriceChange}
                  min={priceRange[0]}
                  max={priceRange[1]}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    <Price amount={filters.minPrice || priceRange[0]} className="text-sm" />
                  </span>
                  <span>
                    <Price amount={filters.maxPrice || priceRange[1]} className="text-sm" />
                  </span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Stores Filter */}
          {availableStores.length > 0 && (
            <AccordionItem value="stores">
              <AccordionTrigger>
                {locale === 'ar' ? 'المتاجر' : 'Stores'}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableStores.map((store) => {
                    const storeName = locale === 'ar' ? store.name_ar : store.name_en;
                    return (
                      <div key={store.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`store-${store.id}`}
                          checked={filters.stores.includes(store.id)}
                          onCheckedChange={() => handleStoreToggle(store.id)}
                        />
                        <Label
                          htmlFor={`store-${store.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {storeName}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Availability Filter */}
          <AccordionItem value="availability">
            <AccordionTrigger>
              {locale === 'ar' ? 'التوفر' : 'Availability'}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="availability-in-stock"
                    checked={filters.availability.includes('in_stock')}
                    onCheckedChange={() => handleAvailabilityToggle('in_stock')}
                  />
                  <Label htmlFor="availability-in-stock" className="text-sm font-normal cursor-pointer">
                    {t('product.inStock')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="availability-limited"
                    checked={filters.availability.includes('limited_stock')}
                    onCheckedChange={() => handleAvailabilityToggle('limited_stock')}
                  />
                  <Label htmlFor="availability-limited" className="text-sm font-normal cursor-pointer">
                    {t('product.limitedStock')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="availability-out-of-stock"
                    checked={filters.availability.includes('out_of_stock')}
                    onCheckedChange={() => handleAvailabilityToggle('out_of_stock')}
                  />
                  <Label htmlFor="availability-out-of-stock" className="text-sm font-normal cursor-pointer">
                    {t('product.outOfStock')}
                  </Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Deals Only Filter */}
          <AccordionItem value="deals">
            <AccordionTrigger>
              {locale === 'ar' ? 'العروض' : 'Deals'}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deals-only"
                  checked={filters.dealsOnly}
                  onCheckedChange={(checked) =>
                    onFilterChange({ ...filters, dealsOnly: checked === true })
                  }
                />
                <Label htmlFor="deals-only" className="text-sm font-normal cursor-pointer">
                  {locale === 'ar' ? 'عروض فقط' : 'Show deals only'}
                </Label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {hasActiveFilters && (
          <Button onClick={handleClearFilters} variant="outline" className="w-full">
            {t('search.clearFilters')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}


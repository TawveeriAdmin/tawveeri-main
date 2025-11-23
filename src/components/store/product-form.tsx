'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { getSupabaseBrowserClient } from '@/lib/database';
import type { AvailabilityStatus } from '@/lib/database/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductFormData {
  // Product selection
  productId: string | null;
  createNewProduct: boolean;
  
  // New product fields
  name_ar: string;
  name_en: string;
  category: string;
  brand: string;
  model: string;
  sku: string;
  description_ar: string;
  description_en: string;
  image_urls: string[];
  
  // Product store fields
  current_price: number;
  original_price: number | null;
  stock_quantity: number | null;
  availability: AvailabilityStatus;
  product_url: string;
  affiliate_url: string;
  delivery_time_days: number | null;
  delivery_cost: number;
  is_free_delivery: boolean;
  is_deal: boolean;
  deal_expires_at: string;
  coupon_code: string;
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  storeId: string;
  locale: string;
  onSuccess: () => void;
}

export function ProductForm({ mode, initialData, storeId, locale, onSuccess }: ProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  const [formData, setFormData] = useState<ProductFormData>({
    productId: null,
    createNewProduct: false,
    name_ar: '',
    name_en: '',
    category: '',
    brand: '',
    model: '',
    sku: '',
    description_ar: '',
    description_en: '',
    image_urls: [],
    current_price: 0,
    original_price: null,
    stock_quantity: null,
    availability: 'in_stock',
    product_url: '',
    affiliate_url: '',
    delivery_time_days: null,
    delivery_cost: 0,
    is_free_delivery: false,
    is_deal: false,
    deal_expires_at: '',
    coupon_code: '',
    ...initialData,
  });

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
      if (initialData.product) {
        setSelectedProduct(initialData.product);
        setFormData((prev) => ({ ...prev, productId: initialData.product.id }));
      }
    }
  }, [initialData]);

  const searchProducts = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, name_en, category, brand, model')
        .or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (productSearchQuery) {
        searchProducts(productSearchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [productSearchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      let productId = formData.productId;

      // Create new product if needed
      if (formData.createNewProduct || !productId) {
        if (!formData.name_ar || !formData.name_en || !formData.category || !formData.brand || !formData.model) {
          toast({
            title: isRTL ? 'خطأ' : 'Error',
            description: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields',
            variant: 'destructive',
          });
          return;
        }

        // Generate slug
        const slug = formData.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            name_ar: formData.name_ar,
            name_en: formData.name_en,
            slug: `${slug}-${Date.now()}`,
            category: formData.category,
            brand: formData.brand,
            model: formData.model,
            sku: formData.sku || null,
            description_ar: formData.description_ar || null,
            description_en: formData.description_en || null,
            image_urls: formData.image_urls || null,
          })
          .select()
          .single();

        if (productError) throw productError;
        if (!newProduct) throw new Error('Failed to create product');
        productId = (newProduct as any).id;
      }

      // Create or update product_store entry
      const productStoreData: any = {
        product_id: productId,
        store_id: storeId,
        current_price: formData.current_price,
        original_price: formData.original_price || null,
        stock_quantity: formData.stock_quantity || null,
        availability: formData.availability,
        product_url: formData.product_url,
        affiliate_url: formData.affiliate_url || null,
        delivery_time_days: formData.delivery_time_days || null,
        delivery_cost: formData.delivery_cost || 0,
        is_free_delivery: formData.is_free_delivery,
        is_deal: formData.is_deal,
        deal_expires_at: formData.deal_expires_at || null,
        coupon_code: formData.coupon_code || null,
      };

      if (mode === 'create') {
        const { error: psError } = await supabase
          .from('product_stores')
          .insert(productStoreData);

        if (psError) throw psError;
      } else {
        const initialDataTyped = initialData as { id: string } | undefined;
        if (!initialDataTyped?.id) {
          throw new Error('Product ID is required for update');
        }
        const { error: psError } = await supabase
          .from('product_stores')
          .update(productStoreData)
          .eq('id', initialDataTyped.id);

        if (psError) throw psError;
      }

      toast({
        title: isRTL ? 'نجح' : 'Success',
        description:
          mode === 'create'
            ? isRTL
              ? 'تم إضافة المنتج بنجاح'
              : 'Product added successfully'
            : isRTL
            ? 'تم تحديث المنتج بنجاح'
            : 'Product updated successfully',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message || (isRTL ? 'فشل حفظ المنتج' : 'Failed to save product'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Selection */}
      {mode === 'create' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createNew"
              checked={formData.createNewProduct}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, createNewProduct: checked as boolean }))
              }
            />
            <Label htmlFor="createNew">
              {isRTL ? 'إنشاء منتج جديد' : 'Create new product'}
            </Label>
          </div>

          {!formData.createNewProduct && (
            <div className="space-y-2">
              <Label>{isRTL ? 'البحث عن منتج' : 'Search Product'}</Label>
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedProduct
                      ? isRTL
                        ? selectedProduct.name_ar
                        : selectedProduct.name_en
                      : isRTL
                      ? 'اختر منتج...'
                      : 'Select product...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                  <CommandInput
                    placeholder={isRTL ? 'ابحث عن منتج...' : 'Search product...'}
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                  />
                    <CommandList>
                      <CommandEmpty>
                        {isRTL ? 'لا توجد نتائج' : 'No products found'}
                      </CommandEmpty>
                      <CommandGroup>
                        {searchResults.map((product) => (
                          <CommandItem
                            key={product.id}
                            onClick={() => {
                              setSelectedProduct(product);
                              setFormData((prev) => ({ ...prev, productId: product.id }));
                              setProductSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedProduct?.id === product.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {isRTL ? product.name_ar : product.name_en} - {product.brand}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}

      {/* New Product Fields */}
      {(formData.createNewProduct || mode === 'edit') && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold">
            {isRTL ? 'معلومات المنتج' : 'Product Information'}
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name_ar">
                {isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'} *
              </Label>
              <Input
                id="name_ar"
                value={formData.name_ar}
                onChange={(e) => setFormData((prev) => ({ ...prev, name_ar: e.target.value }))}
                disabled={mode === 'edit' && !formData.createNewProduct}
                required={formData.createNewProduct || mode === 'edit'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_en">
                {isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'} *
              </Label>
              <Input
                id="name_en"
                value={formData.name_en}
                onChange={(e) => setFormData((prev) => ({ ...prev, name_en: e.target.value }))}
                disabled={mode === 'edit' && !formData.createNewProduct}
                required={formData.createNewProduct || mode === 'edit'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                {isRTL ? 'الفئة' : 'Category'} *
              </Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                disabled={mode === 'edit' && !formData.createNewProduct}
                required={formData.createNewProduct || mode === 'edit'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">
                {isRTL ? 'العلامة التجارية' : 'Brand'} *
              </Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                disabled={mode === 'edit' && !formData.createNewProduct}
                required={formData.createNewProduct || mode === 'edit'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">
                {isRTL ? 'الموديل' : 'Model'} *
              </Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                disabled={mode === 'edit' && !formData.createNewProduct}
                required={formData.createNewProduct || mode === 'edit'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">{isRTL ? 'SKU' : 'SKU'}</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                disabled={mode === 'edit' && !formData.createNewProduct}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_ar">
              {isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}
            </Label>
            <Textarea
              id="description_ar"
              value={formData.description_ar}
              onChange={(e) => setFormData((prev) => ({ ...prev, description_ar: e.target.value }))}
              disabled={mode === 'edit' && !formData.createNewProduct}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_en">
              {isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}
            </Label>
            <Textarea
              id="description_en"
              value={formData.description_en}
              onChange={(e) => setFormData((prev) => ({ ...prev, description_en: e.target.value }))}
              disabled={mode === 'edit' && !formData.createNewProduct}
            />
          </div>
        </div>
      )}

      {/* Product Store Fields */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">
          {isRTL ? 'معلومات المتجر' : 'Store Information'}
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current_price">
              {isRTL ? 'السعر الحالي' : 'Current Price'} *
            </Label>
            <Input
              id="current_price"
              type="number"
              step="0.01"
              value={formData.current_price}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, current_price: parseFloat(e.target.value) || 0 }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="original_price">
              {isRTL ? 'السعر الأصلي' : 'Original Price'}
            </Label>
            <Input
              id="original_price"
              type="number"
              step="0.01"
              value={formData.original_price || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  original_price: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock_quantity">
              {isRTL ? 'الكمية المتوفرة' : 'Stock Quantity'}
            </Label>
            <Input
              id="stock_quantity"
              type="number"
              value={formData.stock_quantity || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  stock_quantity: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability">
              {isRTL ? 'الحالة' : 'Availability'} *
            </Label>
            <Select
              value={formData.availability}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, availability: value as AvailabilityStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">{isRTL ? 'متوفر' : 'In Stock'}</SelectItem>
                <SelectItem value="out_of_stock">{isRTL ? 'نفد المخزون' : 'Out of Stock'}</SelectItem>
                <SelectItem value="limited_stock">{isRTL ? 'مخزون محدود' : 'Limited Stock'}</SelectItem>
                <SelectItem value="pre_order">{isRTL ? 'طلب مسبق' : 'Pre-Order'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_url">
              {isRTL ? 'رابط المنتج' : 'Product URL'} *
            </Label>
            <Input
              id="product_url"
              type="url"
              value={formData.product_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, product_url: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="affiliate_url">
              {isRTL ? 'رابط الإحالة' : 'Affiliate URL'}
            </Label>
            <Input
              id="affiliate_url"
              type="url"
              value={formData.affiliate_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, affiliate_url: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_time_days">
              {isRTL ? 'وقت التوصيل (أيام)' : 'Delivery Time (Days)'}
            </Label>
            <Input
              id="delivery_time_days"
              type="number"
              value={formData.delivery_time_days || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  delivery_time_days: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_cost">
              {isRTL ? 'تكلفة التوصيل' : 'Delivery Cost'}
            </Label>
            <Input
              id="delivery_cost"
              type="number"
              step="0.01"
              value={formData.delivery_cost}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, delivery_cost: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_free_delivery"
              checked={formData.is_free_delivery}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_free_delivery: checked as boolean }))
              }
            />
            <Label htmlFor="is_free_delivery">
              {isRTL ? 'توصيل مجاني' : 'Free Delivery'}
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_deal"
              checked={formData.is_deal}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_deal: checked as boolean }))
              }
            />
            <Label htmlFor="is_deal">
              {isRTL ? 'عرض خاص' : 'Deal'}
            </Label>
          </div>

          {formData.is_deal && (
            <>
              <div className="space-y-2">
                <Label htmlFor="deal_expires_at">
                  {isRTL ? 'تاريخ انتهاء العرض' : 'Deal Expires At'}
                </Label>
                <Input
                  id="deal_expires_at"
                  type="datetime-local"
                  value={formData.deal_expires_at}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deal_expires_at: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coupon_code">
                  {isRTL ? 'كود الخصم' : 'Coupon Code'}
                </Label>
                <Input
                  id="coupon_code"
                  value={formData.coupon_code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, coupon_code: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? isRTL
              ? 'جاري الحفظ...'
              : 'Saving...'
            : mode === 'create'
            ? isRTL
              ? 'إضافة'
              : 'Add Product'
            : isRTL
            ? 'حفظ التغييرات'
            : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}


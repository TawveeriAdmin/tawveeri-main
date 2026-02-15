import { notFound } from 'next/navigation';
import { createClient } from '@/lib/auth/server';
import { getProductAnalytics } from '@/lib/admin/utils';
import { getProductReviews } from '@/lib/reviews/product-reviews';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/admin/data-table';
import { format } from 'date-fns';
import Image from 'next/image';

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isRTL = locale === 'ar';
  const supabase = await createClient();

  // Fetch product data
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (productError || !product) {
    notFound();
  }

  // Fetch product stores
  const { data: productStores } = await supabase
    .from('product_stores')
    .select(
      `
      *,
      stores (
        id,
        name_ar,
        name_en,
        logo_url
      )
    `
    )
    .eq('product_id', id);

  // Fetch product analytics
  const analyticsResult = await getProductAnalytics(id);
  const analytics = analyticsResult.data;

  // Fetch product reviews
  const reviewsResult = await getProductReviews(id, { limit: 10 });
  const reviews = reviewsResult.data || [];

  const productName = isRTL ? product.name_ar : product.name_en;
  const productImage = product.image_urls?.[0] || '';

  const storesColumns: Column<any>[] = [
    {
      key: 'store',
      label: isRTL ? 'المتجر' : 'Store',
      render: (row) => {
        const store = row.stores as any;
        return store ? (isRTL ? store.name_ar : store.name_en) : '-';
      },
    },
    {
      key: 'current_price',
      label: isRTL ? 'السعر' : 'Price',
      render: (row) => `$${row.current_price.toLocaleString()}`,
    },
    {
      key: 'availability',
      label: isRTL ? 'التوفر' : 'Availability',
      render: (row) => (
        <Badge variant={row.availability === 'in_stock' ? 'default' : 'secondary'}>
          {row.availability}
        </Badge>
      ),
    },
    {
      key: 'is_deal',
      label: isRTL ? 'عرض' : 'Deal',
      render: (row) => (row.is_deal ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No')),
    },
  ];

  const reviewsColumns: Column<any>[] = [
    {
      key: 'rating',
      label: isRTL ? 'التقييم' : 'Rating',
      render: (row) => `${row.rating}/5`,
    },
    {
      key: 'review_text',
      label: isRTL ? 'التعليق' : 'Review',
      render: (row) => row.review_text || '-',
    },
    {
      key: 'created_at',
      label: isRTL ? 'التاريخ' : 'Date',
      render: (row) => format(new Date(row.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{productName}</h1>
      </div>

      {/* Product Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            {productImage && (
              <div className="relative h-32 w-32 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                <Image
                  src={productImage}
                  alt={productName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{product.category}</Badge>
                <Badge variant="outline">{product.brand}</Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {isRTL ? product.description_ar : product.description_en}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'المشاهدات' : 'Views'}
              </p>
              <p className="mt-1 text-2xl font-bold">{product.view_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'الحفظ' : 'Saves'}
              </p>
              <p className="mt-1 text-2xl font-bold">{product.save_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'المقارنات' : 'Comparisons'}
              </p>
              <p className="mt-1 text-2xl font-bold">{product.comparison_count.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      {analytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'متوسط التقييم' : 'Average Rating'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {analytics.average_rating ? analytics.average_rating.toFixed(1) : '0.0'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'عدد التقييمات' : 'Total Reviews'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.total_reviews || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'إجمالي المشاهدات' : 'Total Views'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.total_views.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Data Tabs */}
      <Tabs defaultValue="stores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stores">{isRTL ? 'المتاجر' : 'Stores'}</TabsTrigger>
          <TabsTrigger value="reviews">{isRTL ? 'التقييمات' : 'Reviews'}</TabsTrigger>
        </TabsList>

        <TabsContent value="stores">
          <DataTable data={productStores || []} columns={storesColumns} />
        </TabsContent>

        <TabsContent value="reviews">
          <DataTable data={reviews} columns={reviewsColumns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/admin/data-table';
import { ChartCard } from '@/components/admin/chart-card';
import { format } from 'date-fns';
import { formatDate, formatNumber } from '@/lib/formatting';

const BarChart = dynamic(
  () => import('@/components/analytics/bar-chart').then((m) => ({ default: m.BarChart })),
  { ssr: false }
);
import { Search, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface SearchAnalytics {
 search_query: string;
 count: number;
 results_count: number | null;
 created_at: string;
}

interface SearchTrend {
 date: string;
 searches: number;
 noResults: number;
}

export default function SearchAnalyticsPage() {
 const params = useParams();
 const locale = (params?.locale as string) || 'ar';
 const isRTL = locale === 'ar';
 const t = useTranslations();
 const supabase = getSupabaseBrowserClient();

 const [topSearches, setTopSearches] = useState<SearchAnalytics[]>([]);
 const [noResultSearches, setNoResultSearches] = useState<SearchAnalytics[]>([]);
 const [searchTrends, setSearchTrends] = useState<SearchTrend[]>([]);
 const [loading, setLoading] = useState(true);
 const [totalSearches, setTotalSearches] = useState(0);
 const [avgResultsCount, setAvgResultsCount] = useState(0);

 useEffect(() => {
 loadAnalytics();
 }, []);

 const loadAnalytics = async () => {
 try {
 setLoading(true);

 // Get top searches (last 30 days)
 const thirtyDaysAgo = new Date();
 thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

 const { data: searchHistory, error: historyError } = await supabase
 .from('search_history')
 .select('*')
 .gte('created_at', thirtyDaysAgo.toISOString())
 .order('created_at', { ascending: false });

 if (historyError) throw historyError;

 // Process top searches
 const searchCounts: Record<string, { count: number; totalResults: number; latestDate: string }> = {};
 
 (searchHistory || []).forEach((search: any) => {
 const query = search.search_query || '';
 if (!searchCounts[query]) {
 searchCounts[query] = {
 count: 0,
 totalResults: 0,
 latestDate: search.created_at,
 };
 }
 searchCounts[query].count += 1;
 searchCounts[query].totalResults += search.results_count || 0;
 if (new Date(search.created_at) > new Date(searchCounts[query].latestDate)) {
 searchCounts[query].latestDate = search.created_at;
 }
 });

 const top = Object.entries(searchCounts)
 .map(([query, data]) => ({
 search_query: query,
 count: data.count,
 results_count: data.totalResults / data.count,
 created_at: data.latestDate,
 }))
 .sort((a, b) => b.count - a.count)
 .slice(0, 20);

 setTopSearches(top);

 // Get no-result searches
 const noResults = (searchHistory || [])
 .filter((s: any) => !s.results_count || s.results_count === 0)
 .slice(0, 20)
 .map((s: any) => ({
 search_query: s.search_query || '',
 count: 1,
 results_count: 0,
 created_at: s.created_at,
 }));

 setNoResultSearches(noResults);

 // Calculate trends (daily for last 7 days)
 const trends: Record<string, { searches: number; noResults: number }> = {};
 const sevenDaysAgo = new Date();
 sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

 (searchHistory || [])
 .filter((s: any) => new Date(s.created_at) >= sevenDaysAgo)
 .forEach((search: any) => {
 const date = format(new Date(search.created_at), 'yyyy-MM-dd');
 if (!trends[date]) {
 trends[date] = { searches: 0, noResults: 0 };
 }
 trends[date].searches += 1;
 if (!search.results_count || search.results_count === 0) {
 trends[date].noResults += 1;
 }
 });

 const trendData = Object.entries(trends)
 .map(([date, data]) => ({
 date,
 searches: data.searches,
 noResults: data.noResults,
 }))
 .sort((a, b) => a.date.localeCompare(b.date));

 setSearchTrends(trendData);

 // Calculate stats
 setTotalSearches(searchHistory?.length || 0);
 const avgResults = searchHistory
 ? searchHistory.reduce((sum: number, s: any) => sum + (s.results_count || 0), 0) / searchHistory.length
 : 0;
 setAvgResultsCount(Math.round(avgResults));
 } catch (error) {
 console.error('Error loading search analytics:', error);
 } finally {
 setLoading(false);
 }
 };

 const topSearchesColumns: Column<SearchAnalytics>[] = [
 {
 key: 'search_query',
 label: isRTL ? 'البحث' : 'Search Query',
 render: (search) => (
 <div className="max-w-md">
 <p className="font-medium truncate">{search.search_query || '-'}</p>
 </div>
 ),
 },
 {
 key: 'count',
 label: isRTL ? 'عدد المرات' : 'Count',
 render: (search) => <span className="font-semibold">{search.count}</span>,
 },
 {
 key: 'results_count',
 label: isRTL ? 'متوسط النتائج' : 'Avg Results',
 render: (search) => (
 <span>{Math.round(search.results_count || 0)}</span>
 ),
 },
 {
 key: 'created_at',
 label: isRTL ? 'آخر بحث' : 'Last Search',
 render: (search) => formatDate(search.created_at, locale),
 },
 ];

 const noResultColumns: Column<SearchAnalytics>[] = [
 {
 key: 'search_query',
 label: isRTL ? 'البحث' : 'Search Query',
 render: (search) => (
 <div className="max-w-md">
 <p className="font-medium truncate">{search.search_query || '-'}</p>
 </div>
 ),
 },
 {
 key: 'created_at',
 label: isRTL ? 'التاريخ' : 'Date',
 render: (search) => formatDate(search.created_at, locale, 'datetime'),
 },
 ];

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div>
 <h1 className="text-headline-lg text-on-surface">
 {isRTL ? 'تحليلات البحث' : 'Search Analytics'}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {isRTL
 ? 'تحليل سلوك المستخدمين في البحث والاستعلامات الشائعة'
 : 'Analyze user search behavior and popular queries'}
 </p>
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'إجمالي عمليات البحث' : 'Total Searches'}
 </CardTitle>
 <Search className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-headline-md">{formatNumber(totalSearches, locale)}</div>
 <p className="text-body-sm text-muted-foreground">
 {isRTL ? 'آخر 30 يوماً' : 'Last 30 days'}
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'متوسط النتائج' : 'Avg Results'}
 </CardTitle>
 <TrendingUp className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-headline-md">{avgResultsCount}</div>
 <p className="text-body-sm text-muted-foreground">
 {isRTL ? 'نتائج لكل بحث' : 'Results per search'}
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-label-lg">
 {isRTL ? 'بحوث بلا نتائج' : 'No Result Searches'}
 </CardTitle>
 <AlertCircle className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-headline-md">{noResultSearches.length}</div>
 <p className="text-body-sm text-muted-foreground">
 {isRTL ? 'بحوث تحتاج مراجعة' : 'Searches needing review'}
 </p>
 </CardContent>
 </Card>
 </div>

 {/* Search Trends Chart */}
 {searchTrends.length > 0 && (
 <ChartCard title={isRTL ? 'اتجاهات البحث (آخر 7 أيام)' : 'Search Trends (Last 7 Days)'}>
 <BarChart
 data={searchTrends}
 dataKey="searches"
 labelKey="date"
 height={300}
 color="#3b82f6"
 />
 </ChartCard>
 )}

 {/* Top Searches Table */}
 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'أكثر البحوث شيوعاً' : 'Top Searches'}</CardTitle>
 </CardHeader>
 <CardContent>
 <DataTable
 data={topSearches}
 columns={topSearchesColumns}
 loading={loading}
 />
 </CardContent>
 </Card>

 {/* No Result Searches Table */}
 <Card>
 <CardHeader>
 <CardTitle>{isRTL ? 'بحوث بلا نتائج' : 'No Result Searches'}</CardTitle>
 </CardHeader>
 <CardContent>
 <DataTable
 data={noResultSearches}
 columns={noResultColumns}
 loading={loading}
 />
 </CardContent>
 </Card>
 </div>
 );
}


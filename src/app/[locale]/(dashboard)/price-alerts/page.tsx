'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriceAlertCard } from '@/components/products/price-alert-card';
import { PriceAlertDialog } from '@/components/products/price-alert-dialog';
import { GuestPrompt } from '@/components/auth/guest-prompt';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { Database } from '@/lib/database/types';
import Link from 'next/link';

type PriceAlertRow = Database['public']['Tables']['price_alerts']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];

interface PriceAlertWithProduct extends PriceAlertRow {
 products?: ProductRow & {
 product_stores?: Array<{
 current_price: number;
 }>;
 };
}

export default function PriceAlertsPage() {
 const params = useParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const { user, loading: authLoading } = useAuth();
 const { toast } = useToast();
 const isRTL = locale === 'ar';
 const supabase = useMemo(
 () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
 []
 );

 const [alerts, setAlerts] = useState<PriceAlertWithProduct[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
 const [alertDialogOpen, setAlertDialogOpen] = useState(false);
 const [editingAlert, setEditingAlert] = useState<PriceAlertRow | null>(null);

 useEffect(() => {
 if (user) {
 loadAlerts();
 } else {
 setLoading(false);
 }
 }, [user, activeTab]);

 const loadAlerts = async () => {
 if (!user || !supabase) return;

 try {
 setLoading(true);
 const { data, error } = await supabase
 .from('price_alerts')
 .select(
 `
 *,
 products (
 id,
 name_ar,
 name_en,
 image_urls,
 product_stores (
 current_price
 )
 )
 `
 )
 .eq('user_id', user.id)
 .eq('is_active', activeTab === 'active')
 .order('created_at', { ascending: false });

 if (error) throw error;

 setAlerts((data as PriceAlertWithProduct[]) || []);
 } catch (error) {
 console.error('Error loading price alerts:', error);
 toast({
 title: t('common.error'),
 description: t('priceAlerts.loadError'),
 variant: 'destructive',
 });
 } finally {
 setLoading(false);
 }
 };

 const handleDelete = async (alertId: string) => {
 if (!user || !supabase) return;

 if (!confirm(t('priceAlerts.deleteConfirm'))) {
 return;
 }

 try {
 const { error } = await supabase
 .from('price_alerts')
 .delete()
 .eq('id', alertId)
 .eq('user_id', user.id);

 if (error) throw error;

 toast({
 title: t('priceAlerts.deleted'),
 description: t('priceAlerts.deleteSuccess'),
 });

 loadAlerts();
 } catch (error) {
 console.error('Error deleting alert:', error);
 toast({
 title: t('common.error'),
 description: t('priceAlerts.deleteError'),
 variant: 'destructive',
 });
 }
 };

 const handleToggle = async (alertId: string, isActive: boolean) => {
 if (!user || !supabase) return;

 try {
 const { error } = await supabase
 .from('price_alerts')
 .update({ is_active: isActive })
 .eq('id', alertId)
 .eq('user_id', user.id);

 if (error) throw error;

 toast({
 title: t('priceAlerts.updated'),
 description: isActive ? t('priceAlerts.activateSuccess') : t('priceAlerts.deactivateSuccess'),
 });

 loadAlerts();
 } catch (error) {
 console.error('Error toggling alert:', error);
 toast({
 title: t('common.error'),
 description: t('priceAlerts.updateError'),
 variant: 'destructive',
 });
 }
 };

 const handleEdit = (alert: PriceAlertRow) => {
 setEditingAlert(alert);
 setAlertDialogOpen(true);
 };

 const handleDialogSuccess = () => {
 setAlertDialogOpen(false);
 setEditingAlert(null);
 loadAlerts();
 };

 const getCurrentPrice = (alert: PriceAlertWithProduct): number => {
 const stores = alert.products?.product_stores || [];
 if (stores.length === 0) return 0;
 return Math.min(...stores.map((ps) => ps.current_price));
 };

 if (authLoading) {
 return (
 <div className="space-y-6">
 <Skeleton className="h-8 w-48" />
 <div className="grid gap-4">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-32 w-full" />
 ))}
 </div>
 </div>
 );
 }

 if (!user) {
 return (
 <GuestPrompt
 title={t('priceAlerts.guestTitle')}
 description={t('priceAlerts.guestDescription')}
 locale={locale}
 />
 );
 }

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
 {t('priceAlerts.title')}
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {t('priceAlerts.description')}
 </p>
 </div>
 <Button onClick={() => setAlertDialogOpen(true)}>
 <Plus className="h-4 w-4 mr-2" />
 {isRTL ? 'إضافة تنبيه' : 'Add Alert'}
 </Button>
 </div>

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'inactive')}>
 <TabsList>
 <TabsTrigger value="active">
 {t('priceAlerts.active')} ({alerts.filter((a) => a.is_active).length})
 </TabsTrigger>
 <TabsTrigger value="inactive">
 {t('priceAlerts.inactive')} ({alerts.filter((a) => !a.is_active).length})
 </TabsTrigger>
 </TabsList>

 <TabsContent value="active" className="space-y-4">
 {loading ? (
 <div className="grid gap-4">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-32 w-full" />
 ))}
 </div>
 ) : alerts.filter((a) => a.is_active).length === 0 ? (
 <div className="text-center py-12">
 <p className="text-on-surface-variant mb-4">
 {t('priceAlerts.noAlerts')}
 </p>
 <Button onClick={() => setAlertDialogOpen(true)}>
 <Plus className="h-4 w-4 mr-2" />
 {t('priceAlerts.addAlert')}
 </Button>
 </div>
 ) : (
 <div className="grid gap-4">
 {alerts
 .filter((a) => a.is_active)
 .map((alert) => (
 <PriceAlertCard
 key={alert.id}
 alert={alert}
 currentPrice={getCurrentPrice(alert)}
 locale={locale}
 onEdit={handleEdit}
 onDelete={handleDelete}
 onToggle={handleToggle}
 />
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="inactive" className="space-y-4">
 {loading ? (
 <div className="grid gap-4">
 {[...Array(3)].map((_, i) => (
 <Skeleton key={i} className="h-32 w-full" />
 ))}
 </div>
 ) : alerts.filter((a) => !a.is_active).length === 0 ? (
 <div className="text-center py-12">
 <p className="text-on-surface-variant">
 {t('priceAlerts.noAlerts')}
 </p>
 </div>
 ) : (
 <div className="grid gap-4">
 {alerts
 .filter((a) => !a.is_active)
 .map((alert) => (
 <PriceAlertCard
 key={alert.id}
 alert={alert}
 currentPrice={getCurrentPrice(alert)}
 locale={locale}
 onEdit={handleEdit}
 onDelete={handleDelete}
 onToggle={handleToggle}
 />
 ))}
 </div>
 )}
 </TabsContent>
 </Tabs>

 {/* Price Alert Dialog - For adding new alerts, user needs to navigate to product page */}
 {/* Edit functionality will use the dialog but we need product context */}
 </div>
 );
}

